let isEnabled = false;
let isExcluded = false;
let currentLetterSpacing = -30;
let currentWordSpacing = -100;
let currentLineHeight = 140;
let currentFontSize = 100;
let isApplyingStyles = false;

// Inject CSS styles dynamically
function injectStyles() {
    const styleId = 'opendyslexic-dynamic-styles';
    let styleElement = document.getElementById(styleId);

    if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
    }

    return styleElement;
}

function updateCustomStyles(letterSpacing, wordSpacing, lineHeight, fontSize) {
    if (isApplyingStyles) {
        console.log('Style update already in progress, skipping');
        return;
    }

    isApplyingStyles = true;

    try {
        currentLetterSpacing = letterSpacing;
        currentWordSpacing = wordSpacing;
        currentLineHeight = lineHeight;
        currentFontSize = fontSize;

        const formatEm = (value) => {
            const result = value / 1000;
            if (result === 0) return '0em';
            return result.toFixed(3) + 'em';
        };

        const letterS = formatEm(letterSpacing);
        const wordS = formatEm(wordSpacing);
        const lineH = (lineHeight / 100).toFixed(2);
        const fontS = (fontSize / 100).toFixed(2) + 'rem';

        const styleElement = injectStyles();

        const css = `
            :root {
                --od-letter-spacing: ${letterS};
                --od-word-spacing: ${wordS};
                --od-line-height: ${lineH};
                --od-font-size: ${fontS};
            }
            
            /* Apply base styles to body text elements only */
            html.opendyslexic-active,
            html.opendyslexic-active body,
            html.opendyslexic-active p,
            html.opendyslexic-active span,
            html.opendyslexic-active div,
            html.opendyslexic-active li,
            html.opendyslexic-active td,
            html.opendyslexic-active th,
            html.opendyslexic-active label,
            html.opendyslexic-active button,
            html.opendyslexic-active input,
            html.opendyslexic-active textarea,
            html.opendyslexic-active select,
            html.opendyslexic-active a,
            html.opendyslexic-active h1,
            html.opendyslexic-active h2,
            html.opendyslexic-active h3,
            html.opendyslexic-active h4,
            html.opendyslexic-active h5,
            html.opendyslexic-active h6 {
                font-family: 'OpenDyslexic', sans-serif !important;
                letter-spacing: var(--od-letter-spacing) !important;
                word-spacing: var(--od-word-spacing) !important;
                line-height: var(--od-line-height) !important;
                font-size: var(--od-font-size) !important;
            }

            /* Headings get larger sizes to maintain hierarchy */
            html.opendyslexic-active h1,
            html.opendyslexic-active h1 a {
                font-size: calc(${fontS} * 1.5) !important;
            }
            
            html.opendyslexic-active h2,
            html.opendyslexic-active h2 a {
                font-size: calc(${fontS} * 1.2) !important;
            }
            
            html.opendyslexic-active h3 {
                font-size: calc(${fontS} * 1.1) !important;
            }
            
            html.opendyslexic-active h4 {
                font-size: calc(${fontS} * 1.05) !important;
            }
            
            html.opendyslexic-active h5 {
                font-size: calc(${fontS} * 1.02) !important;
            }
            
            html.opendyslexic-active h6 {
                font-size: calc(${fontS} * 1.00) !important;
            }

            
            /* Exclude icon elements and monospace code */
            html.opendyslexic-active i,
            html.opendyslexic-active i *,
            html.opendyslexic-active [class*="icon"],
            html.opendyslexic-active [data-icon],
            html.opendyslexic-active [aria-hidden="true"],
            html.opendyslexic-active svg,
            html.opendyslexic-active code,
            html.opendyslexic-active pre,
            html.opendyslexic-active kbd,
            html.opendyslexic-active samp,
            html.opendyslexic-active [class*="mono"],
            html.opendyslexic-active [class*="code"] {
                font-family: 'FontAwesome', "Material Icons", sans-serif !important;
                letter-spacing: revert !important;
                word-spacing: revert !important;
                line-height: revert !important;
                font-size: revert !important;
            }
        `;

        styleElement.textContent = css;

        // Force reflow
        if (document.documentElement) {
            void document.documentElement.offsetHeight;
        }

    } catch (error) {
        console.error('Error updating styles:', error);
    } finally {
        isApplyingStyles = false;
    }
}

