const DEFAULTS = {
    enabled: false,
    letterSpacing: 0,
    wordSpacing: 0,
    lineHeight: 140,
    excludedDomains: [],
    fontMode: 'andika',
    theme: 'system'
};

const RESTRICTED = ['chrome://', 'chrome-extension://', 'moz-extension://', 'file://', 'about:', 'edge://', 'brave://', 'data:'];

let state = { ...DEFAULTS };

async function initState() {
    const result = await browser.storage.local.get(Object.keys(DEFAULTS));
    state = { ...DEFAULTS, ...result };
}

async function initStateWithDefaultsOnly() {
    state = { ...DEFAULTS };
    await browser.storage.local.set(DEFAULTS);
}

browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
        // Fresh install: set defaults
        await initStateWithDefaultsOnly();
    } else {
        // Update: preserve existing settings
        await initState();
    }

    updateBadge(state.enabled);
    if (state.enabled) updateAllTabs();
});

browser.runtime.onStartup.addListener(async () => {
    await initState();
    updateBadge(state.enabled);
});

browser.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== 'local') return;

    for (const [key, { newValue }] of Object.entries(changes)) {
        if (key in state) state[key] = newValue;
    }

    if (changes.enabled) updateBadge(state.enabled);
    if (changes.enabled || changes.excludedDomains) updateBackgroundTabs();
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'UPDATE_BACKGROUND_TABS') {
        updateBackgroundTabs();
    }
});

async function updateAllTabs() {
    const tabs = await browser.tabs.query({});
    tabs.forEach(injectOrReinitialize);
}

async function updateBackgroundTabs() {
    // Parallel queries for efficiency - don't update active tab (already updated by popup)
    const [tabs, [activeTab]] = await Promise.all([
        browser.tabs.query({}),
        browser.tabs.query({ active: true, currentWindow: true })
    ]);

    tabs.forEach(tab => {
        if (!activeTab || tab.id !== activeTab.id) {
            injectOrReinitialize(tab);
        }
    });
}

async function injectOrReinitialize(tab) {
    if (!tab.url || RESTRICTED.some(prefix => tab.url.startsWith(prefix))) return;

    // Try to reinitialize existing content script first (faster than re-injection)
    const response = await browser.tabs.sendMessage(tab.id, { action: 'REINITIALIZE' }).catch(() => null);

    // If content script not loaded, inject it
    if (!response) {
        browser.scripting.insertCSS({
            target: { tabId: tab.id, allFrames: true },
            files: ['fonts.css', 'style.css']
        }).then(() =>
            browser.scripting.executeScript({
                target: { tabId: tab.id, allFrames: true },
                files: ['content.js']
            })
        ).catch(() => { });
    }
}

function updateBadge(enabled) {
    browser.action.setBadgeText({ text: enabled ? 'on' : '' });
    browser.action.setBadgeBackgroundColor({ color: '#0ea5e9' });
}