// i18n Translation - Works in both Chrome and Firefox
function translatePage() {
    // Translate text content using data-i18n attributes
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const msg = browser.i18n.getMessage(el.getAttribute('data-i18n'));
        if (msg) el.textContent = msg;
    });

    // Translate aria-labels using data-i18n-aria attributes
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
        const msg = browser.i18n.getMessage(el.getAttribute('data-i18n-aria'));
        if (msg) el.setAttribute('aria-label', msg);
    });
}

// Run translation as microtask to not block UI initialization
Promise.resolve().then(translatePage);

const DEFAULTS = {
    enabled: false,
    letterSpacing: 0,
    wordSpacing: 0,
    lineHeight: 140,
    excludedDomains: [],
    theme: 'system'
};

const RESTRICTED = ['chrome://', 'chrome-extension://', 'moz-extension://', 'file://', 'about:', 'edge://', 'brave://', 'data:'];

const sliders = ['letterSpacing', 'wordSpacing', 'lineHeight'];
const els = {
    toggle: document.getElementById('toggleBtn'),
    letterSlider: document.getElementById('letterSpacing'),
    wordSlider: document.getElementById('wordSpacing'),
    lineSlider: document.getElementById('lineHeight'),
    letterVal: document.getElementById('letterValue'),
    wordVal: document.getElementById('wordValue'),
    lineVal: document.getElementById('lineValue'),
    reset: document.getElementById('resetBtn'),
    exclude: document.getElementById('excludeSite'),
    themeToggle: document.getElementById('themeToggleBtn')
};

let currentDomain = null;
let sliderTimeout = null;
let backgroundUpdateTimeout = null;
let storageSaveTimeout = null;

browser.storage.local.get(Object.keys(DEFAULTS)).then(result => {
    const settings = { ...DEFAULTS, ...result };

    updateToggleUI(settings.enabled);
    els.letterSlider.value = settings.letterSpacing;
    els.wordSlider.value = settings.wordSpacing;
    els.lineSlider.value = settings.lineHeight;

    applyTheme(settings.theme);
    updateDisplayValues();
    initExclusion(settings.excludedDomains, settings.enabled);
});

async function initExclusion(excludedDomains, enabled) {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

    if (tab?.url && !RESTRICTED.some(p => tab.url.startsWith(p))) {
        const url = new URL(tab.url);
        currentDomain = url.hostname;

        // Determine if any hostname in this tab is excluded
        const hostnames = await getAllHostnamesInTab();
        const isExcluded = hostnames.some(hostname => excludedDomains.includes(hostname));

        els.exclude.checked = isExcluded;
        els.exclude.disabled = false;
        updateSlidersState(isExcluded, enabled);
    } else {
        els.exclude.disabled = true;
        updateSlidersState(true, enabled);
    }
}

function updateDisplayValues() {
    els.letterVal.textContent = formatEm(els.letterSlider.value);
    els.wordVal.textContent = formatEm(els.wordSlider.value);
    const lineHeightValue = (els.lineSlider.value / 100).toFixed(2);
    els.lineVal.textContent = lineHeightValue === '-0.00' ? '0.00' : lineHeightValue;
}

async function getAllHostnamesInTab() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return [];

    try {
        const results = await browser.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            func: () => window.location.hostname
        });
        const hostnames = results.map(r => r.result).filter(Boolean);
        const unique = [...new Set(hostnames)];
        return unique;
    } catch (e) {
        console.error('Failed to query frames:', e);
        return [];
    }
}

function formatEm(value) {
    const result = value / 1000;
    const fixedResult = result.toFixed(2);
    return fixedResult === '-0.00' ? '0.00 em' : fixedResult + ' em';
}

function updateToggleUI(enabled) {
    els.toggle.classList.toggle('active', enabled);

    // Get current exclusion state and update sliders accordingly
    const isExcluded = currentDomain && (els.exclude.checked || false);
    updateSlidersState(isExcluded, enabled);
}

function updateSlidersState(isExcluded, isEnabled) {
    const disabled = !isEnabled || isExcluded;

    [els.letterSlider, els.wordSlider, els.lineSlider].forEach(s => {
        s.disabled = disabled;
        s.classList.toggle('active', !disabled);
    });
}

els.toggle.addEventListener('click', async (e) => {
    e.preventDefault();
    const { enabled } = await browser.storage.local.get('enabled');
    const newState = !enabled;

    updateToggleUI(newState);
    updateCurrentTabStyles({ enabled: newState });
    browser.storage.local.set({ enabled: newState });
    scheduleBackgroundUpdate();
});

els.exclude.addEventListener('change', async () => {
    if (!currentDomain) return;

    const { excludedDomains, enabled } = await browser.storage.local.get(['excludedDomains', 'enabled']);
    let domains = excludedDomains || [];

    const hostnames = await getAllHostnamesInTab();
    if (hostnames.length === 0) {
        // fallback to top-level domain
        hostnames.push(currentDomain);
    }

    if (els.exclude.checked) {
        hostnames.forEach(hostname => {
            if (!domains.includes(hostname)) {
                domains.push(hostname);
            }
        });
    } else {
        hostnames.forEach(hostname => {
            domains = domains.filter(d => d !== hostname);
        });
    }

    updateCurrentTabStyles({ excludedDomains: domains });
    browser.storage.local.set({ excludedDomains: domains });
    scheduleBackgroundUpdate();
    updateSlidersState(els.exclude.checked, enabled);
});

