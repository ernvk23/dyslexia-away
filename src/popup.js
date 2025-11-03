const defaults = {
    enabled: false,
    letterSpacing: -30,
    wordSpacing: -100,
    lineHeight: 140,
    fontSize: 100 // Default slider value for 1.0rem scaling
};

const toggleBtn = document.getElementById('toggleBtn');
const letterSlider = document.getElementById('letterSpacing');
const wordSlider = document.getElementById('wordSpacing');
const lineSlider = document.getElementById('lineHeight');
const fontSizeSlider = document.getElementById('fontSize');
const letterValue = document.getElementById('letterValue');
const wordValue = document.getElementById('wordValue');
const lineValue = document.getElementById('lineValue');
const fontSizeValue = document.getElementById('fontSizeValue');
const resetBtn = document.getElementById('resetBtn');
const excludeSiteCheckbox = document.getElementById('excludeSite');

let currentDomain = null;
let updateTimeout;
let isToggling = false;

function formatSpacing(value) {
    const result = value / 1000;
    // Ensure 0 is displayed as '0' instead of '0.00'
    if (result === 0) return '0';
    return result.toFixed(2);
}

function formatLineHeight(value) {
    return (value / 100).toFixed(2);
}

function updateDisplayValues() {
    letterValue.textContent = formatSpacing(letterSlider.value) + ' em';
    wordValue.textContent = formatSpacing(wordSlider.value) + ' em';
    lineValue.textContent = formatLineHeight(lineSlider.value);
    fontSizeValue.textContent = (fontSizeSlider.value / 100).toFixed(2) + 'x';
}

function updateToggleUI(enabled) {
    toggleBtn.classList.toggle('active', enabled);
}

function updateSliderDisabledState(isExcluded, isGloballyEnabled) {
    const sliders = [letterSlider, wordSlider, lineSlider, fontSizeSlider];
    // Sliders should be disabled if the extension is globally disabled OR the site is excluded
    const shouldBeDisabled = !isGloballyEnabled || isExcluded;

    sliders.forEach(slider => {
        slider.disabled = shouldBeDisabled;
    });

    // The reset button should always be enabled.
    resetBtn.disabled = false;
}

// Load settings
chrome.storage.local.get(['enabled', 'letterSpacing', 'wordSpacing', 'lineHeight', 'fontSize', 'excludedDomains'], (result) => {

    updateToggleUI(result.enabled || false);
    letterSlider.value = result.letterSpacing !== undefined ? result.letterSpacing : defaults.letterSpacing;
    wordSlider.value = result.wordSpacing !== undefined ? result.wordSpacing : defaults.wordSpacing;
    lineSlider.value = result.lineHeight !== undefined ? result.lineHeight : defaults.lineHeight;
    fontSizeSlider.value = result.fontSize !== undefined ? result.fontSize : defaults.fontSize;
    updateDisplayValues();

    // Initialize exclusion list logic
    initializeExclusion(result.excludedDomains || [], result.enabled || false);
});

async function initializeExclusion(excludedDomains, isGloballyEnabled) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
        try {
            const url = new URL(tab.url);
            // Use hostname for exclusion
            currentDomain = url.hostname;

            // Check if the current domain is in the exclusion list
            const isExcluded = excludedDomains.includes(currentDomain);
            excludeSiteCheckbox.checked = isExcluded;

            // Enable the checkbox
            excludeSiteCheckbox.disabled = false;

            // Update slider state based on exclusion
            updateSliderDisabledState(isExcluded, isGloballyEnabled);

        } catch (e) {
            console.error('Could not parse URL or access tab:', e);
            // Disable the checkbox if we can't get a valid domain (e.g., chrome:// pages)
            excludeSiteCheckbox.disabled = true;
            updateSliderDisabledState(true, isGloballyEnabled); // Disable sliders if we can't determine domain
        }
    } else {
        excludeSiteCheckbox.disabled = true;
        updateSliderDisabledState(true, isGloballyEnabled); // Disable sliders if no active tab/url
    }
}

