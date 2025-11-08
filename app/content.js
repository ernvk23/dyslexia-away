(() => {
    let state = {
        enabled: false,
        excluded: false,
        letterSpacing: 0,
        wordSpacing: 0,
        lineHeight: 140,
        fontSize: 100
    };

    // Prevent duplicate initialization
    if (!window.extensionInitialized) {
        window.extensionInitialized = true;
        init();
    }

    function init() {
        chrome.storage.local.get(['enabled', 'letterSpacing', 'wordSpacing', 'lineHeight', 'fontSize', 'excludedDomains'], (result) => {
            state = {
                enabled: result.enabled || false,
                letterSpacing: result.letterSpacing ?? 0,
                wordSpacing: result.wordSpacing ?? 0,
                lineHeight: result.lineHeight ?? 140,
                fontSize: result.fontSize ?? 100,
                excluded: (result.excludedDomains || []).includes(window.location.hostname)
            };

            requestAnimationFrame(() => {
                applyStyles();
            });
        });
    }

    // Listen for reload events from popup (for pre-existing tabs)
    window.addEventListener('extensionReload', (e) => {
        if (e.detail) {
            state.letterSpacing = e.detail.letterSpacing ?? state.letterSpacing;
            state.wordSpacing = e.detail.wordSpacing ?? state.wordSpacing;
            state.lineHeight = e.detail.lineHeight ?? state.lineHeight;
            state.fontSize = e.detail.fontSize ?? state.fontSize;
            state.excluded = (e.detail.excludedDomains || []).includes(window.location.hostname);
            state.enabled = e.detail.enabled ?? state.enabled;
        }
        requestAnimationFrame(() => {
            applyStyles();
        });
    });

    // Force re-initialization function for popup to call
    window.forceReinitializeExtension = () => {
        init();
    };

    // Listen for direct messages from background script to re-initialize
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'REINITIALIZE') {
            init();
        } else if (request.action === 'UPDATE_STYLES' && request.settings) {
            // Immediate update from popup (slider drag) - no storage dependency
            state.letterSpacing = request.settings.letterSpacing ?? state.letterSpacing;
            state.wordSpacing = request.settings.wordSpacing ?? state.wordSpacing;
            state.lineHeight = request.settings.lineHeight ?? state.lineHeight;
            state.fontSize = request.settings.fontSize ?? state.fontSize;

            // Apply immediately - CSS variable updates are fast
            if (state.enabled && !state.excluded) {
                updateCSSVariables();
            }
        }
    });

    async function applyStyles() {
        const shouldApply = state.enabled && !state.excluded;

        if (shouldApply) {
            // Wait for the OpenDyslexic font to load before applying styles.
            // document.fonts.load requires a size (e.g., 1em) as part of the CSS font shorthand.
            try {
                await document.fonts.load('1em OpenDyslexic');
            } catch (e) {
                console.error('Failed to load OpenDyslexic font:', e);
                // Continue applying styles even if font loading fails, using fallback
            }

            // Use requestAnimationFrame for optimal rendering timing
            requestAnimationFrame(() => {
                updateCSSVariables();
                document.documentElement.classList.add('opendyslexic-active');
            });
        } else {
            removeStyles();
        }
    }

    function updateCSSVariables() {
        const ls = (state.letterSpacing / 1000).toFixed(3) + 'em';
        const ws = (state.wordSpacing / 1000).toFixed(3) + 'em';
        const lh = (state.lineHeight / 100).toFixed(2);
        const fs = (state.fontSize / 100).toFixed(2) + 'em';

        const root = document.documentElement.style;
        root.setProperty('--od-letter-spacing', ls);
        root.setProperty('--od-word-spacing', ws);
        root.setProperty('--od-line-height', lh);
        root.setProperty('--od-font-size', fs);
    }

    function removeStyles() {
        document.documentElement.classList.remove('opendyslexic-active');
        // Remove CSS variables when disabled
        const root = document.documentElement.style;
        root.removeProperty('--od-letter-spacing');
        root.removeProperty('--od-word-spacing');
        root.removeProperty('--od-line-height');
        root.removeProperty('--od-font-size');
    }

    // Listen to storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace !== 'local') return;

        let needsUpdate = false;
        let needsFullReapply = false;

        if (changes.enabled) {
            state.enabled = changes.enabled.newValue;
            needsFullReapply = true;
        }

        if (changes.excludedDomains) {
            state.excluded = (changes.excludedDomains.newValue || []).includes(window.location.hostname);
            needsFullReapply = true;
        }

        if (changes.letterSpacing) {
            state.letterSpacing = changes.letterSpacing.newValue;
            needsUpdate = true;
        }
        if (changes.wordSpacing) {
            state.wordSpacing = changes.wordSpacing.newValue;
            needsUpdate = true;
        }
        if (changes.lineHeight) {
            state.lineHeight = changes.lineHeight.newValue;
            needsUpdate = true;
        }
        if (changes.fontSize) {
            state.fontSize = changes.fontSize.newValue;
            needsUpdate = true;
        }

        if (needsFullReapply) {
            requestAnimationFrame(() => {
                applyStyles();
            });
        } else if (needsUpdate && state.enabled && !state.excluded) {
            // Just update the CSS variables, don't reapply everything
            updateCSSVariables();
        }
    });
})();