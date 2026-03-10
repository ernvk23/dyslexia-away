const DEFAULTS = { enabled: false, letterSpacing: 0, wordSpacing: 0, lineHeight: 140, excludedDomains: [], theme: 'system', fontMode: 'andika', customFont: '', heartRated: false, installDate: null };
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
    heartBtn: document.getElementById('heartBtn'),
    fontModeSelect: document.getElementById('fontModeSelect'),
    customFontInput: document.getElementById('customFontInput'),
    fontModeSetting: document.querySelector('.font-mode-setting')
};

const sliders = [els.letterSlider, els.wordSlider, els.lineSlider];

let currentDomain = null;
let activeTabId = null;
let saveTimeout = null;
let messageTimeout = null;
let renderRafId = null;
let settings = { ...DEFAULTS };

// Coalesce DOM writes to prevent layout thrashing
function scheduleRender(callback) {
    if (renderRafId) cancelAnimationFrame(renderRafId);
    renderRafId = requestAnimationFrame(() => { renderRafId = null; callback(); });
}

browser.storage.local.get(Object.keys(DEFAULTS)).then(async result => {
    settings = { ...DEFAULTS, ...result };
    applyTheme(settings.theme);

    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const isRestricted = !tab?.url || RESTRICTED.some(p => tab.url.startsWith(p));
    let isExcluded = false;

    if (!isRestricted) {
        activeTabId = tab.id;
        currentDomain = new URL(tab.url).hostname;
        isExcluded = settings.excludedDomains.includes(currentDomain);
        browser.runtime.sendMessage({ action: 'ENSURE_INJECTED', tabId: tab.id, tabUrl: tab.url }).catch(() => { });
    }

    const shouldShowHeart = !settings.heartRated &&
        settings.installDate &&
        (Date.now() - settings.installDate > 216000000);

    scheduleRender(() => {
        updateToggleUI(settings.enabled);
        els.letterSlider.value = settings.letterSpacing;
        els.wordSlider.value = settings.wordSpacing;
        els.lineSlider.value = settings.lineHeight;
        els.fontModeSelect.value = settings.fontMode;
        els.customFontInput.value = settings.customFont || '';
        updateCustomFontInputVisibility();
        updateDisplayValues();
        els.exclude.checked = isExcluded;
        els.exclude.disabled = isRestricted;
        updateSlidersState(isExcluded, settings.enabled);

        if (shouldShowHeart) {
            els.heartBtn.classList.remove('hidden');
        }

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                document.documentElement.classList.add('ready');
            });
        });
    });

    if (shouldShowHeart) {
        setupHeartButton();
    }
});

function updateDisplayValues() {
    const formatValue = (value, divisor) => {
        const result = (value / divisor).toFixed(2);
        return result === '-0.00' ? '0.00' : result;
    };
    els.letterVal.textContent = formatValue(els.letterSlider.value, 1000) + ' em';
    els.wordVal.textContent = formatValue(els.wordSlider.value, 1000) + ' em';
    els.lineVal.textContent = formatValue(els.lineSlider.value, 100);
}

function updateToggleUI(enabled) {
    els.toggle.classList.toggle('active', enabled);
    updateSlidersState(els.exclude.checked, enabled);
}

function updateSlidersState(isExcluded, isEnabled) {
    const slidersDisabled = !isEnabled || isExcluded || !currentDomain;
    sliders.forEach(s => {
        s.disabled = slidersDisabled;
        s.classList.toggle('active', !slidersDisabled);
    });
    els.fontModeSelect.disabled = !isEnabled; // Font mode remains enabled even when site is excluded
    els.customFontInput.disabled = !isEnabled;
}

function updateCustomFontInputVisibility() {
    if (els.fontModeSelect.value === 'custom') {
        els.fontModeSetting.classList.add('show-custom-input');
    } else {
        els.fontModeSetting.classList.remove('show-custom-input');
    }
}

function sanitizeCustomFont(fontName) {
    if (typeof fontName !== 'string') return '';
    return fontName
        .replace(/[^a-zA-Z0-9\s\-]/g, '')
        .replace(/\s*-\s*/g, '-')
        .replace(/-+/g, '-')
        .replace(/\s+/g, ' ')
        .substring(0, 100);
}

