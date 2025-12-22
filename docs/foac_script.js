// Inline i18n translation - runs immediately to reduce flash
(function () {
    // Simple translations object - will be loaded from JSON
    let translations = {};

    // Detect language
    function detectLanguage() {
        const browserLang = navigator.language || navigator.userLanguage;
        const langCode = browserLang.split('-')[0].toLowerCase();
        return langCode === 'es' ? 'es' : 'en';
    }

    // Set data-lang attribute synchronously to allow CSS targeting before translation
    const lang = detectLanguage();
    document.documentElement.setAttribute('data-lang', lang);

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

    // Translate page - exactly like popup.js but with HTML support
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

    // Run translation as microtask to not block UI initialization
    Promise.resolve().then(initI18n);
})();