function applyInitialSettings(result) {
    try {
        isEnabled = result.enabled || false;
        currentLetterSpacing = result.letterSpacing !== undefined ? result.letterSpacing : -30;
        currentWordSpacing = result.wordSpacing !== undefined ? result.wordSpacing : -100;
        currentLineHeight = result.lineHeight !== undefined ? result.lineHeight : 140;
        currentFontSize = result.fontSize !== undefined ? result.fontSize : 100;

        const excludedDomains = result.excludedDomains || [];
        const currentDomain = window.location.hostname;
        isExcluded = excludedDomains.includes(currentDomain);

        console.log('Initial settings loaded:', { isEnabled, isExcluded, currentLetterSpacing, currentWordSpacing, currentLineHeight, currentFontSize });

        if (isEnabled && !isExcluded) {
            // Wait for fonts to load before applying styles to prevent FOUC/fallback font display
            document.fonts.ready.then(() => {
                updateCustomStyles(currentLetterSpacing, currentWordSpacing, currentLineHeight, currentFontSize);
                if (document.documentElement) {
                    document.documentElement.classList.add('opendyslexic-active');
                    console.log('OpenDyslexic activated on page load');
                }
            });
        } else if (isExcluded) {
            console.log(`OpenDyslexic skipped for excluded domain: ${currentDomain}`);
        }
    } catch (error) {
        console.error('Error applying initial settings:', error);
    }
}

// Load initial settings - this runs immediately when content script loads
function loadInitialSettings() {
    chrome.storage.local.get(['enabled', 'letterSpacing', 'wordSpacing', 'lineHeight', 'fontSize', 'excludedDomains'], (result) => {
        console.log('Loading initial settings:', result);
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => applyInitialSettings(result));
        } else {
            applyInitialSettings(result);
        }
    });
}

// Run immediately
loadInitialSettings();

// Message handler - handles toggle and slider updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        if (message.action === 'toggle') {
            const newState = message.enabled;

            // Prevent re-triggering if state is already correct
            if (isEnabled === newState) {
                sendResponse({ success: true, alreadyInState: true });
                return true;
            }

            isEnabled = newState;
            handleToggleStateChange();

            sendResponse({ success: true });

        } else if (message.action === 'updateSpacing') {
            console.log('Slider update received');

            if (!isEnabled || isExcluded) {
                console.log('Extension disabled or site excluded, ignoring slider update');
                sendResponse({ success: true, skipped: true });
                return true;
            }

            updateCustomStyles(
                message.letterSpacing,
                message.wordSpacing,
                message.lineHeight,
                message.fontSize
            );

            if (document.documentElement) {
                document.documentElement.classList.add('opendyslexic-active');
            }

            sendResponse({ success: true });
        }
    } catch (error) {
        console.error('Message handler error:', error);
        sendResponse({ success: false, error: error.message });
    }

    return true; // Keep message channel open for async response
});

