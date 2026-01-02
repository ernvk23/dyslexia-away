// Inline i18n translation - runs immediately to reduce flash
(function () {
    // Simple translations object - will be loaded from JSON
    let translations = {};

    // Get language from existing data-lang attribute (set by inline script)
    const lang = document.documentElement.getAttribute('data-lang') || 'en';

    // Load translations - similar to extension but with fetch
    async function loadTranslations(lang) {
        try {
            const response = await fetch(`./locales/${lang}/messages.json`);
            if (response.ok) {
                translations = await response.json();
                return true;
            }
        } catch (e) {
            // Fall through to English
        }

        // Fallback to English if needed
        if (lang !== 'en') {
            return loadTranslations('en');
        }
        return false;
    }

    // Mimic browser.i18n.getMessage()
    function getMessage(key) {
        return translations[key] || '';
    }
    function translatePage() {
        // Translate text content using data-i18n attributes
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const msg = getMessage(el.getAttribute('data-i18n'));
            if (msg) {
                // Check if message contains HTML tags (like <em>)
                if (msg.includes('<') && msg.includes('>')) {
                    el.innerHTML = msg;
                } else {
                    el.textContent = msg;
                }
            }
        });

        // Translate aria-labels using data-i18n-aria attributes
        document.querySelectorAll('[data-i18n-aria]').forEach(el => {
            const msg = getMessage(el.getAttribute('data-i18n-aria'));
            if (msg) el.setAttribute('aria-label', msg);
        });

        document.documentElement.lang = lang;

        // Update title if it has data-i18n
        const titleEl = document.querySelector('title[data-i18n]');
        if (titleEl) {
            const msg = getMessage(titleEl.getAttribute('data-i18n'));
            if (msg) document.title = msg;
        }

        // Update meta description if it has data-i18n
        const metaDesc = document.querySelector('meta[name="description"][data-i18n]');
        if (metaDesc) {
            const msg = getMessage(metaDesc.getAttribute('data-i18n'));
            if (msg) metaDesc.setAttribute('content', msg);
        }

        // Mark translation as complete to allow opacity transition
        document.body.classList.add('i18n-ready');
    }

    // Initialize i18n
    async function initI18n() {
        await loadTranslations(lang);
        translatePage();
    }

    // Wait for DOM to be ready before translating
    // This ensures all [data-i18n] elements exist
    if (document.readyState === 'loading') {
        // DOM not ready yet, wait for it
        document.addEventListener('DOMContentLoaded', initI18n);
    } else {
        // DOM already loaded (script loaded late)
        // Use microtask to avoid blocking
        Promise.resolve().then(initI18n);
    }
})();