const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../app/popup.js'), 'utf8');
const restrictedTab = { id: 7, url: 'about:newtab' };
const supportedTab = { id: 7, url: 'https://example.com/' };

test('popup retains navigation before the initial tab query resolves', async () => {
    const h = createPopupHarness();
    h.navigate(supportedTab);
    h.navigate({ id: 8, url: 'https://other.com/' });
    await h.initialize();
    assert.equal(h.slider.disabled, false);
    assert.equal(h.exclude.disabled, false);
    assert.deepEqual(h.messages, [{ action: 'ENSURE_INJECTED', tabId: 7, tabUrl: supportedTab.url }]);
});

test('popup retains navigation while settings are loading', async () => {
    const h = createPopupHarness();
    h.resolveTab(restrictedTab);
    await flush();
    h.navigate(supportedTab);
    await h.initialize({ excludedDomains: ['example.com'] });
    assert.equal(h.exclude.disabled, false);
    assert.equal(h.exclude.checked, true);
    assert.equal(h.slider.disabled, true);
});

test('popup renders the latest URL when navigation precedes the first frame', async () => {
    const h = createPopupHarness();
    h.resolveTab(restrictedTab);
    h.resolveSettings({ enabled: true });
    await flush();
    h.navigate(supportedTab);
    await flush();
    h.render();
    assert.equal(h.slider.disabled, false);
    assert.equal(h.exclude.disabled, false);
});

test('popup tracks supported, excluded and restricted pages without reopening', async () => {
    const h = createPopupHarness();
    await h.initialize({ excludedDomains: ['excluded.com'] });
    assert.equal(h.slider.disabled, true);
    h.navigate(supportedTab);
    await flush();
    assert.equal(h.slider.disabled, false);
    assert.equal(h.exclude.disabled, false);
    h.navigate({ id: 7, url: 'https://excluded.com/' });
    await flush();
    assert.equal(h.slider.disabled, true);
    assert.equal(h.exclude.checked, true);
    h.navigate(restrictedTab);
    await flush();
    assert.equal(h.slider.disabled, true);
    assert.equal(h.exclude.checked, false);
    assert.equal(h.exclude.disabled, true);
    h.navigate(supportedTab);
    await flush();
    assert.equal(h.slider.disabled, false);
});

test('popup ignores other tabs and updates without a URL change', async () => {
    const h = createPopupHarness();
    h.resolveTab(supportedTab);
    await h.initialize();
    h.navigate({ id: 8, url: 'about:config' });
    h.navigate(restrictedTab, { status: 'complete' });
    await flush();
    assert.equal(h.slider.disabled, false);
    assert.equal(h.exclude.disabled, false);
    assert.equal(h.messages.length, 1);
});

test('navigation keeps sliders disabled when the extension is off', async () => {
    const h = createPopupHarness();
    await h.initialize({ enabled: false });
    h.navigate(supportedTab);
    await flush();
    assert.equal(h.slider.disabled, true);
    assert.equal(h.exclude.disabled, false);
});

test('popup requests injection at open only, not on later navigation', async () => {
    const h = createPopupHarness();
    await h.initialize();
    assert.equal(h.messages.length, 0);
    h.navigate(supportedTab);
    await flush();
    assert.equal(h.messages.length, 0);
    assert.equal(h.slider.disabled, false);
});

async function flush() {
    await new Promise(resolve => setImmediate(resolve));
}

function createPopupHarness() {
    const elements = new Map();
    const frames = new Map();
    const messages = [];
    let onUpdated, resolveTabs, resolveSettings, frameId = 0;
    const element = () => ({
        value: '0', min: '0', max: '100', step: '1',
        classList: { add() {}, remove() {}, toggle() {} },
        addEventListener() {}, setAttribute() {}
    });
    const getElement = id => {
        if (!elements.has(id)) elements.set(id, element());
        return elements.get(id);
    };
    const tabPromise = new Promise(resolve => { resolveTabs = resolve; });
    const settingsPromise = new Promise(resolve => { resolveSettings = resolve; });
    const sandbox = {
        browser: {
            tabs: {
                query: () => tabPromise,
                onUpdated: { addListener(fn) { onUpdated = fn; } }
            },
            storage: { local: { get: () => settingsPromise } },
            runtime: {
                sendMessage(message) {
                    messages.push(JSON.parse(JSON.stringify(message)));
                    return Promise.resolve();
                }
            }
        },
        document: {
            body: {}, documentElement: element(),
            getElementById: getElement, querySelector: getElement,
            querySelectorAll: () => [], addEventListener() {}
        },
        window: { addEventListener() {} },
        getComputedStyle: () => ({ borderTopLeftRadius: '0px' }),
        requestAnimationFrame(fn) { frames.set(++frameId, fn); return frameId; },
        cancelAnimationFrame(id) { frames.delete(id); },
        URL
    };
    vm.runInNewContext(source, sandbox);
    const render = () => {
        while (frames.size) {
            const [id, fn] = frames.entries().next().value;
            frames.delete(id);
            fn();
        }
    };
    return {
        slider: getElement('letterSpacing'), exclude: getElement('excludeSite'), messages,
        resolveTab: tab => resolveTabs([tab]), resolveSettings, render,
        navigate(tab, changes = { url: tab.url }) { onUpdated(tab.id, changes, tab); },
        async initialize(settings = {}) {
            resolveTabs([restrictedTab]);
            resolveSettings({ enabled: true, ...settings });
            await flush();
            render();
        }
    };
}
