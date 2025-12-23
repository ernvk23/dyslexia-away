
const canvas = document.getElementById('canvas-bg');

const ctx = canvas.getContext('2d');

let width, height, particles;

const speed = 0.5;

// Cached CSS variables to avoid frequent DOM reads
let cachedParticleColor = '';
let cachedConnectionColor = '';
const CSS_UPDATE_INTERVAL = 1000; // Update CSS variables every 1 second

// Function to update cached CSS variables
function updateCssCache() {
    cachedParticleColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--particle-color').trim();
    cachedConnectionColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--particle-connection-color').trim();
}

// Dynamic particle settings based on screen width
// Optimized for performance on older devices while maintaining visual appeal
let cachedScreenWidth = 0;
let cachedScreenHeight = 0;

function getParticleSettings() {
    if (cachedScreenWidth < 768) {
        // Mobile: conservative settings for older phones
        return { count: 45, distance: 140 };
    } else if (cachedScreenWidth < 1024) {
        // Tablet: moderate settings
        return { count: 80, distance: 220 };
    }
    // Desktop: good visuals while maintaining 60fps on older machines
    return { count: 110, distance: 280 };
}


// Initialize cache and set up periodic updates
updateCssCache();
setInterval(updateCssCache, CSS_UPDATE_INTERVAL);

class Particle {
    constructor() {
        this.init();
    }

    init() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * speed;
        this.vy = (Math.random() - 0.5) * speed;
        this.radius = Math.random() * 2.5 + 1.2; // Increased from 1.5+0.8 to 2.5+1.2
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0) this.x = width;
        if (this.x > width) this.x = 0;
        if (this.y < 0) this.y = height;
        if (this.y > height) this.y = 0;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        // Use cached particle color instead of querying DOM every frame
        ctx.fillStyle = cachedParticleColor;
        ctx.fill();
    }
}

function updateScreenSize() {
    cachedScreenWidth = window.innerWidth;
    cachedScreenHeight = window.innerHeight;
    width = canvas.width = cachedScreenWidth;
    height = canvas.height = cachedScreenHeight;
}

function resize() {
    updateScreenSize();
    initParticles();
}

function initParticles() {
    particles = [];
    const settings = getParticleSettings();
    for (let i = 0; i < settings.count; i++) {
        particles.push(new Particle());
    }
}

function animate() {
    ctx.clearRect(0, 0, width, height);
    const settings = getParticleSettings();
    const distanceSq = settings.distance * settings.distance; // Pre-calculate squared distance

    for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        p1.update();
        p1.draw();

        for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < distanceSq) {
                // Only calculate sqrt when we actually need it for opacity
                const dist = Math.sqrt(distSq);
                ctx.beginPath();

                // Apply distance-based opacity with reduced base opacity (0.15 instead of 0.25)
                const opacity = 0.15 * (1 - dist / settings.distance);

                const colorWithOpacity = cachedConnectionColor.replace(/[\d.]+(?=\)$)/, `${opacity}`);
                ctx.strokeStyle = colorWithOpacity;
                ctx.lineWidth = 1.2; // Increased from 0.8 to 1.2
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        }
    }
    requestAnimationFrame(animate);
}

// Defer initial size reading to first animation frame to avoid forced reflow during load
function start() {
    updateScreenSize();
    initParticles();
    animate();
}

window.addEventListener('resize', resize);
requestAnimationFrame(start);

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
