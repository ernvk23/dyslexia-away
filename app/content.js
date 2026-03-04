(() => {
    const api = typeof browser !== 'undefined' ? browser : chrome;
    const FONT_MAP = { 'andika': 'Andika', 'lexend': 'Lexend', 'shantell': 'ShantellSans', 'opendyslexic': 'OpenDyslexic', 'atkinson': 'AtkinsonHyperlegible' };

    let state = { enabled: false, excluded: false, letterSpacing: 0, wordSpacing: 0, lineHeight: 140, fontMode: 'andika', customFont: '' };
    let topHost = location.hostname; // Fallback; overwritten by GET_TOP_HOST on init
    let rafId = null;
    let observer = null;

    // Coalesce rapid updates into a single paint
    function scheduleRender(callback) {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => { rafId = null; callback(); });
    }

    function applyStyles() {
        if (state.enabled && !state.excluded) {
            scheduleRender(updateDOM);
        } else {
            stopObserver();
            scheduleRender(removeDOM);
        }
    }

    function updateDOM() {
        const root = document.documentElement;
        const style = root.style;
        let primaryFont = FONT_MAP[state.fontMode] || 'Andika';

        if (state.fontMode === 'custom' && state.customFont) {
            primaryFont = `"${state.customFont}"`;
        }

        style.setProperty('--da-font-family', primaryFont);
        style.setProperty('--da-letter-spacing', `${(state.letterSpacing / 1000).toFixed(3)}em`);
        style.setProperty('--da-word-spacing', `${(state.wordSpacing / 1000).toFixed(3)}em`);
        style.setProperty('--da-line-height', (state.lineHeight / 100).toFixed(2));
        root.classList.add('d-away-active');
        root.classList.toggle('od-no-italic', state.fontMode === 'opendyslexic');
        startObserver();
    }

    function removeDOM() {
        const root = document.documentElement;
        const style = root.style;
        root.classList.remove('d-away-active', 'od-no-italic');
        style.removeProperty('--da-font-family');
        style.removeProperty('--da-letter-spacing');
        style.removeProperty('--da-word-spacing');
        style.removeProperty('--da-line-height');
    }

    function startObserver() {
        // Re-apply styles on SPA navigation
        if (observer) return;
        observer = new MutationObserver(() => {
            const root = document.documentElement;
            if (!root.style.getPropertyValue('--da-font-family') || !root.classList.contains('d-away-active')) {
                applyStyles();
            }
        });
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['style', 'class']
        });
    }

    function stopObserver() {
        if (observer) { observer.disconnect(); observer = null; }
    }

    function updateState(changes) {
        let changed = false;
        ['enabled', 'letterSpacing', 'wordSpacing', 'lineHeight', 'fontMode', 'customFont'].forEach(key => {
            const val = changes[key]?.newValue ?? changes[key];
            if (val !== undefined && state[key] !== val) { state[key] = val; changed = true; }
        });
        const domains = changes.excludedDomains?.newValue ?? changes.excludedDomains;
        if (domains !== undefined) {
            const isExcluded = domains.includes(topHost);
            if (state.excluded !== isExcluded) { state.excluded = isExcluded; changed = true; }
        }
        return changed;
    }

    async function init() {
        const [res, host] = await Promise.all([
            api.storage.local.get(['enabled', 'letterSpacing', 'wordSpacing', 'lineHeight', 'excludedDomains', 'fontMode', 'customFont']),
            api.runtime.sendMessage({ action: 'GET_TOP_HOST' }).catch(() => location.hostname)
        ]);
        topHost = host || location.hostname;
        updateState(res);
        applyStyles();
    }

    api.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && updateState(changes)) applyStyles();
    });

    api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === 'PING') {
            sendResponse(true);
            return;
        }
        if (msg.action === 'UPDATE_STYLES') {
            if (msg.topLevelDomain) topHost = msg.topLevelDomain;
            if (updateState(msg.settings)) applyStyles();
            sendResponse(true);
            return;
        }
    });

    window.addEventListener('pageshow', (e) => e.persisted && init()); // Restore on BFCache navigation
    document.addEventListener('turbo:load', applyStyles);
    document.addEventListener('turbo:render', applyStyles);

    init();
})();