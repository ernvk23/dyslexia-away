
// Theme switching functionality - simplified to light/dark only
(function () {
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (!themeToggleBtn) return;

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

    // Get current theme from localStorage or default to system preference
    function getCurrentTheme() {
        const saved = localStorage.getItem('site-theme');
        if (saved === 'light' || saved === 'dark') {
            return saved;
        }
        // Default to system preference
        return prefersDark.matches ? 'dark' : 'light';
    }

    // Apply theme to document (only if changed)
    function applyTheme(theme) {
        const current = document.documentElement.getAttribute('data-theme');
        if (current === theme) return;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('site-theme', theme);
    }

    // Toggle between light and dark
    function toggleTheme() {
        const current = getCurrentTheme();
        const nextTheme = current === 'light' ? 'dark' : 'light';
        applyTheme(nextTheme);
    }

    // Initialize theme (skip if already set by inline script)
    const initialTheme = getCurrentTheme();
    applyTheme(initialTheme);

    // Add click handler
    themeToggleBtn.addEventListener('click', toggleTheme);
})();

// Navbar scroll effect
(function () {
    const nav = document.querySelector('nav');
    if (!nav) return;

    function updateNavScroll() {
        if (window.scrollY > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    }

    // Defer initial check to avoid forced reflow during load
    requestAnimationFrame(updateNavScroll);

    // Throttle scroll events for performance
    let ticking = false;
    window.addEventListener('scroll', function () {
        if (!ticking) {
            window.requestAnimationFrame(function () {
                updateNavScroll();
                ticking = false;
            });
            ticking = true;
        }
    });
})();

// Burger menu toggle functionality
(function () {
    const burgerBtn = document.getElementById('burgerMenuBtn');
    const navLinks = document.getElementById('navLinks');
    if (!burgerBtn || !navLinks) return;

    function toggleMenu() {
        const isExpanded = burgerBtn.getAttribute('aria-expanded') === 'true';
        burgerBtn.setAttribute('aria-expanded', !isExpanded);
        navLinks.classList.toggle('active');

        // Prevent body scroll when menu is open
        document.body.style.overflow = isExpanded ? '' : 'hidden';
    }

    function closeMenu() {
        burgerBtn.setAttribute('aria-expanded', 'false');
        navLinks.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Click burger button
    burgerBtn.addEventListener('click', toggleMenu);

    // Close menu when clicking on a nav link (for anchor links)
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            // Only close if it's an anchor link within the page (not external)
            if (link.getAttribute('href').startsWith('#')) {
                closeMenu();
            }
        });
    });

    // Close menu when pressing Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMenu();
        }
    });

    // Close menu when clicking outside on mobile
    document.addEventListener('click', (e) => {
        const isBurgerClick = burgerBtn.contains(e.target);
        const isNavLinksClick = navLinks.contains(e.target);
        const isMenuOpen = navLinks.classList.contains('active');

        if (isMenuOpen && !isBurgerClick && !isNavLinksClick) {
            closeMenu();
        }
    });

    // Close menu on window resize (if resizing to desktop)
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            closeMenu();
        }
    });

    // Close menu when scrolling (if menu is open)
    window.addEventListener('scroll', () => {
        if (navLinks.classList.contains('active')) {
            closeMenu();
        }
    });
})();

// Image loading detection
(function () {
    const images = document.querySelectorAll('.fade-img');
    images.forEach(img => {
        if (img.complete) img.classList.add('loaded');
        else img.addEventListener('load', () => img.classList.add('loaded'));
    });
})();
