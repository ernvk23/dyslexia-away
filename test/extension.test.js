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

    test('chrome zip contains required assets', async () => {
        const workspace = await makeWorkspace();
        try {
            execFileSync('node', ['app/build.js', 'chrome'], { cwd: workspace, stdio: 'pipe' });
            const files = zipList(path.join(workspace, 'dist', 'dyslexia-away-chrome.zip'));
            for (const required of ['manifest.json', 'background.js', 'content.js', 'popup.js', 'popup.html', 'style.css', 'fonts.css']) {
                assert.ok(files.includes(required), `chrome zip missing required file: ${required}`);
            }
            assert.ok(files.some(f => f.startsWith('fonts/Andika')), 'chrome zip missing font assets');
            assert.ok(files.some(f => f.startsWith('_locales/en/')), 'chrome zip missing default locale');
        } finally {
            await fsp.rm(workspace, { recursive: true, force: true });
        }
    });

    test('firefox zip uses the shared background entry', async () => {
        const workspace = await makeWorkspace();
        try {
            execFileSync('node', ['app/build.js', 'firefox'], { cwd: workspace, stdio: 'pipe' });
            const files = zipList(path.join(workspace, 'dist', 'dyslexia-away-firefox.zip'));
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

    test('both builds use the shared runtime entry', () => {
        for (const file of ['manifest-chrome.json', 'manifest-firefox.json']) {
            const m = readJson(path.join(APP, file));
            assert.deepEqual(m.content_scripts[0].js, ['content.js']);
        }

        const firefox = readJson(path.join(APP, 'manifest-firefox.json'));
        const chrome = readJson(path.join(APP, 'manifest-chrome.json'));
        assert.equal(chrome.minimum_chrome_version, '99');
        assert.equal(chrome.background.service_worker, 'background.js');
        assert.deepEqual(firefox.background.scripts, ['background.js']);
        for (const file of ['background.js', 'content.js', 'popup.js']) {
            assert.match(fs.readFileSync(path.join(APP, file), 'utf8'), /if \(!globalThis\.browser\) globalThis\.browser = chrome;/);
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

describe('content lifecycle', () => {
    test('supports Firefox and pre-148 Chrome without duplicate listeners', async () => {
        const source = fs.readFileSync(path.join(APP, 'content.js'), 'utf8');
        for (const namespace of ['browser', 'chrome']) {
            const listeners = { storage: 0, message: 0, window: 0, document: 0 };
            const noop = () => {};
            const root = {
                classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
                style: { setProperty: noop, removeProperty: noop, getPropertyValue: () => '' }
            };
            const extensionApi = {
                storage: {
                    local: { get: () => Promise.resolve({}) },
                    onChanged: { addListener: () => listeners.storage++ }
                },
                runtime: {
                    sendMessage: () => Promise.resolve('example.com'),
                    onMessage: { addListener: () => listeners.message++ }
                }
            };
            const sandbox = {
                [namespace]: extensionApi,
                location: { hostname: 'example.com' },
                document: {
                    documentElement: root,
                    readyState: 'complete',
                    addEventListener: () => listeners.document++
                },
                window: { addEventListener: () => listeners.window++ },
                MutationObserver: class { observe() {} disconnect() {} },
                requestAnimationFrame(callback) { callback(); return 1; }
            };
            if (namespace === 'browser') {
                Object.defineProperty(sandbox, 'chrome', {
                    get: () => { throw new Error('Firefox path must not access chrome'); }
                });
            }
            vm.createContext(sandbox);

            vm.runInContext(source, sandbox);
            vm.runInContext(source, sandbox);
            await new Promise(resolve => setImmediate(resolve));

            assert.deepEqual(listeners, { storage: 1, message: 1, window: 1, document: 2 }, namespace);
        }
    });
});

// Use the site's font stack for unsupported glyphs.
describe('original font fallback', () => {
    test('style.css chains the site stack after the bundled font', () => {
        const css = fs.readFileSync(path.join(APP, 'style.css'), 'utf8');
        const decls = css.match(/font-family:\s*var\(--da-font-family\)[^;]*;/g) || [];
        assert.equal(decls.length, 4, 'all font-family overrides must share the chain');
        for (const decl of decls) {
            assert.match(decl, /var\(--da-original-font, sans-serif\)/);
        }
    });

    test('captures the body font stack as --da-original-font', async () => {
        const computed = '"Noto Sans JP", Arial, sans-serif';
        const h = createFontHarness({ settings: { enabled: true, fontMode: 'lexend' }, body: {}, computedFont: computed });
        await flush();
        assert.equal(h.props.get('--da-original-font'), computed);
    });

    test('reuses the fallback for settings updates and recaptures after re-enabling', async () => {
        let reads = 0, font = 'serif';
        const h = createFontHarness({ settings: { enabled: true }, body: {}, computedFont: () => { reads++; return font; } });
        await flush();
        assert.equal(reads, 1);
        font = 'Arial, sans-serif';
        for (const changes of [{ letterSpacing: 10 }, { fontMode: 'lexend' }]) {
            h.changeSettings(changes);
            await flush();
        }
        assert.equal(h.props.get('--da-letter-spacing'), '0.010em');
        assert.equal(h.props.get('--da-font-family'), 'Lexend');
        assert.equal(h.props.get('--da-original-font'), 'serif');
        assert.equal(reads, 1);
        h.changeSettings({ enabled: false });
        await flush();
        h.changeSettings({ enabled: true });
        await flush();
        assert.equal(h.props.get('--da-original-font'), font);
        assert.equal(reads, 2);
    });

    test('refreshes on Turbo navigation and BFCache restoration', async () => {
        let font = 'serif';
        const h = createFontHarness({ settings: { enabled: true }, body: {}, computedFont: () => font });
        await flush();
        for (const event of ['turbo:render', 'turbo:load']) {
            font = `${event}, sans-serif`;
            h.dispatchDocument(event);
            await flush();
            assert.equal(h.props.get('--da-original-font'), font);
        }
        font = 'Arial, sans-serif';
        h.dispatchWindow('pageshow', { persisted: false });
        await flush();
        assert.equal(h.props.get('--da-original-font'), 'turbo:load, sans-serif');
        h.dispatchWindow('pageshow', { persisted: true });
        await flush();
        assert.equal(h.props.get('--da-original-font'), font);
    });

    test('applies early and refreshes at DOMContentLoaded and load', async () => {
        let font = 'serif';
        const h = createFontHarness({ settings: { enabled: true, fontMode: 'lexend' }, body: {}, computedFont: () => font, readyState: 'loading' });
        await flush();
        assert.equal(h.classes.has('d-away-active'), true);
        assert.equal(h.props.get('--da-original-font'), 'serif');
        font = 'Arial, sans-serif';
        h.dispatchDocument('DOMContentLoaded');
        await flush();
        assert.equal(h.props.get('--da-original-font'), font);

        const writesBeforeLoad = h.writes.length;
        font = '"Noto Sans JP", sans-serif';
        h.dispatchWindow('load');
        await flush();
        assert.equal(h.props.get('--da-original-font'), font);
        assert.deepEqual(h.writes.slice(writesBeforeLoad), [['--da-original-font', font]]);
    });

    test('captures at DOMContentLoaded when the body was initially missing', async () => {
        const h = createFontHarness({ settings: { enabled: true, fontMode: 'lexend' }, computedFont: 'serif', readyState: 'loading' });
        await flush();
        assert.equal(h.classes.has('d-away-active'), true);
        assert.equal(h.props.has('--da-original-font'), false);
        h.document.body = {};
        h.dispatchDocument('DOMContentLoaded');
        await flush();
        assert.equal(h.props.get('--da-original-font'), 'serif');
        assert.equal(h.classes.has('d-away-active'), true);
    });

    test('does not rewrite an unchanged fallback at load', async () => {
        const h = createFontHarness({ settings: { enabled: true }, body: {}, computedFont: 'serif', readyState: 'interactive' });
        await flush();
        assert.equal(h.classes.has('d-away-active'), true);
        const writesBeforeLoad = h.writes.length;
        h.dispatchWindow('load');
        await flush();
        assert.equal(h.writes.length, writesBeforeLoad);
    });

    test('load does not restore a fallback after disabling or excluding the page', async () => {
        for (const changes of [{ enabled: { newValue: false } }, { excludedDomains: { newValue: ['example.com'] } }]) {
            const h = createFontHarness({ settings: { enabled: true }, body: {}, computedFont: 'serif', readyState: 'interactive' });
            await flush();
            h.changeSettings(changes);
            await flush();
            assert.equal(h.classes.has('d-away-active'), false);
            assert.equal(h.props.has('--da-original-font'), false);
            const writesBeforeLoad = h.writes.length;
            h.dispatchWindow('load');
            await flush();
            assert.equal(h.writes.length, writesBeforeLoad);
            assert.equal(h.props.has('--da-original-font'), false);
        }
    });

    test('injection after load captures immediately without registering past events', async () => {
        const h = createFontHarness({ settings: { enabled: true }, body: {}, computedFont: 'serif', readyState: 'complete' });
        await flush();
        assert.equal(h.classes.has('d-away-active'), true);
        assert.equal(h.props.get('--da-original-font'), 'serif');
        assert.equal(h.documentListeners.some(([type]) => type === 'DOMContentLoaded'), false);
        assert.equal(h.windowListeners.some(([type]) => type === 'load'), false);
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

async function flush() {
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
}

// Runs content.js in a fresh sandbox with a recording root element.
function createFontHarness({ settings = {}, body = null, computedFont = '', readyState = 'complete' } = {}) {
    const source = fs.readFileSync(path.join(APP, 'content.js'), 'utf8');
    const props = new Map();
    const classes = new Set();
    const documentListeners = [];
    const windowListeners = [];
    const storageListeners = [];
    const writes = [];
    let rafSequence = 0;
    const root = {
        classList: {
            add: (c) => classes.add(c),
            remove: (...cs) => cs.forEach(c => classes.delete(c)),
            toggle: (c, on) => { if (on) classes.add(c); else classes.delete(c); },
            contains: (c) => classes.has(c)
        },
        style: {
            setProperty: (k, v) => { props.set(k, v); writes.push([k, v]); },
            removeProperty: (k) => props.delete(k),
            getPropertyValue: (k) => props.get(k) || ''
        }
    };
    const sandbox = {
        browser: {
            storage: {
                local: { get: () => Promise.resolve(settings) },
                onChanged: { addListener: (fn) => storageListeners.push(fn) }
            },
            runtime: {
                sendMessage: () => Promise.resolve('example.com'),
                onMessage: { addListener: () => {} }
            }
        },
        location: { hostname: 'example.com' },
        document: {
            documentElement: root,
            body,
            readyState,
            addEventListener: (type, fn, options) => documentListeners.push([type, fn, options])
        },
        window: { addEventListener: (type, fn, options) => windowListeners.push([type, fn, options]) },
        getComputedStyle: () => ({ fontFamily: typeof computedFont === 'function' ? computedFont() : computedFont }),
        MutationObserver: class { observe() {} disconnect() {} },
        requestAnimationFrame(callback) { setImmediate(callback); return ++rafSequence; }
    };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    function dispatch(listeners, type, event = {}) {
        for (const listener of listeners.filter(([event]) => event === type)) {
            const [, fn, options] = listener;
            if (options?.once) listeners.splice(listeners.indexOf(listener), 1);
            fn(event);
        }
    }
    return {
        props, classes, writes, documentListeners, windowListeners, document: sandbox.document,
        dispatchDocument(type) {
            if (type === 'DOMContentLoaded') sandbox.document.readyState = 'interactive';
            dispatch(documentListeners, type);
        },
        dispatchWindow(type, event) {
            if (type === 'load') sandbox.document.readyState = 'complete';
            dispatch(windowListeners, type, event);
        },
        changeSettings(changes) { storageListeners.forEach(fn => fn(changes, 'local')); }
    };
}