// Exclusion checkbox listener
excludeSiteCheckbox.addEventListener('change', async () => {
    if (!currentDomain) return;

    const isChecked = excludeSiteCheckbox.checked;

    // 1. Get current list
    const result = await chrome.storage.local.get('excludedDomains');
    let excludedDomains = result.excludedDomains || [];

    // 2. Update list
    if (isChecked) {
        // Add domain if checked and not already present
        if (!excludedDomains.includes(currentDomain)) {
            excludedDomains.push(currentDomain);
        }
    } else {
        // Remove domain if unchecked
        excludedDomains = excludedDomains.filter(domain => domain !== currentDomain);
    }

    // 3. Save updated list
    await chrome.storage.local.set({ excludedDomains: excludedDomains });
    console.log('Excluded domains updated:', excludedDomains);

    // 4. Update slider state based on new exclusion state
    const { enabled } = await chrome.storage.local.get('enabled');
    updateSliderDisabledState(isChecked, enabled);

    // 5. Notify content script in the active tab to re-evaluate styles
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && activeTab.id) {
        try {
            await chrome.tabs.sendMessage(activeTab.id, {
                action: 'recheckExclusion'
            });
            console.log('Recheck exclusion message sent to active tab');
        } catch (e) {
            console.log('Failed to send recheckExclusion message:', e.message);
            // If content script is not running, a simple reload might be necessary,
            // but for now, we rely on the content script's storage listener.
        }
    }
});

// Toggle with click event only (not mouseup)
toggleBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Prevent multiple rapid clicks
    if (isToggling) {
        console.log('Toggle already in progress, ignoring click');
        return;
    }

    isToggling = true;
    console.log('Toggle initiated');

    try {
        // Get current state
        const result = await chrome.storage.local.get('enabled');
        const newState = !result.enabled;
        console.log(`Toggling from ${result.enabled} to ${newState}`);

        // Update storage FIRST as the single source of truth
        await chrome.storage.local.set({ enabled: newState });
        console.log('Storage updated to:', newState);

        // Update UI to match
        updateToggleUI(newState);

        // Update slider disabled state
        const { excludedDomains } = await chrome.storage.local.get('excludedDomains');
        const currentIsExcluded = currentDomain && excludedDomains.includes(currentDomain);
        updateSliderDisabledState(currentIsExcluded, newState);

        // Update badge
        await chrome.action.setBadgeText({ text: newState ? 'ON' : '' });
        await chrome.action.setBadgeBackgroundColor({ color: '#d4af37' });

        // Send message to all eligible tabs
        const tabs = await chrome.tabs.query({});
        const restrictedProtocols = ['chrome://', 'chrome-extension://', 'file://', 'about:'];

        const messageTasks = tabs
            .filter(tab => tab.url && !restrictedProtocols.some(p => tab.url.startsWith(p)))
            .map(async (tab) => {
                try {
                    const response = await chrome.tabs.sendMessage(tab.id, {
                        action: 'toggle',
                        enabled: newState
                    });
                    console.log(`Toggle sent to tab ${tab.id}:`, response);
                } catch (e) {
                    // Content script not ready, inject it manually
                    console.log(`Content script not ready on tab ${tab.id}, injecting...`);
                    try {
                        await chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ['content.js']
                        });
                        // Wait a bit for injection to complete
                        await new Promise(resolve => setTimeout(resolve, 100));
                        // Try sending message again
                        await chrome.tabs.sendMessage(tab.id, {
                            action: 'toggle',
                            enabled: newState
                        });
                        console.log(`Successfully injected and toggled tab ${tab.id}`);
                    } catch (injectError) {
                        console.log(`Could not inject into tab ${tab.id}:`, injectError.message);
                    }
                }
            });

        await Promise.allSettled(messageTasks);
        console.log('Toggle messages sent to all tabs');

    } catch (error) {
        console.error('Toggle error:', error);
    } finally {
        // Longer delay to prevent accidental double-clicks
        setTimeout(() => {
            isToggling = false;
            console.log('Toggle lock released');
        }, 200);
    }
});

// Slider updates with proper debouncing
let isSliderActive = false;

function handleSliderInput() {
    // Update display immediately for responsive feel
    updateDisplayValues();
    isSliderActive = true;

    // Clear any existing timeout
    clearTimeout(updateTimeout);

    // Set a new timeout to send update after 100ms of inactivity
    updateTimeout = setTimeout(() => {
        if (isSliderActive) {
            sendUpdate();
        }
    }, 100);
}

