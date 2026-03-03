const DEFAULTS = { enabled: false, letterSpacing: 0, wordSpacing: 0, lineHeight: 140, excludedDomains: [], fontMode: 'andika', theme: 'system', heartRated: false, installDate: null };
const RESTRICTED = ['chrome://', 'chrome-extension://', 'moz-extension://', 'file://', 'about:', 'edge://', 'brave://', 'data:'];

browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.enabled) updateBadge(changes.enabled.newValue);
});

browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
        await browser.storage.local.set({ ...DEFAULTS, installDate: Date.now() });
    } else if (details.reason === 'update') {
        const { heartRated, installDate } = await browser.storage.local.get(['heartRated', 'installDate']);
        if (heartRated === undefined) {
            await browser.storage.local.set({ heartRated: DEFAULTS.heartRated });
        }
        if (installDate === undefined) {
            await browser.storage.local.set({ installDate: Date.now() - 216000000 }); // Backdate to trigger review prompt
        }
    }
    const { enabled } = await browser.storage.local.get('enabled');
    updateBadge(enabled);
    const tabs = await browser.tabs.query({});
    Promise.allSettled(tabs.map(tab => ensureInjected(tab.id, tab.url)));
});

browser.runtime.onStartup.addListener(async () => {
    const { enabled } = await browser.storage.local.get('enabled');
    updateBadge(enabled);
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ENSURE_INJECTED') {
        ensureInjected(request.tabId, request.tabUrl)
            .then(() => sendResponse({ success: true }))
            .catch(() => sendResponse({ success: false }));
        return true; // Keep message channel open for async response
    }
    if (request.action === 'GET_TOP_HOST') {
        sendResponse(sender.tab?.url ? new URL(sender.tab.url).hostname : ''); // Get top-level hostname from tab URL
        return false;
    }
    if (request.action === 'SAVE_SETTINGS') {
        browser.storage.local.set(request.settings);
        return false;
    }
});

async function ensureInjected(tabId, tabUrl) {
    const url = tabUrl || (await browser.tabs.get(tabId).catch(() => null))?.url;
    if (!url || RESTRICTED.some(p => url.startsWith(p))) return;

    const alive = await browser.tabs.sendMessage(tabId, { action: 'PING' }).catch(() => false); // Check if content script is active
    if (alive) return;

    try {
        await browser.scripting.insertCSS({ target: { tabId, allFrames: true }, files: ['fonts.css', 'style.css'] });
        await browser.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['content.js'] });
    } catch (e) { } // Ignore protected pages or closed tabs
}

function updateBadge(enabled) {
    browser.action.setBadgeText({ text: enabled ? 'on' : '' });
    browser.action.setBadgeBackgroundColor({ color: '#0ea5e9' });
}