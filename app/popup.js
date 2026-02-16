const DEFAULTS = { enabled: false, letterSpacing: 0, wordSpacing: 0, lineHeight: 140, excludedDomains: [], theme: 'system', fontMode: 'andika' };
const RESTRICTED = ['chrome://', 'chrome-extension://', 'moz-extension://', 'file://', 'about:', 'edge://', 'brave://', 'data:'];

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
let storageSaveTimeout = null;
let settings = { ...DEFAULTS };

function injectContentScript(tabId) {
    browser.scripting.insertCSS({ target: { tabId: tabId, allFrames: true }, files: ['fonts.css', 'style.css'] }).catch(() => { });
    browser.scripting.executeScript({ target: { tabId: tabId, allFrames: true }, files: ['content.js'] }).catch(() => { });
}

browser.storage.local.get(Object.keys(DEFAULTS)).then(async result => {
    settings = { ...DEFAULTS, ...result };

    updateToggleUI(settings.enabled);
    els.letterSlider.value = settings.letterSpacing;
    els.wordSlider.value = settings.wordSpacing;
    els.lineSlider.value = settings.lineHeight;
    els.fontModeSelect.value = settings.fontMode;

    applyTheme(settings.theme);
    updateDisplayValues();

    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

    const isRestricted = !tab?.url || RESTRICTED.some(p => tab.url.startsWith(p));

    if (!isRestricted) {
        currentDomain = new URL(tab.url).hostname;
        const isExcluded = settings.excludedDomains.includes(currentDomain);
        els.exclude.checked = isExcluded;
        els.exclude.disabled = false;
        updateSlidersState(isExcluded, settings.enabled);

        // PING: Force active tab to sync its state immediately
        browser.tabs.sendMessage(tab.id, { action: 'REINITIALIZE' }).catch(() => {
            // Fallback: Inject if the script isn't running yet
            injectContentScript(tab.id);
        });
    } else {
        els.exclude.checked = false;
        els.exclude.disabled = true;
        updateSlidersState(true, settings.enabled);
    }
});

function updateDisplayValues() {
    const format = (val, div) => {
        const res = (val / div).toFixed(2);
        return res === "-0.00" ? "0.00" : res;
    };

    els.letterVal.textContent = format(els.letterSlider.value, 1000) + ' em';
    els.wordVal.textContent = format(els.wordSlider.value, 1000) + ' em';
    els.lineVal.textContent = format(els.lineSlider.value, 100);
}

function updateToggleUI(enabled) {
    els.toggle.classList.toggle('active', enabled);
    updateSlidersState(els.exclude.checked, enabled);
}

function updateSlidersState(isExcluded, isEnabled) {
    const isRestrictedPage = !currentDomain || RESTRICTED.some(p => currentDomain.startsWith(p));
    const slidersDisabled = !isEnabled || isExcluded || isRestrictedPage;

    [els.letterSlider, els.wordSlider, els.lineSlider].forEach(s => {
        s.disabled = slidersDisabled;
        s.classList.toggle('active', !slidersDisabled);
    });
    els.fontModeSelect.disabled = !isEnabled;
}

// Instant update to active tab and debounced storage write
let popupFrameId = null;
function broadcastChange(changedSettings) {
    Object.assign(settings, changedSettings);

    // Throttled messaging to active tab
    if (!popupFrameId) {
        popupFrameId = requestAnimationFrame(() => {
            browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
                if (tab?.id) {
                    browser.tabs.sendMessage(tab.id, {
                        action: 'UPDATE_STYLES',
                        settings: settings
                    }).catch(() => { });
                }
                popupFrameId = null;
            });
        });
    }

    clearTimeout(storageSaveTimeout);
    storageSaveTimeout = setTimeout(() => browser.storage.local.set(settings), 100);
}

els.toggle.addEventListener('click', () => {
    const newState = !settings.enabled;
    updateToggleUI(newState);
    broadcastChange({ enabled: newState });
});

els.exclude.addEventListener('change', () => {
    if (!currentDomain) return;
    let domains = new Set(settings.excludedDomains);
    els.exclude.checked ? domains.add(currentDomain) : domains.delete(currentDomain);

    const domainArray = Array.from(domains);
    updateSlidersState(els.exclude.checked, settings.enabled);
    broadcastChange({ excludedDomains: domainArray });
});

[els.letterSlider, els.wordSlider, els.lineSlider].forEach(slider => {
    slider.addEventListener('input', () => {
        updateDisplayValues();
        broadcastChange({
            letterSpacing: parseInt(els.letterSlider.value),
            wordSpacing: parseInt(els.wordSlider.value),
            lineHeight: parseInt(els.lineSlider.value)
        });
    }, { passive: true });

    slider.addEventListener('wheel', (e) => {
        if (slider.disabled) return;
        e.preventDefault();
        const step = parseInt(slider.step) || 1;
        slider.value = Math.max(parseInt(slider.min), Math.min(parseInt(slider.max), parseInt(slider.value) + (-Math.sign(e.deltaY) * step)));
        slider.dispatchEvent(new Event('input'));
    }, { passive: false });
});

els.fontModeSelect.addEventListener('change', () => {
    broadcastChange({ fontMode: els.fontModeSelect.value });
});

els.themeToggle.addEventListener('click', () => {
    const themes = ['system', 'light', 'dark'];
    const nextTheme = themes[(themes.indexOf(settings.theme) + 1) % themes.length];
    applyTheme(nextTheme);
    broadcastChange({ theme: nextTheme });
});

els.reset.addEventListener('click', () => {
    // Manually update UI to defaults (Flicker-free)
    els.letterSlider.value = DEFAULTS.letterSpacing;
    els.wordSlider.value = DEFAULTS.wordSpacing;
    els.lineSlider.value = DEFAULTS.lineHeight;
    els.fontModeSelect.value = DEFAULTS.fontMode;
    applyTheme(DEFAULTS.theme);
    els.exclude.checked = false;
    updateDisplayValues();
    updateToggleUI(settings.enabled);

    // Broadcast all changes (updates active tab instantly, debounces storage)
    broadcastChange({
        letterSpacing: DEFAULTS.letterSpacing,
        wordSpacing: DEFAULTS.wordSpacing,
        lineHeight: DEFAULTS.lineHeight,
        fontMode: DEFAULTS.fontMode,
        excludedDomains: [],
        theme: DEFAULTS.theme
    });
});

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

// i18n translation as microtask to avoid blocking UI
Promise.resolve().then(() => {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const msg = browser.i18n.getMessage(el.getAttribute('data-i18n'));
        if (msg) el.textContent = msg;
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
        const msg = browser.i18n.getMessage(el.getAttribute('data-i18n-aria'));
        if (msg) el.setAttribute('aria-label', msg);
    });
});