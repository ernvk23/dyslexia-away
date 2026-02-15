(() => {
    const api = typeof browser !== 'undefined' ? browser : chrome;
    const RESTRICTED = ['chrome://', 'chrome-extension://', 'moz-extension://', 'file://', 'about:', 'edge://', 'brave://', 'data:'];

    let state = { enabled: false, excluded: false, letterSpacing: 0, wordSpacing: 0, lineHeight: 140, fontMode: 'andika' };
    const FONT_MAP = { 'andika': 'Andika', 'lexend': 'Lexend', 'opendyslexic': 'OpenDyslexic', 'shantell': 'ShantellSans', 'balsamiq': 'BalsamiqSans', 'atkinson': 'AtkinsonHyperlegible' };

    let animationFrameId = null;
    let observer = null;

    // Batch DOM writes to prevent layout thrashing
    function scheduleUpdate(callback) {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(() => {
            animationFrameId = null;
            callback();
        });
    }

    function applyStyles() {
        if (state.enabled && !state.excluded) {
            scheduleUpdate(updateDOM);
        } else {
            stopObserver();
            scheduleUpdate(removeDOM);
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
        // Observe root to survive body replacements in SPAs
        observer = new MutationObserver((mutations) => {
            // Early exit if no new elements were added (ignores removals/attribute changes)
            const hasNewNodes = mutations.some(m => m.addedNodes.length > 0);
            if (!hasNewNodes) return;

            // Check if styles were stripped by the site's own scripts
            if (!document.documentElement.style.getPropertyValue('--od-primary-font-family')) {
                applyStyles();
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    function stopObserver() {
        if (observer) { observer.disconnect(); observer = null; }
    }

    function updateState(changes) {
        let changed = false;
        const keys = ['enabled', 'letterSpacing', 'wordSpacing', 'lineHeight', 'fontMode'];

        for (const key of keys) {
            const val = changes[key]?.newValue ?? changes[key];
            if (val !== undefined && state[key] !== val) {
                state[key] = val;
                changed = true;
            }
        }

        const domains = changes.excludedDomains?.newValue ?? changes.excludedDomains;
        if (domains !== undefined) {
            const isExcluded = domains.includes(location.hostname);
            if (state.excluded !== isExcluded) {
                state.excluded = isExcluded;
                changed = true;
            }
        }
        return changed;
    }

    async function init() {
        if (RESTRICTED.some(p => location.href.startsWith(p))) return;
        const res = await api.storage.local.get(['enabled', 'letterSpacing', 'wordSpacing', 'lineHeight', 'excludedDomains', 'fontMode']);
        updateState(res);
        applyStyles();
    }

    // Sync background tabs and iframes via storage
    api.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && updateState(changes)) applyStyles();
    });

    // Handle instant updates from popup or re-pings from background
    api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === 'REINITIALIZE') {
            init();
            sendResponse({ success: true });
        } else if (msg.action === 'UPDATE_STYLES') {
            if (updateState(msg.settings)) applyStyles();
            sendResponse({ success: true });
        }
    });

    // BFCache and SPA support
    window.addEventListener('pageshow', (e) => e.persisted && init());
    document.addEventListener('turbo:load', applyStyles);
    document.addEventListener('turbo:render', applyStyles);

    init();
})();