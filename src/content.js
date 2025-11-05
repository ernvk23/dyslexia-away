let isEnabled = false;
let isExcluded = false;
let currentLetterSpacing = -50;
let currentWordSpacing = -200;
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
        // Style update already in progress, skipping
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
            return result === 0 ? '0em' : result.toFixed(3) + 'em';
        };

        const letterS = formatEm(letterSpacing);
        const wordS = formatEm(wordSpacing);
        const lineH = (lineHeight / 100).toFixed(2);
        // Convert percentage to em units for proper font scaling
        // 100% = 1em, 150% = 1.5em, 50% = 0.5em
        const fontS = (fontSize / 100).toFixed(2) + 'em';

        const styleElement = injectStyles();

        const css = `
            :root {
                --od-letter-spacing: ${letterS};
                --od-word-spacing: ${wordS};
                --od-line-height: ${lineH};
                --od-font-size: ${fontS};
            }
            
            /* Apply OpenDyslexic to text elements only */
            html.opendyslexic-active p,
            html.opendyslexic-active h1,
            html.opendyslexic-active h2,
            html.opendyslexic-active h3,
            html.opendyslexic-active h4,
            html.opendyslexic-active h5,
            html.opendyslexic-active h6,
            html.opendyslexic-active span,
            html.opendyslexic-active a,
            html.opendyslexic-active li,
            html.opendyslexic-active td,
            html.opendyslexic-active th,
            html.opendyslexic-active button,
            html.opendyslexic-active div:not([class*="fa-"]):not([class*="material-"]):not([class*="icon-"]):not([class*="bi-"]):not([class*="ri-"]):not([class*="feather-"]):not([class*="tabler-"]):not([class*="la-"]):not([class*="ion-"]):not([role="img"]):not(.emoji):not([class*="emoji"]):not(svg):not(code):not(pre):not(kbd):not(samp):not(img) {
                font-family: 'OpenDyslexic', sans-serif !important;
                letter-spacing: var(--od-letter-spacing) !important;
                word-spacing: var(--od-word-spacing) !important;
                line-height: var(--od-line-height) !important;
            }

            /* Apply font-size only to reading content (not form elements) */
            html.opendyslexic-active p,
            html.opendyslexic-active h1,
            html.opendyslexic-active h2,
            html.opendyslexic-active h3,
            html.opendyslexic-active h4,
            html.opendyslexic-active h5,
            html.opendyslexic-active h6,
            html.opendyslexic-active span,
            html.opendyslexic-active a,
            html.opendyslexic-active li,
            html.opendyslexic-active td,
            html.opendyslexic-active th,
            html.opendyslexic-active div:not([class*="fa-"]):not([class*="material-"]):not([class*="icon-"]):not([class*="bi-"]):not([class*="ri-"]):not([class*="feather-"]):not([class*="tabler-"]):not([class*="la-"]):not([class*="ion-"]):not([role="img"]):not(.emoji):not([class*="emoji"]):not(svg):not(code):not(pre):not(kbd):not(samp):not(img):not(input):not(label):not(button):not(textarea):not(select) {
                font-size: var(--od-font-size) !important;
            }

            /* Apply font-family to inputs and labels but NOT font-size */
            html.opendyslexic-active input,
            html.opendyslexic-active label,
            html.opendyslexic-active textarea,
            html.opendyslexic-active select {
                font-family: 'OpenDyslexic', sans-serif !important;
                letter-spacing: var(--od-letter-spacing) !important;
                word-spacing: var(--od-word-spacing) !important;
                line-height: var(--od-line-height) !important;
            }

            /* Restore original font families for icons */
            html.opendyslexic-active .fa,
            html.opendyslexic-active .fas,
            html.opendyslexic-active .far,
            html.opendyslexic-active .fal,
            html.opendyslexic-active .fab,
            html.opendyslexic-active .fad,
            html.opendyslexic-active .fat,
            html.opendyslexic-active .fass,
            html.opendyslexic-active [class*="fa-"],
            html.opendyslexic-active .material-icons,
            html.opendyslexic-active .material-icons-outlined,
            html.opendyslexic-active .material-icons-round,
            html.opendyslexic-active .material-icons-sharp,
            html.opendyslexic-active .material-icons-two-tone,
            html.opendyslexic-active [class*="material-"],
            html.opendyslexic-active .bi,
            html.opendyslexic-active [class*="bi-"],
            html.opendyslexic-active [class*="icon-"],
            html.opendyslexic-active [class*="-icon"],
            html.opendyslexic-active .icon,
            html.opendyslexic-active [class*="ri-"],
            html.opendyslexic-active [class*="feather-"],
            html.opendyslexic-active [class*="tabler-"],
            html.opendyslexic-active [class*="la-"],
            html.opendyslexic-active [class*="ion-"],
            html.opendyslexic-active [data-icon],
            html.opendyslexic-active svg,
            html.opendyslexic-active svg *,
            html.opendyslexic-active code,
            html.opendyslexic-active pre,
            html.opendyslexic-active kbd,
            html.opendyslexic-active samp,
            html.opendyslexic-active img,
            html.opendyslexic-active [role="img"],
            html.opendyslexic-active .emoji,
            html.opendyslexic-active [class*="emoji"],
            html.opendyslexic-active .fa::before,
            html.opendyslexic-active .fa::after,
            html.opendyslexic-active .fas::before,
            html.opendyslexic-active .fas::after,
            html.opendyslexic-active .far::before,
            html.opendyslexic-active .far::after,
            html.opendyslexic-active .fab::before,
            html.opendyslexic-active .fab::after,
            html.opendyslexic-active [class*="fa-"]::before,
            html.opendyslexic-active [class*="fa-"]::before,
            html.opendyslexic-active [class*="fa-"]::after,
            html.opendyslexic-active [class*="icon"]::before,
            html.opendyslexic-active [class*="icon"]::after,
            html.opendyslexic-active [class*="material-"]::before,
            html.opendyslexic-active [class*="material-"]::after,
            html.opendyslexic-active [data-icon]::before,
            html.opendyslexic-active [data-icon]::after {
                font-family: 'Font Awesome 7 Free', 'Font Awesome 7 Pro', 'Font Awesome 7 Brands', 'Font Awesome 6 Free', 'Font Awesome 6 Pro', 'Font Awesome 6 Brands', 'Font Awesome 5 Free', 'Font Awesome 5 Pro', 'Font Awesome 5 Brands', 'FontAwesome', 'Material Icons', 'Material Icons Outlined', 'bootstrap-icons', 'remixicon', 'feather', 'tabler-icons', 'Line Awesome Free', 'Ionicons', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif !important;
                font-size: inherit !important;
                letter-spacing: inherit !important;
                word-spacing: inherit !important;
                line-height: inherit !important;
            }
        `;

        styleElement.textContent = css;

        // Force reflow
        if (document.documentElement) {
            void document.documentElement.offsetHeight;
        }

    } catch (error) {
        // Error updating styles
    } finally {
        isApplyingStyles = false;
    }
}

