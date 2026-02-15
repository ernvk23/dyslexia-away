const DEFAULTS = { enabled: false, letterSpacing: 0, wordSpacing: 0, lineHeight: 140, excludedDomains: [], fontMode: 'andika', theme: 'system' };
const RESTRICTED = ['chrome://', 'chrome-extension://', 'moz-extension://', 'file://', 'about:', 'edge://', 'brave://', 'data:'];

// Sync badge with enabled state
browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.enabled) updateBadge(changes.enabled.newValue);
});

browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') await browser.storage.local.set(DEFAULTS);

    const { enabled } = await browser.storage.local.get('enabled');
    updateBadge(enabled);

    // Inject into all open tabs in parallel
    const tabs = await browser.tabs.query({});
    Promise.allSettled(tabs.map(injectOrReinitialize));
});

browser.runtime.onStartup.addListener(async () => {
    const { enabled } = await browser.storage.local.get('enabled');
    updateBadge(enabled);
});

async function injectOrReinitialize(tab) {
    if (!tab.url || RESTRICTED.some(p => tab.url.startsWith(p))) return;

    // Ping existing script to avoid duplicate injection
    const isAlive = await browser.tabs.sendMessage(tab.id, { action: 'REINITIALIZE' }).catch(() => false);
    if (isAlive) return;

    try {
        // Await CSS so the environment is ready before logic runs
        await browser.scripting.insertCSS({
            target: { tabId: tab.id, allFrames: true },
            files: ['fonts.css', 'style.css']
        });
        await browser.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            files: ['content.js']
        });
    } catch (e) {
        // Ignore errors for restricted or closed tabs
    }
}

function updateBadge(enabled) {
    browser.action.setBadgeText({ text: enabled ? 'on' : '' });
    browser.action.setBadgeBackgroundColor({ color: '#0ea5e9' });
}