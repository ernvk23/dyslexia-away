const DEFAULTS = { enabled: false, letterSpacing: 0, wordSpacing: 0, lineHeight: 140, excludedDomains: [], fontMode: 'andika', theme: 'system' };
const RESTRICTED = ['chrome://', 'chrome-extension://', 'moz-extension://', 'file://', 'about:', 'edge://', 'brave://', 'data:'];

browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.enabled) updateBadge(changes.enabled.newValue);
});

browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') await browser.storage.local.set(DEFAULTS);
    const { enabled } = await browser.storage.local.get('enabled');
    updateBadge(enabled);
    // Inject into tabs already open when the extension is installed or updated
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
});

async function ensureInjected(tabId, tabUrl) {
    const url = tabUrl || (await browser.tabs.get(tabId).catch(() => null))?.url;
    if (!url || RESTRICTED.some(p => url.startsWith(p))) return;

    // If alive, storage.onChanged listener is already running — nothing else needed
    const alive = await browser.tabs.sendMessage(tabId, { action: 'PING' }).catch(() => false);
    if (alive) return;

    // Not alive — inject into main frame and all iframes; content.js auto-runs init()
    try {
        await browser.scripting.insertCSS({ target: { tabId, allFrames: true }, files: ['fonts.css', 'style.css'] });
        await browser.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['content.js'] });
    } catch (e) { /* protected page or tab closed */ }
}

function updateBadge(enabled) {
    browser.action.setBadgeText({ text: enabled ? 'on' : '' });
    browser.action.setBadgeBackgroundColor({ color: '#0ea5e9' });
}