function applyInitialSettings(result) {
    try {
        isEnabled = result.enabled || false;
        currentLetterSpacing = result.letterSpacing ?? -50;
        currentWordSpacing = result.wordSpacing ?? -200;
        currentLineHeight = result.lineHeight ?? 140;
        currentFontSize = result.fontSize ?? 100;

        const excludedDomains = result.excludedDomains || [];
        const currentDomain = window.location.hostname;
        isExcluded = excludedDomains.includes(currentDomain);

        if (isEnabled && !isExcluded) {
            document.fonts.ready.then(() => {
                updateCustomStyles(currentLetterSpacing, currentWordSpacing, currentLineHeight, currentFontSize);
                if (document.documentElement) {
                    document.documentElement.classList.add('opendyslexic-active');
                }
            });
        }
    } catch (error) {
        // Error applying initial settings
    }
}

function loadInitialSettings() {
    chrome.storage.local.get(['enabled', 'letterSpacing', 'wordSpacing', 'lineHeight', 'fontSize', 'excludedDomains'], (result) => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => applyInitialSettings(result));
        } else {
            applyInitialSettings(result);
        }
    });
}

loadInitialSettings();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Validate message origin - only accept from this extension
    if (sender.id !== chrome.runtime.id) {
        return false;
    }

    try {
        if (message.action === 'toggle') {
            const newState = message.enabled;

            if (isEnabled === newState) {
                sendResponse({ success: true, alreadyInState: true });
                return true;
            }

            isEnabled = newState;
            handleToggleStateChange();
            sendResponse({ success: true });

        } else if (message.action === 'updateSpacing') {
            if (!isEnabled || isExcluded) {
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
        sendResponse({ success: false, error: error.message });
    }

    return true;
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== 'local') return;

    if (changes.enabled && changes.enabled.newValue !== isEnabled) {
        isEnabled = changes.enabled.newValue;
        handleToggleStateChange();
    }

    if (changes.excludedDomains) {
        const currentDomain = window.location.hostname;
        const newExcludedDomains = changes.excludedDomains.newValue || [];
        const newIsExcluded = newExcludedDomains.includes(currentDomain);

        if (newIsExcluded !== isExcluded) {
            isExcluded = newIsExcluded;
            handleToggleStateChange();
        }
    }

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
            letterSpacing: newSettings.letterSpacing ?? currentLetterSpacing,
            wordSpacing: newSettings.wordSpacing ?? currentWordSpacing,
            lineHeight: newSettings.lineHeight ?? currentLineHeight,
            fontSize: newSettings.fontSize ?? currentFontSize,
        };

        updateCustomStyles(
            finalSettings.letterSpacing,
            finalSettings.wordSpacing,
            finalSettings.lineHeight,
            finalSettings.fontSize
        );
    }
});

function handleToggleStateChange() {
    observer.disconnect();

    if (isEnabled && !isExcluded) {
        document.fonts.ready.then(() => {
            updateCustomStyles(currentLetterSpacing, currentWordSpacing, currentLineHeight, currentFontSize);
            if (document.documentElement) {
                document.documentElement.classList.add('opendyslexic-active');
            }
        });
    } else {
        if (document.documentElement) {
            document.documentElement.classList.remove('opendyslexic-active');
        }
        const styleElement = document.getElementById('opendyslexic-dynamic-styles');
        if (styleElement) {
            styleElement.remove();
        }
    }

    if (document.documentElement) {
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Validate message origin - only accept from this extension
    if (sender.id !== chrome.runtime.id) {
        return false;
    }

    if (message.action === 'recheckExclusion') {
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
        return true;
    }
});
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
        if (document.documentElement && !document.documentElement.classList.contains('opendyslexic-active')) {
            document.documentElement.classList.add('opendyslexic-active');
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
