chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['enabled', 'letterSpacing', 'wordSpacing', 'lineHeight', 'fontSize', 'excludedDomains'], (result) => {
        const defaults = {
            enabled: result.enabled ?? false,
            letterSpacing: result.letterSpacing ?? -30,
            wordSpacing: result.wordSpacing ?? -100,
            lineHeight: result.lineHeight ?? 140,
            fontSize: result.fontSize ?? 100,
            excludedDomains: result.excludedDomains ?? []
        };
        chrome.storage.local.set(defaults);

        if (defaults.enabled) {
            chrome.action.setBadgeText({ text: 'ON' });
            chrome.action.setBadgeBackgroundColor({ color: '#b8860b' });
        }
    });
});

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

function isRestrictedUrl(url) {
    const restrictedProtocols = ['chrome://', 'chrome-extension://', 'file://', 'about:', 'edge://'];
    return restrictedProtocols.some(protocol => url.startsWith(protocol));
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Validate message origin - only accept from this extension
    if (sender.id !== chrome.runtime.id) {
        return false;
    }

    if (message.action === 'reloadTab') {
        if (message.tabId) {
            chrome.tabs.reload(message.tabId);
        } else if (sender.tab && sender.tab.id) {
            chrome.tabs.reload(sender.tab.id);
        }
        sendResponse({ success: true });
    }
    return true;
});