// Listen for storage changes (backup mechanism)
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== 'local') return;

    // Handle enabled state changes from storage
    if (changes.enabled && changes.enabled.newValue !== isEnabled) {
        isEnabled = changes.enabled.newValue;
        handleToggleStateChange();
    }

    // Handle exclusion list changes from storage
    if (changes.excludedDomains) {
        const currentDomain = window.location.hostname;
        const newExcludedDomains = changes.excludedDomains.newValue || [];
        const newIsExcluded = newExcludedDomains.includes(currentDomain);

        if (newIsExcluded !== isExcluded) {
            isExcluded = newIsExcluded;
            handleToggleStateChange();
        }
    }

    // Handle slider changes
    let shouldUpdateStyles = false;
    const newSettings = {};

    if (changes.letterSpacing) {
        newSettings.letterSpacing = changes.letterSpacing.newValue;
        shouldUpdateStyles = true;
    }
    if (changes.wordSpacing) {
        newSettings.wordSpacing = changes.wordSpacing.newValue;
        shouldUpdateStyles = true;
    }
    if (changes.lineHeight) {
        newSettings.lineHeight = changes.lineHeight.newValue;
        shouldUpdateStyles = true;
    }

    if (changes.fontSize) {
        newSettings.fontSize = changes.fontSize.newValue;
        shouldUpdateStyles = true;
    }

    if (shouldUpdateStyles && isEnabled && !isExcluded) {
        const finalSettings = {
            letterSpacing: newSettings.letterSpacing !== undefined ? newSettings.letterSpacing : currentLetterSpacing,
            wordSpacing: newSettings.wordSpacing !== undefined ? newSettings.wordSpacing : currentWordSpacing,
            lineHeight: newSettings.lineHeight !== undefined ? newSettings.lineHeight : currentLineHeight,
            fontSize: newSettings.fontSize !== undefined ? newSettings.fontSize : currentFontSize,
        };

        updateCustomStyles(
            finalSettings.letterSpacing,
            finalSettings.wordSpacing,
            finalSettings.lineHeight,
            finalSettings.fontSize
        );
    }
});

// New function to handle state changes (toggle or exclusion)
function handleToggleStateChange() {
    observer.disconnect();

    if (isEnabled && !isExcluded) {
        // Wait for fonts to load before applying styles to prevent FOUC/fallback font display
        document.fonts.ready.then(() => {
            updateCustomStyles(currentLetterSpacing, currentWordSpacing, currentLineHeight, currentFontSize);
            if (document.documentElement) {
                document.documentElement.classList.add('opendyslexic-active');
            }
            console.log('OpenDyslexic activated via storage/message');
        });
    } else {
        if (document.documentElement) {
            document.documentElement.classList.remove('opendyslexic-active');
        }
        const styleElement = document.getElementById('opendyslexic-dynamic-styles');
        if (styleElement) {
            styleElement.remove();
        }
        console.log('OpenDyslexic deactivated via storage/message');
    }

    // Reconnect observer
    if (document.documentElement) {
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }
}

// Handle recheckExclusion message from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'recheckExclusion') {
        console.log('Recheck exclusion requested.');
        // Re-read settings to update isExcluded state and re-apply styles if needed
        chrome.storage.local.get(['enabled', 'excludedDomains'], (result) => {
            const currentDomain = window.location.hostname;
            const excludedDomains = result.excludedDomains || [];
            const newIsExcluded = excludedDomains.includes(currentDomain);

            if (newIsExcluded !== isExcluded || result.enabled !== isEnabled) {
                isEnabled = result.enabled || false;
                isExcluded = newIsExcluded;
                handleToggleStateChange();
            }
            sendResponse({ success: true });
        });
        return true; // Keep channel open for async response
    }
});
// Mutation observer for dynamic content
const observer = new MutationObserver((mutations) => {
    if (!isEnabled || isApplyingStyles) return;

    let hasSignificantChanges = false;

    for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1 && node.children && node.children.length > 0) {
                    hasSignificantChanges = true;
                    break;
                }
            }
        }
        if (hasSignificantChanges) break;
    }

    if (hasSignificantChanges) {
        // Ensure class is still applied after DOM changes
        if (document.documentElement && !document.documentElement.classList.contains('opendyslexic-active')) {
            document.documentElement.classList.add('opendyslexic-active');
            console.log('Re-applied opendyslexic-active class after DOM mutation');
        }
    }
});

if (document.documentElement) {
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
} else {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.documentElement) {
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true
            });
        }
    });
}
