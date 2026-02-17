(() => {
    const api = typeof browser !== 'undefined' ? browser : chrome;
    const FONT_MAP = { 'andika': 'Andika', 'lexend': 'Lexend', 'opendyslexic': 'OpenDyslexic', 'shantell': 'ShantellSans', 'balsamiq': 'BalsamiqSans', 'atkinson': 'AtkinsonHyperlegible' };

    let state = { enabled: false, excluded: false, letterSpacing: 0, wordSpacing: 0, lineHeight: 140, fontMode: 'andika' };
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
        const primaryFont = FONT_MAP[state.fontMode] || 'Andika';

        style.setProperty('--od-primary-font-family', primaryFont);
        style.setProperty('--od-letter-spacing', `${(state.letterSpacing / 1000).toFixed(3)}em`);
        style.setProperty('--od-word-spacing', `${(state.wordSpacing / 1000).toFixed(3)}em`);
        style.setProperty('--od-line-height', (state.lineHeight / 100).toFixed(2));

        root.classList.add('opendyslexic-active');
        root.classList.toggle('opendyslexic-type-active', primaryFont.startsWith('Open'));

        startObserver();
    }

    function removeDOM() {
        const root = document.documentElement;
        const style = root.style;
        if (!root.classList.contains('opendyslexic-active')) return;
        root.classList.remove('opendyslexic-active', 'opendyslexic-type-active');
        style.removeProperty('--od-primary-font-family');
        style.removeProperty('--od-letter-spacing');
        style.removeProperty('--od-word-spacing');
        style.removeProperty('--od-line-height');
    }

    function startObserver() {
        if (observer) return;
        // Optimized: Only watch root attributes. Iframes handled by manifest all_frames.
        observer = new MutationObserver(() => {
            const root = document.documentElement;
            if (!root.style.getPropertyValue('--od-primary-font-family') || !root.classList.contains('opendyslexic-active')) {
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
        ['enabled', 'letterSpacing', 'wordSpacing', 'lineHeight', 'fontMode'].forEach(key => {
            const val = changes[key]?.newValue ?? changes[key];
            if (val !== undefined && state[key] !== val) { state[key] = val; changed = true; }
        });
        const domains = changes.excludedDomains?.newValue ?? changes.excludedDomains;
        if (domains !== undefined) {
            const isExcluded = domains.includes(location.hostname);
            if (state.excluded !== isExcluded) { state.excluded = isExcluded; changed = true; }
        }
        return changed;
    }

    async function init() {
        const res = await api.storage.local.get(['enabled', 'letterSpacing', 'wordSpacing', 'lineHeight', 'excludedDomains', 'fontMode']);
        updateState(res);
        applyStyles();
    }

    // Fires in all frames — the only way to reach iframes
    api.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && updateState(changes)) applyStyles();
    });

    api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === 'PING') {
            sendResponse(true);
            return;
        }
        if (msg.action === 'UPDATE_STYLES') {
            if (updateState(msg.settings)) applyStyles();
            sendResponse(true);
            return;
        }
    });

    window.addEventListener('pageshow', (e) => e.persisted && init()); // BFCache restore
    document.addEventListener('turbo:load', applyStyles);
    document.addEventListener('turbo:render', applyStyles);

    init();
})();
