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

const sliders = [els.letterSlider, els.wordSlider, els.lineSlider];

let currentDomain = null;
let activeTabId = null;
let saveTimeout = null;
let messageTimeout = null;
let renderRafId = null;
let settings = { ...DEFAULTS };

// Coalesce DOM writes into the next paint frame to prevent layout thrashing
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

    scheduleRender(() => {
        updateToggleUI(settings.enabled);
        els.letterSlider.value = settings.letterSpacing;
        els.wordSlider.value = settings.wordSpacing;
        els.lineSlider.value = settings.lineHeight;
        els.fontModeSelect.value = settings.fontMode;
        updateDisplayValues();
        els.exclude.checked = isExcluded;
        els.exclude.disabled = isRestricted;
        updateSlidersState(isExcluded, settings.enabled);
        requestAnimationFrame(() => document.documentElement.classList.add('ready'));
    });
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
    const isRestrictedPage = !currentDomain || RESTRICTED.some(p => currentDomain.startsWith(p));
    const disabled = !isEnabled || isExcluded || isRestrictedPage;
    sliders.forEach(s => {
        s.disabled = disabled;
        s.classList.toggle('active', !disabled);
    });
    els.fontModeSelect.disabled = !isEnabled;
}

function broadcastChange(changedSettings) {
    Object.assign(settings, changedSettings);

    // 5ms debounce for messaging to prevent flooding the IPC bus
    clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => {
        if (activeTabId) {
            browser.tabs.sendMessage(activeTabId, { action: 'UPDATE_STYLES', settings }).catch(() => { });
        }
    }, 5);

    // 100ms debounce for storage to respect write limits
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => browser.storage.local.set(settings), 100);
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

els.fontModeSelect.addEventListener('change', () => broadcastChange({ fontMode: els.fontModeSelect.value }));

els.themeToggle.addEventListener('click', () => {
    const themes = ['system', 'light', 'dark'];
    const nextTheme = themes[(themes.indexOf(settings.theme) + 1) % themes.length];
    scheduleRender(() => applyTheme(nextTheme));
    broadcastChange({ theme: nextTheme });
});

els.reset.addEventListener('click', () => {
    scheduleRender(() => {
        els.letterSlider.value = DEFAULTS.letterSpacing;
        els.wordSlider.value = DEFAULTS.wordSpacing;
        els.lineSlider.value = DEFAULTS.lineHeight;
        els.fontModeSelect.value = DEFAULTS.fontMode;
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