// Initialize state on install
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['enabled', 'letterSpacing', 'wordSpacing', 'lineHeight', 'fontSize', 'excludedDomains'], (result) => {
        const defaults = {
            enabled: result.enabled !== undefined ? result.enabled : false,
            letterSpacing: result.letterSpacing !== undefined ? result.letterSpacing : -30,
            wordSpacing: result.wordSpacing !== undefined ? result.wordSpacing : -100,
            lineHeight: result.lineHeight !== undefined ? result.lineHeight : 140,
            fontSize: result.fontSize !== undefined ? result.fontSize : 100,
            excludedDomains: result.excludedDomains !== undefined ? result.excludedDomains : []
        };
        chrome.storage.local.set(defaults);

        // Set badge on install
        if (defaults.enabled) {
            chrome.action.setBadgeText({ text: 'ON' });
            chrome.action.setBadgeBackgroundColor({ color: '#b8860b' });
        }
    });
});

// Set badge on startup
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get('enabled', (result) => {
        if (result.enabled) {
            chrome.action.setBadgeText({ text: 'ON' });
            chrome.action.setBadgeBackgroundColor({ color: '#b8860b' });
        } else {
            chrome.action.setBadgeText({ text: '' });
        }
    });
});

// Helper function to check if URL is restricted
function isRestrictedUrl(url) {
    const restrictedProtocols = ['chrome://', 'chrome-extension://', 'file://', 'about:', 'edge://'];
    return restrictedProtocols.some(protocol => url.startsWith(protocol));
}

// Handle reload requests from content scripts (legacy - probably not needed anymore)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'reloadTab') {
        if (message.tabId) {
            console.log(`Background: Reloading tab ${message.tabId} due to request`);
            chrome.tabs.reload(message.tabId);
        } else if (sender.tab && sender.tab.id) {
            console.log(`Background: Reloading sender tab ${sender.tab.id} due to request`);
            chrome.tabs.reload(sender.tab.id);
        }
        sendResponse({ success: true });
    }
    return true;
});