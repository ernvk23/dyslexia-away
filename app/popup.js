// i18n translation runs as microtask to avoid blocking UI initialization
function translatePage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const msg = browser.i18n.getMessage(el.getAttribute('data-i18n'));
        if (msg) el.textContent = msg;
    });

    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
        const msg = browser.i18n.getMessage(el.getAttribute('data-i18n-aria'));
        if (msg) el.setAttribute('aria-label', msg);
    });
}

Promise.resolve().then(translatePage);

const DEFAULTS = {
    enabled: false,
    letterSpacing: 0,
    wordSpacing: 0,
    lineHeight: 140,
    excludedDomains: [],
    theme: 'system',
    fontMode: 'andika'
};

const RESTRICTED = ['chrome://', 'chrome-extension://', 'moz-extension://', 'file://', 'about:', 'edge://', 'brave://', 'data:'];

// Debounce timeouts
const DEBOUNCE_SLIDER_INPUT = 10;   // Live visual updates while dragging
const DEBOUNCE_STORAGE_SAVE = 100;  // Storage writes (unified for all)
const DEBOUNCE_BACKGROUND_UPDATE = 100; // Background tab updates

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
    themeToggle: document.getElementById('themeToggleBtn'),
    fontModeSelect: document.getElementById('fontModeSelect')
};

let currentDomain = null;
let sliderTimeout = null;
let storageSaveTimeout = null;
let backgroundUpdateTimeout = null;

browser.storage.local.get(Object.keys(DEFAULTS)).then(result => {
    const settings = { ...DEFAULTS, ...result };

    updateToggleUI(settings.enabled);
    els.letterSlider.value = settings.letterSpacing;
    els.wordSlider.value = settings.wordSpacing;
    els.lineSlider.value = settings.lineHeight;
    els.fontModeSelect.value = settings.fontMode;

    applyTheme(settings.theme);
    updateDisplayValues();
    initExclusion(settings.excludedDomains, settings.enabled);
});

async function initExclusion(excludedDomains, enabled) {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

    if (tab?.url && !RESTRICTED.some(p => tab.url.startsWith(p))) {
        const url = new URL(tab.url);
        currentDomain = url.hostname;

        // Check all frames for excluded hostnames (handles iframes)
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
        return [...new Set(hostnames)];
    } catch (e) {
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

    // Exclude/include all frames in this tab
    const hostnames = await getAllHostnamesInTab();
    if (hostnames.length === 0) {
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
    // Input event: fires while dragging (~60 times/sec)
    slider.addEventListener('input', () => {
        updateDisplayValues();

        clearTimeout(sliderTimeout);
        sliderTimeout = setTimeout(() => {
            updateCurrentTabStyles(getCurrentSettings());
        }, DEBOUNCE_SLIDER_INPUT);
    }, { passive: true });

    // Change event: fires once on release (discrete action)
    slider.addEventListener('change', () => {
        clearTimeout(sliderTimeout);
        updateCurrentTabStyles(getCurrentSettings());

        clearTimeout(storageSaveTimeout);
        storageSaveTimeout = setTimeout(() => {
            saveSettingsAndBroadcast();
        }, DEBOUNCE_STORAGE_SAVE);
    }, { passive: true });

    // Wheel event: allow scrolling on sliders for fine control
    slider.addEventListener('wheel', (e) => {
        if (slider.disabled) {
            return;
        }

        e.preventDefault();
        const step = parseInt(slider.step) || 1;
        const delta = -Math.sign(e.deltaY);
        let val = parseInt(slider.value) + (delta * step);
        val = Math.max(parseInt(slider.min), Math.min(parseInt(slider.max), val));
        slider.value = val;

        updateDisplayValues();

        clearTimeout(sliderTimeout);
        sliderTimeout = setTimeout(() => {
            updateCurrentTabStyles(getCurrentSettings());
        }, DEBOUNCE_SLIDER_INPUT);

        clearTimeout(storageSaveTimeout);
        storageSaveTimeout = setTimeout(() => {
            saveSettingsAndBroadcast();
        }, DEBOUNCE_STORAGE_SAVE);
    }, { passive: false });
});

els.fontModeSelect.addEventListener('change', () => {
    const fontMode = els.fontModeSelect.value;
    updateCurrentTabStyles({ fontMode });

    clearTimeout(storageSaveTimeout);
    storageSaveTimeout = setTimeout(() => {
        saveSettingsAndBroadcast();
    }, DEBOUNCE_STORAGE_SAVE);
});

function getCurrentSettings() {
    return {
        letterSpacing: parseInt(els.letterSlider.value),
        wordSpacing: parseInt(els.wordSlider.value),
        lineHeight: parseInt(els.lineSlider.value),
        fontMode: els.fontModeSelect.value
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

        // If content script isn't loaded, inject it
        if (!response) {
            injectContentScript(tab.id).then(() => {
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
    clearTimeout(backgroundUpdateTimeout);
    backgroundUpdateTimeout = setTimeout(() => {
        browser.runtime.sendMessage({ action: 'UPDATE_BACKGROUND_TABS' });
    }, DEBOUNCE_BACKGROUND_UPDATE);
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
    const enabledPromise = browser.storage.local.get('enabled');

    // Reset UI to defaults
    els.letterSlider.value = DEFAULTS.letterSpacing;
    els.wordSlider.value = DEFAULTS.wordSpacing;
    els.lineSlider.value = DEFAULTS.lineHeight;
    els.fontModeSelect.value = DEFAULTS.fontMode;
    updateDisplayValues();
    applyTheme(DEFAULTS.theme);
    els.exclude.checked = false;

    const contentSettings = {
        ...getCurrentSettings(),
        excludedDomains: []
    };

    const { enabled } = await enabledPromise;
    if (currentDomain) {
        updateSlidersState(false, enabled);
        updateCurrentTabStyles(contentSettings);
    }

    const storageSettings = {
        ...contentSettings,
        theme: DEFAULTS.theme
    };

    browser.storage.local.set(storageSettings);
    scheduleBackgroundUpdate();
});

function applyTheme(theme) {
    if (theme === 'system') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', theme);
    }
}