// Debounce updates to reduce writes and messages
function broadcastChange(changedSettings, shouldNotifyTabs = true) {
    Object.assign(settings, changedSettings);
    if (shouldNotifyTabs && activeTabId) {
        if (!messageTimeout) {
            messageTimeout = setTimeout(() => {
                messageTimeout = null;
                browser.tabs.sendMessage(activeTabId, {
                    action: 'UPDATE_STYLES',
                    settings,
                    topLevelDomain: currentDomain
                }).catch(() => { });
            }, 5);
        }
    }

    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        await browser.storage.local.set(settings);
        saveTimeout = null;
    }, 100);
}

els.toggle.addEventListener('click', () => {
    const newState = !settings.enabled;
    scheduleRender(() => updateToggleUI(newState));
    broadcastChange({ enabled: newState });
});

els.exclude.addEventListener('change', () => {
    if (!currentDomain) return;
    const domains = new Set(settings.excludedDomains);
    els.exclude.checked ? domains.add(currentDomain) : domains.delete(currentDomain);
    scheduleRender(() => updateSlidersState(els.exclude.checked, settings.enabled));
    broadcastChange({ excludedDomains: [...domains] });
});

sliders.forEach(slider => {
    slider.addEventListener('input', () => {
        scheduleRender(updateDisplayValues);
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
    const newFontMode = els.fontModeSelect.value;
    updateCustomFontInputVisibility();
    broadcastChange({ fontMode: newFontMode });
});

els.customFontInput.addEventListener('input', () => {
    const sanitizedValue = sanitizeCustomFont(els.customFontInput.value);

    if (sanitizedValue !== els.customFontInput.value) {
        els.customFontInput.value = sanitizedValue;
    }

    if (sanitizedValue !== settings.customFont) {
        broadcastChange({ customFont: sanitizedValue });
    }
});

els.customFontInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        els.customFontInput.blur();
    }
});

function trimAndSaveCustomFont() {
    if (els.fontModeSelect.value !== 'custom') return false;
    const trimmedValue = els.customFontInput.value.trim();

    if (trimmedValue !== els.customFontInput.value) {
        els.customFontInput.value = trimmedValue;
    }

    if (trimmedValue !== settings.customFont) {
        settings.customFont = trimmedValue;
        return true;
    }

    return false;
}

els.customFontInput.addEventListener('blur', () => {
    if (trimAndSaveCustomFont()) {
        broadcastChange({ customFont: settings.customFont });
    }
});

function performFinalSave() {
    const changed = trimAndSaveCustomFont();
    if (changed || saveTimeout) {
        browser.runtime.sendMessage({ action: 'SAVE_SETTINGS', settings });

        if (saveTimeout) {
            clearTimeout(saveTimeout);
            saveTimeout = null;
        }
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') performFinalSave();
});
window.addEventListener('blur', performFinalSave);

els.themeToggle.addEventListener('click', () => {
    const themes = ['system', 'light', 'dark'];
    const nextTheme = themes[(themes.indexOf(settings.theme) + 1) % themes.length];
    scheduleRender(() => applyTheme(nextTheme));
    broadcastChange({ theme: nextTheme }, false);
});

els.reset.addEventListener('click', () => {
    scheduleRender(() => {
        els.letterSlider.value = DEFAULTS.letterSpacing;
        els.wordSlider.value = DEFAULTS.wordSpacing;
        els.lineSlider.value = DEFAULTS.lineHeight;
        els.fontModeSelect.value = DEFAULTS.fontMode;
        els.customFontInput.value = DEFAULTS.customFont;
        updateCustomFontInputVisibility();
        applyTheme(DEFAULTS.theme);
        els.exclude.checked = false;
        updateDisplayValues();
        updateToggleUI(settings.enabled);
    });
    broadcastChange({
        letterSpacing: DEFAULTS.letterSpacing,
        wordSpacing: DEFAULTS.wordSpacing,
        lineHeight: DEFAULTS.lineHeight,
        fontMode: DEFAULTS.fontMode,
        customFont: DEFAULTS.customFont,
        excludedDomains: [],
        theme: DEFAULTS.theme
    });
});

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme || 'system');
}

// i18n as microtask — avoids blocking initial popup render
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

function setupHeartButton() {
    const isFirefox = navigator.userAgent.includes('Firefox');
    const ratingUrl = isFirefox
        ? 'https://addons.mozilla.org/en-US/firefox/addon/dyslexiaaway/'
        : 'https://chromewebstore.google.com/detail/dyslexiaaway-beta/cdlibplbalgnomagghdgogdofiphhjce/reviews';

    els.heartBtn.addEventListener('click', () => {
        els.heartBtn.classList.add('hidden');
        browser.storage.local.set({ heartRated: true }).then(() => {
            browser.tabs.create({ url: ratingUrl });
            window.close();
        });
    });
}