[els.letterSlider, els.wordSlider, els.lineSlider].forEach(slider => {
    slider.addEventListener('input', () => {
        updateDisplayValues();

        if (sliderTimeout) clearTimeout(sliderTimeout);
        sliderTimeout = setTimeout(() => {
            updateCurrentTabStyles(getCurrentSettings());
            sliderTimeout = null;
        }, 10);
    }, { passive: true });

    slider.addEventListener('change', () => {
        if (sliderTimeout) {
            clearTimeout(sliderTimeout);
            sliderTimeout = null;
        }
        updateCurrentTabStyles(getCurrentSettings());

        // Debounced storage update - only the last one wins
        if (storageSaveTimeout) clearTimeout(storageSaveTimeout);
        storageSaveTimeout = setTimeout(() => {
            saveSettingsAndBroadcast();
            storageSaveTimeout = null;
        }, 500);
    }, { passive: true }); // Can be passive since we don't call preventDefault()

    slider.addEventListener('wheel', (e) => {
        e.preventDefault();
        const step = parseInt(slider.step) || 1;
        const delta = -Math.sign(e.deltaY);
        let val = parseInt(slider.value) + (delta * step);
        val = Math.max(parseInt(slider.min), Math.min(parseInt(slider.max), val));
        slider.value = val;

        updateDisplayValues();

        // Update current tab styles with 10ms debounce
        if (sliderTimeout) clearTimeout(sliderTimeout);
        sliderTimeout = setTimeout(() => {
            updateCurrentTabStyles(getCurrentSettings());
            sliderTimeout = null;
        }, 10);

        // Schedule storage update only when wheel stops for 500ms
        if (storageSaveTimeout) clearTimeout(storageSaveTimeout);
        storageSaveTimeout = setTimeout(() => {
            saveSettingsAndBroadcast();
            storageSaveTimeout = null;
        }, 500);
    }, { passive: false });
});

function getCurrentSettings() {
    return {
        letterSpacing: parseInt(els.letterSlider.value),
        wordSpacing: parseInt(els.wordSlider.value),
        lineHeight: parseInt(els.lineSlider.value)
    };
}

async function updateCurrentTabStyles(settings) {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
        // Try to send message to content script
        const response = await browser.tabs.sendMessage(tab.id, {
            action: 'UPDATE_STYLES',
            settings: settings
        }).catch(() => null);

        // If content script isn't loaded, inject it and send message
        if (!response) {
            injectContentScript(tab.id).then(() => {
                // Send the message after injection to ensure current settings are applied
                browser.tabs.sendMessage(tab.id, {
                    action: 'UPDATE_STYLES',
                    settings: settings
                }).catch(() => { });
            });
        }
    }
}

function injectContentScript(tabId) {
    return Promise.all([
        browser.scripting.insertCSS({
            target: { tabId: tabId, allFrames: true },
            files: ['fonts.css', 'style.css']
        }).catch(() => { }),
        browser.scripting.executeScript({
            target: { tabId: tabId, allFrames: true },
            files: ['content.js']
        }).catch(() => { })
    ]);
}

function saveSettingsAndBroadcast() {
    browser.storage.local.set(getCurrentSettings());
    scheduleBackgroundUpdate();
}

function scheduleBackgroundUpdate() {
    if (backgroundUpdateTimeout) clearTimeout(backgroundUpdateTimeout);
    backgroundUpdateTimeout = setTimeout(() => {
        browser.runtime.sendMessage({ action: 'UPDATE_BACKGROUND_TABS' });
    }, 500);
}

els.themeToggle.addEventListener('click', async (e) => {
    e.preventDefault();
    const { theme: currentTheme } = await browser.storage.local.get('theme');
    const themes = ['system', 'light', 'dark'];
    const currentIndex = themes.indexOf(currentTheme || DEFAULTS.theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    applyTheme(nextTheme);
    browser.storage.local.set({ theme: nextTheme });
});

els.reset.addEventListener('click', async () => {
    els.letterSlider.value = DEFAULTS.letterSpacing;
    els.wordSlider.value = DEFAULTS.wordSpacing;
    els.lineSlider.value = DEFAULTS.lineHeight;

    applyTheme(DEFAULTS.theme);
    updateDisplayValues();

    const { enabled, excludedDomains } = await browser.storage.local.get(['enabled', 'excludedDomains']);
    updateCurrentTabStyles(getCurrentSettings());

    if (currentDomain) {
        const domains = (excludedDomains || []).filter(d => d !== currentDomain);
        els.exclude.checked = false;
        updateSlidersState(false, enabled);
        updateCurrentTabStyles({ excludedDomains: domains });
        browser.storage.local.set({ excludedDomains: domains });
    }

    browser.storage.local.set({ ...getCurrentSettings(), theme: DEFAULTS.theme });
    scheduleBackgroundUpdate();
});

function applyTheme(theme) {
    if (theme === 'system') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', theme);
    }
}