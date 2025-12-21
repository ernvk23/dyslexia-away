const canvas = document.getElementById('canvas-bg');
if (!canvas) {
    console.error('Canvas element not found!');
} else {
    console.log('Canvas found:', canvas);
}
const ctx = canvas.getContext('2d');
if (!ctx) {
    console.error('Could not get 2D context');
}

let width, height, particles;

const speed = 0.8;

// Dynamic particle settings based on screen width
function getParticleSettings() {
    const screenWidth = window.innerWidth;
    if (screenWidth < 768) {
        return { count: 50, distance: 150 };  // Mobile: fewer particles, shorter connections
    }
    return { count: 100, distance: 200 };     // Desktop: default settings
}

console.log('Canvas script loaded');

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
        // Get particle color from CSS variable
        ctx.fillStyle = getComputedStyle(document.documentElement)
            .getPropertyValue('--particle-color').trim();
        ctx.fill();
    }
}

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    console.log('Canvas resized to', width, 'x', height);
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

    for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        p1.update();
        p1.draw();

        for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < settings.distance) {
                ctx.beginPath();
                // Get connection color from CSS variable
                const connectionColor = getComputedStyle(document.documentElement)
                    .getPropertyValue('--particle-connection-color').trim();
                // Apply distance-based opacity with reduced base opacity (0.15 instead of 0.25)
                const opacity = 0.15 * (1 - dist / settings.distance);
                // Simple approach: assume color is rgba and replace alpha
                const colorWithOpacity = connectionColor.replace(/[\d.]+\)$/, `${opacity})`);
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

window.addEventListener('resize', resize);
resize();
animate();

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

    // Apply theme to document
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('site-theme', theme);
        console.log('Theme set to:', theme);
    }

    // Toggle between light and dark
    function toggleTheme() {
        const current = getCurrentTheme();
        const nextTheme = current === 'light' ? 'dark' : 'light';
        applyTheme(nextTheme);
    }

    // Initialize theme
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

    // Initial check
    updateNavScroll();

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
