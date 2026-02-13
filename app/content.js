(() => {
    const api = typeof browser !== 'undefined' ? browser : chrome;

    const RESTRICTED = ['chrome://', 'chrome-extension://', 'moz-extension://', 'file://', 'about:', 'edge://', 'brave://', 'data:'];

    // Debounce timeout for mutation observer
    const DEBOUNCE_MUTATION = 10;

    const state = {
        enabled: false,
        excluded: false,
        letterSpacing: 0,
        wordSpacing: 0,
        lineHeight: 140,
        fontMode: 'andika'
    };

    const FONT_MAP = {
        'andika': 'Andika',
        'lexend': 'Lexend',
        'opendyslexic': 'OpenDyslexic',
        'shantell': 'ShantellSans',
        'balsamiq': 'BalsamiqSans',
        'atkinson': 'AtkinsonHyperlegible'
    };

    const CSS_VAR_KEYS = ['letterSpacing', 'wordSpacing', 'lineHeight', 'fontMode'];

    let animationFrameId = null;
    let observer = null;
    let debounceTimer = null;

    init();

    // BFCache: Firefox caches page state when navigating back/forward.
    // When restored, we must re-read storage and restart observer for fresh state.
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            stopObserver();
            init();
        }
    });

    // GitHub/Turbo SPA navigation - handle route changes without full page reload
    document.addEventListener('turbo:load', applyStyles);
    document.addEventListener('turbo:render', applyStyles);

    function init() {
        if (RESTRICTED.some(prefix => location.href.startsWith(prefix))) {
            return;
        }

        api.storage.local.get(
            ['enabled', 'letterSpacing', 'wordSpacing', 'lineHeight', 'excludedDomains', 'fontMode']
        ).then(result => {
            state.enabled = result.enabled ?? false;
            state.letterSpacing = result.letterSpacing ?? 0;
            state.wordSpacing = result.wordSpacing ?? 0;
            state.lineHeight = result.lineHeight ?? 140;
            state.fontMode = result.fontMode ?? 'andika';
            state.excluded = (result.excludedDomains || []).includes(location.hostname);

            applyStyles();
        });
    }

    function scheduleUpdate(callback) {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        // Set animationFrameId to null BEFORE callback to prevent race conditions
        // if callback calls scheduleUpdate again
        animationFrameId = requestAnimationFrame(() => {
            animationFrameId = null;
            callback();
        });
    }

    function shouldApplyStyles() {
        return state.enabled && !state.excluded;
    }

    function applyStyles() {
        if (shouldApplyStyles()) {
            scheduleUpdate(() => {
                updateCSSVariables();
                document.documentElement.classList.add('opendyslexic-active');
            });
            // Start observer OUTSIDE scheduleUpdate to monitor immediately, not after 16ms delay.
            // This prevents missing mutations during the rAF delay window.
            startObserver();
        } else {
            stopObserver();
            scheduleUpdate(removeStyles);
        }
    }

    function updateCSSVariables() {
        const root = document.documentElement;
        const rootStyle = root.style;
        const primaryFont = FONT_MAP[state.fontMode] || 'Andika';

        rootStyle.setProperty('--od-primary-font-family', primaryFont);
        rootStyle.setProperty('--od-letter-spacing', `${(state.letterSpacing / 1000).toFixed(3)}em`);
        rootStyle.setProperty('--od-word-spacing', `${(state.wordSpacing / 1000).toFixed(3)}em`);
        rootStyle.setProperty('--od-line-height', (state.lineHeight / 100).toFixed(2));

        const isOpenTypeFont = primaryFont.startsWith('Open');
        root.classList.toggle('opendyslexic-type-active', isOpenTypeFont);
    }

    function removeStyles() {
        const root = document.documentElement;
        const rootStyle = root.style;

        root.classList.remove('opendyslexic-active', 'opendyslexic-type-active');
        rootStyle.removeProperty('--od-primary-font-family');
        rootStyle.removeProperty('--od-letter-spacing');
        rootStyle.removeProperty('--od-word-spacing');
        rootStyle.removeProperty('--od-line-height');
    }

    function startObserver() {
        // Always recreate observer to ensure it's monitoring current DOM,
        // not stale cached DOM from BFCache restoration
        if (observer) {
            observer.disconnect();
            observer = null;
        }

        clearTimeout(debounceTimer);
        debounceTimer = null;

        if (!document.body) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', startObserver, { once: true });
            } else {
                // Edge case: SPA might have body but not ready yet
                scheduleUpdate(startObserver);
            }
            return;
        }

        observer = new MutationObserver((mutations) => {
            // CRITICAL: Check CSS variable, not class. SPA navigation may clear variables
            // but leave class intact, causing fallback to default font.
            if (document.documentElement.style.getPropertyValue('--od-primary-font-family')) {
                return;
            }

            if (!shouldApplyStyles()) return;

            // Only re-apply on childList mutations (nodes added/removed), not text changes.
            // This catches SPA navigation while ignoring minor DOM updates.
            const hasSignificantChanges = mutations.some(mutation =>
                mutation.addedNodes.length > 0 ||
                mutation.removedNodes.length > 0
            );

            if (!hasSignificantChanges) return;

            // DEBOUNCE_MUTATION batches rapid mutations during SPA navigation
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                scheduleUpdate(() => {
                    updateCSSVariables();
                    document.documentElement.classList.add('opendyslexic-active');
                });
            }, DEBOUNCE_MUTATION);
        });

        // Monitor <body> for childList changes only (not attributes or characterData)
        // to detect SPA navigation without performance overhead
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function stopObserver() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }

    function updateState(newState) {
        let changed = false;

        for (const key of CSS_VAR_KEYS) {
            if (newState[key] !== undefined && state[key] !== newState[key]) {
                state[key] = newState[key];
                changed = true;
            }
        }

        if (newState.excludedDomains !== undefined) {
            const newExcluded = newState.excludedDomains.includes(location.hostname);
            if (state.excluded !== newExcluded) {
                state.excluded = newExcluded;
                changed = true;
            }
        }

        if (newState.enabled !== undefined && state.enabled !== newState.enabled) {
            state.enabled = newState.enabled;
            changed = true;
        }

        return changed;
    }

    api.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'REINITIALIZE') {
            init();
            sendResponse({ success: true });
        } else if (request.action === 'UPDATE_STYLES' && request.settings) {
            if (updateState(request.settings)) {
                applyStyles();
            }
            sendResponse({ success: true });
        }
    });

    api.storage.onChanged.addListener((changes, namespace) => {
        if (namespace !== 'local') return;

        const updates = {};
        let needsFullReapply = false;

        if (changes.enabled) {
            updates.enabled = changes.enabled.newValue;
            needsFullReapply = true;
        }

        if (changes.excludedDomains) {
            updates.excludedDomains = changes.excludedDomains.newValue || [];
            needsFullReapply = true;
        }

        for (const key of CSS_VAR_KEYS) {
            if (changes[key]) updates[key] = changes[key].newValue;
        }

        const stateChanged = updateState(updates);

        if (needsFullReapply) {
            applyStyles();
        } else if (stateChanged && shouldApplyStyles()) {
            scheduleUpdate(updateCSSVariables);
        }
    });
})();