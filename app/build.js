const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Define paths
const projectRoot = path.join(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const sourceDir = __dirname;
const fontsDir = path.join(__dirname, 'fonts');

// Files in src/ to include in the extension package (excluding manifest.json)
const srcFiles = [
    'background.js',
    'background-wrapper.js',
    'content.js',
    'popup.js',
    'popup.html',
    'popup.css',
    'fonts.css',
    'style.css',
];

// Files in root/ to include in the extension package
const rootFiles = [
    'LICENSE',
    'README.md'
];

// Directories to copy
const fontsDirToCopy = 'fonts';
const iconsDirToCopy = 'icons';

function copyFile(source, destination) {
    const destDir = path.dirname(destination);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(source, destination);
}

function copyDirectory(source, destination) {
    if (!fs.existsSync(destination)) {
        fs.mkdirSync(destination, { recursive: true });
    }

    const files = fs.readdirSync(source);

    for (const file of files) {
        const sourcePath = path.join(source, file);
        const destPath = path.join(destination, file);
        const stat = fs.statSync(sourcePath);

        if (stat.isDirectory()) {
            copyDirectory(sourcePath, destPath);
        } else {
            copyFile(sourcePath, destPath);
        }
    }
}

function buildExtension(browser = 'chrome') {
    try {
        console.log(`Building for ${browser}...`);

        // Browser-specific configurations
        const browserConfig = {
            chrome: {
                manifest: 'manifest-chrome.json',
                zipName: 'dyslexia-away-chrome.zip'
            },
            firefox: {
                manifest: 'manifest-firefox.json',
                zipName: 'dyslexia-away-firefox.zip'
            }
        };

        const config = browserConfig[browser];
        if (!config) {
            throw new Error(`Unsupported browser: ${browser}`);
        }

        // Create browser-specific dist directory
        const browserDistDir = path.join(distDir, browser);

        // Clean browser dist directory
        if (fs.existsSync(browserDistDir)) {
            fs.rmSync(browserDistDir, { recursive: true, force: true });
        }
        fs.mkdirSync(browserDistDir, { recursive: true });

        // Copy files from src/ (excluding manifest.json)
        for (const file of srcFiles) {
            // Skip background-wrapper.js for Firefox
            if (browser === 'firefox' && file === 'background-wrapper.js') {
                console.log(`⏭️ ${file} (skipped for Firefox)`);
                continue;
            }

            const sourcePath = path.join(sourceDir, file);
            const destPath = path.join(browserDistDir, file);

            if (fs.existsSync(sourcePath)) {
                copyFile(sourcePath, destPath);
                console.log(`✓ ${file}`);
            } else {
                console.log(`⚠ ${file} not found`);
            }
        }

        // Copy browser-specific manifest file as manifest.json
        const manifestSourcePath = path.join(sourceDir, config.manifest);
        const manifestDestPath = path.join(browserDistDir, 'manifest.json');
        if (fs.existsSync(manifestSourcePath)) {
            copyFile(manifestSourcePath, manifestDestPath);
            console.log(`✓ manifest.json`);
        } else {
            throw new Error(`Manifest not found: ${config.manifest}`);
        }

        // Copy browser polyfill for both Chrome and Firefox (keep original filename)
        const polyfillSourcePath = path.join(sourceDir, 'browser-polyfill.min.js');
        const polyfillDestPath = path.join(browserDistDir, 'browser-polyfill.min.js');
        if (fs.existsSync(polyfillSourcePath)) {
            copyFile(polyfillSourcePath, polyfillDestPath);
            console.log(`✓ browser-polyfill.min.js`);
        } else {
            console.log(`⚠ browser-polyfill.min.js not found`);
        }

        // Copy files from project root/
        for (const file of rootFiles) {
            const sourcePath = path.join(projectRoot, file);
            const destPath = path.join(browserDistDir, file);

            if (fs.existsSync(sourcePath)) {
                copyFile(sourcePath, destPath);
                console.log(`✓ ${file}`);
            } else {
                console.log(`⚠ ${file} not found`);
            }
        }

        // Copy fonts/ directory
        const fontsSourcePath = path.join(sourceDir, fontsDirToCopy);
        const fontsDestPath = path.join(browserDistDir, fontsDirToCopy);

        if (fs.existsSync(fontsSourcePath)) {
            copyDirectory(fontsSourcePath, fontsDestPath);
            console.log(`✓ ${fontsDirToCopy}/`);
        } else {
            console.log(`⚠ ${fontsDirToCopy}/ not found`);
        }

        // Copy icons/ directory
        const iconsSourcePath = path.join(sourceDir, iconsDirToCopy);
        const iconsDestPath = path.join(browserDistDir, iconsDirToCopy);

        if (fs.existsSync(iconsSourcePath)) {
            copyDirectory(iconsSourcePath, iconsDestPath);
            console.log(`✓ ${iconsDirToCopy}/`);
        } else {
            console.log(`⚠ ${iconsDirToCopy}/ not found`);
        }

        console.log(`✓ ${browser} built in dist/${browser}/`);

        // Create zip file using system zip command
        createZipPackage(browserDistDir, config.zipName);

    } catch (error) {
        console.error(`❌ ${browser} build failed:`, error);
        process.exit(1);
    }
}

function createZipPackage(browserDistDir, zipFileName) {
    try {
        const zipPath = path.join(distDir, zipFileName);

        // Remove existing zip file
        if (fs.existsSync(zipPath)) {
            fs.unlinkSync(zipPath);
        }

        // Create zip using system command
        execSync(`cd "${browserDistDir}" && zip -r "${zipFileName}" .`, { stdio: 'inherit' });

        // Move zip file to dist directory
        const tempZipPath = path.join(browserDistDir, zipFileName);
        if (fs.existsSync(tempZipPath)) {
            fs.renameSync(tempZipPath, zipPath);
        }

        console.log(`✓ ZIP created: ${zipPath}`);

        const stats = fs.statSync(zipPath);
        console.log(`✓ ${zipFileName} (${stats.size} bytes)`);

    } catch (error) {
        console.error('❌ Failed to create zip:', error);
        console.log('Note: Make sure "zip" command is available');
    }
}

// Run build if called directly
if (require.main === module) {
    const browser = process.argv[2] || 'chrome';
    buildExtension(browser);
}

module.exports = buildExtension;