// Minimal behavioral test suite.
// Uses only Node built-ins (node:test, node:assert, vm, fs, child_process).
// Run with: npm test

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app');

// ============================================================
// Build behavior — the release pipeline depends on these zips
// ============================================================
describe('build', () => {
    const rootFiles = ['LICENSE', 'README.md'];

    async function makeWorkspace() {
        const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'da-build-'));
        await copyDir(APP, path.join(dir, 'app'));
        for (const f of rootFiles) {
            const src = path.join(ROOT, f);
            if (fs.existsSync(src)) await fsp.copyFile(src, path.join(dir, f));
        }
        return dir;
    }

    test('chrome zip contains background-wrapper.js and required assets', async () => {
        const workspace = await makeWorkspace();
        try {
            execFileSync('node', ['app/build.js', 'chrome'], { cwd: workspace, stdio: 'pipe' });
            const files = zipList(path.join(workspace, 'dist', 'dyslexia-away-chrome.zip'));
            assert.ok(files.includes('background-wrapper.js'), 'chrome must include the service-worker wrapper');
            for (const required of ['manifest.json', 'background.js', 'content.js', 'popup.js', 'popup.html', 'style.css', 'fonts.css', 'browser-polyfill.min.js']) {
                assert.ok(files.includes(required), `chrome zip missing required file: ${required}`);
            }
            assert.ok(files.some(f => f.startsWith('fonts/Andika')), 'chrome zip missing font assets');
            assert.ok(files.some(f => f.startsWith('_locales/en/')), 'chrome zip missing default locale');
        } finally {
            await fsp.rm(workspace, { recursive: true, force: true });
        }
    });

    test('firefox zip excludes background-wrapper.js', async () => {
        const workspace = await makeWorkspace();
        try {
            execFileSync('node', ['app/build.js', 'firefox'], { cwd: workspace, stdio: 'pipe' });
            const files = zipList(path.join(workspace, 'dist', 'dyslexia-away-firefox.zip'));
            assert.ok(!files.includes('background-wrapper.js'), 'firefox must NOT include the service-worker wrapper');
            assert.ok(files.includes('manifest.json'), 'firefox zip missing manifest');
            assert.ok(files.includes('background.js'), 'firefox zip missing background.js');
        } finally {
            await fsp.rm(workspace, { recursive: true, force: true });
        }
    });

    test('build fails closed when a required asset is missing', async () => {
        const workspace = await makeWorkspace();
        await fsp.rm(path.join(workspace, 'app', 'fonts'), { recursive: true, force: true });
        try {
            assert.throws(
                () => execFileSync('node', ['app/build.js', 'chrome'], { cwd: workspace, stdio: 'pipe' }),
                /Required runtime asset not found/,
                'build must exit nonzero with a clear message when an asset is missing'
            );
        } finally {
            await fsp.rm(workspace, { recursive: true, force: true });
        }
    });
});

// ============================================================
// Static assets — manifests and locales are copied UNVALIDATED by
// build.js, so a JSON typo ships a silently broken extension.
// ============================================================
describe('static assets', () => {
    const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

    test('both manifests are valid and declare required fields', () => {
        const pkg = readJson(path.join(ROOT, 'package.json'));
        for (const file of ['manifest-chrome.json', 'manifest-firefox.json']) {
            const m = readJson(path.join(APP, file));
            assert.equal(m.manifest_version, 3, `${file} must be MV3`);
            assert.ok(typeof m.name === 'string' && m.name, `${file} needs a name`);
            assert.ok(/^\d+\.\d+\.\d+/.test(m.version), `${file} version must look semver-ish`);
            assert.equal(m.version, pkg.version, `${file} version drifted from package.json`);
            assert.ok(m.default_locale, `${file} must declare default_locale`);
        }
    });

    test('every locale messages.json parses and the default locale exists', () => {
        const localesDir = path.join(APP, '_locales');
        const codes = fs.readdirSync(localesDir, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name);
        assert.ok(codes.includes('en'), 'default locale _locales/en must exist');
        for (const code of codes) {
            const file = path.join(localesDir, code, 'messages.json');
            assert.ok(fs.existsSync(file), `${code} is missing messages.json`);
            readJson(file); // a JSON syntax error here silently breaks i18n for this language
        }
    });
});

// ============================================================
// URL allowlist — gates which tabs receive content scripts
// ============================================================
describe('isSupportedUrl (background.js)', () => {
    const isSupportedUrl = loadIsSupportedUrl();

    test('allows only http and https', () => {
        assert.equal(isSupportedUrl('http://example.com'), true);
        assert.equal(isSupportedUrl('https://example.com/path?q=1'), true);
    });

    test('rejects privileged and non-web schemes', () => {
        const unsupported = [
            'chrome://extensions',
            'about:addons',
            'view-source:https://example.com',
            'file:///etc/hosts',
            'data:text/html,<p>x</p>',
            'moz-extension://abc/popup.html',
            'edge://settings',
        ];
        for (const url of unsupported) {
            assert.equal(isSupportedUrl(url), false, `${url} must be unsupported`);
        }
    });

    test('rejects missing or non-string input', () => {
        assert.equal(isSupportedUrl(undefined), false);
        assert.equal(isSupportedUrl(null), false);
        assert.equal(isSupportedUrl(''), false);
    });
});

// ---------- helpers ----------

function zipList(zipPath) {
    return execFileSync('zipinfo', ['-1', zipPath], { encoding: 'utf8' })
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);
}

async function copyDir(src, dest) {
    await fsp.mkdir(dest, { recursive: true });
    for (const entry of await fsp.readdir(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        const d = path.join(dest, entry.name);
        if (entry.isDirectory()) await copyDir(s, d);
        else await fsp.copyFile(s, d);
    }
}

// Loads background.js in a sandbox with a permissive `browser` stub so the
// top-level listener registrations no-op. Returns the extracted function.
function loadIsSupportedUrl() {
    const source = fs.readFileSync(path.join(APP, 'background.js'), 'utf8');
    const stub = function () {};
    const browser = new Proxy(stub, {
        get(target, prop) {
            if (typeof prop === 'symbol') return undefined;
            if (prop in target) return target[prop];
            return browser;
        }
    });
    const sandbox = { browser };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    assert.equal(typeof sandbox.isSupportedUrl, 'function', 'background.js must define isSupportedUrl at top level');
    return sandbox.isSupportedUrl;
}