function handleSliderChange() {
    // Immediate update when slider is released
    clearTimeout(updateTimeout);
    isSliderActive = false;
    sendUpdate();
}

async function sendUpdate() {
    const settings = {
        letterSpacing: parseInt(letterSlider.value),
        wordSpacing: parseInt(wordSlider.value),
        lineHeight: parseInt(lineSlider.value),
        fontSize: parseInt(fontSizeSlider.value)
    };

    console.log('Sending settings update:', settings);

    // Save to storage
    await chrome.storage.local.set(settings);

    // Get current enabled state
    const { enabled, excludedDomains } = await chrome.storage.local.get(['enabled', 'excludedDomains']);

    // Update slider disabled state (needed if settings were changed while globally disabled)
    const currentIsExcluded = currentDomain && excludedDomains.includes(currentDomain);
    updateSliderDisabledState(currentIsExcluded, enabled);

    // Only update active tab if extension is enabled AND not excluded
    if (!enabled || currentIsExcluded) {
        console.log('Extension disabled or site excluded, skipping slider update');
        return;
    }

    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const restrictedProtocols = ['chrome://', 'chrome-extension://', 'file://', 'about:'];

    if (activeTab && activeTab.url && !restrictedProtocols.some(p => activeTab.url.startsWith(p))) {
        try {
            await chrome.tabs.sendMessage(activeTab.id, {
                action: 'updateSpacing',
                ...settings
            });
            console.log('Settings update sent to active tab');
        } catch (e) {
            console.log('Failed to update active tab dynamically:', e.message);
        }
    }
}

// Handle mouse wheel events on sliders
function handleSliderWheel(event) {
    event.preventDefault();

    const slider = event.target;
    const step = parseInt(slider.step) || 1;
    const delta = Math.sign(event.deltaY) * -1; // Invert direction for more intuitive scrolling

    let newValue = parseInt(slider.value) + (delta * step);

    // Clamp value within min/max bounds
    const min = parseInt(slider.min);
    const max = parseInt(slider.max);
    newValue = Math.max(min, Math.min(max, newValue));

    // Update slider value
    slider.value = newValue;

    // Trigger the same behavior as manual input
    updateDisplayValues();
    isSliderActive = true;

    // Clear any existing timeout and set new one
    clearTimeout(updateTimeout);
    updateTimeout = setTimeout(() => {
        if (isSliderActive) {
            sendUpdate();
        }
    }, 100);
}

// Attach slider event listeners
[letterSlider, wordSlider, lineSlider, fontSizeSlider].forEach(slider => {
    slider.addEventListener('input', handleSliderInput);
    slider.addEventListener('change', handleSliderChange);
    slider.addEventListener('wheel', handleSliderWheel);
});

// Reset button
resetBtn.addEventListener('click', async () => {
    letterSlider.value = defaults.letterSpacing;
    wordSlider.value = defaults.wordSpacing;
    lineSlider.value = defaults.lineHeight;
    fontSizeSlider.value = defaults.fontSize;
    updateDisplayValues();
    handleSliderChange(); // Trigger immediate update

    // Remove current domain from excluded domains if present
    if (currentDomain) {
        const result = await chrome.storage.local.get('excludedDomains');
        let excludedDomains = result.excludedDomains || [];
        excludedDomains = excludedDomains.filter(domain => domain !== currentDomain);
        await chrome.storage.local.set({ excludedDomains: excludedDomains });
    }

    // Update exclusion UI for current site
    if (!excludeSiteCheckbox.disabled) {
        excludeSiteCheckbox.checked = false;
    }

    // Update slider state (resetting exclusion means sliders should be enabled if globally enabled)
    const { enabled } = await chrome.storage.local.get('enabled');
    updateSliderDisabledState(false, enabled); // Exclusion is false, use global enabled state.

    // Notify active tab to recheck exclusion status
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && activeTab.id) {
        try {
            await chrome.tabs.sendMessage(activeTab.id, {
                action: 'recheckExclusion'
            });
        } catch (e) {
            console.log('Failed to send recheckExclusion message after reset:', e.message);
        }
    }
});