const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Define paths
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const sourceDir = __dirname;
const assetsDir = path.join(rootDir, 'assets');

// Files in src/ to include in the extension package
const srcFiles = [
    'manifest.json',
    'background.js',
    'content.js',
    'popup.js',
    'popup.html',
    'popup.css',
    'fonts.css',
];

// Files in root/ to include in the extension package
const rootFiles = [
    'LICENSE',
    'README.md'
];

// Directories in assets/ to copy
const assetDirsToCopy = [
    'fonts',
    'icons'
];

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

function buildExtension() {
    try {
        console.log('Building DyslexicFix extension...');

        // Clean dist directory
        if (fs.existsSync(distDir)) {
            fs.rmSync(distDir, { recursive: true, force: true });
        }
        fs.mkdirSync(distDir, { recursive: true });

        // Copy files from src/
        for (const file of srcFiles) {
            const sourcePath = path.join(sourceDir, file);
            const destPath = path.join(distDir, file);

            if (fs.existsSync(sourcePath)) {
                copyFile(sourcePath, destPath);
                console.log(`✓ Copied src/${file}`);
            } else {
                console.log(`⚠ Warning: src/${file} not found`);
            }
        }

        // Copy files from root/
        for (const file of rootFiles) {
            const sourcePath = path.join(rootDir, file);
            const destPath = path.join(distDir, file);

            if (fs.existsSync(sourcePath)) {
                copyFile(sourcePath, destPath);
                console.log(`✓ Copied ${file}`);
            } else {
                console.log(`⚠ Warning: ${file} not found`);
            }
        }

        // Copy directories from assets/
        for (const dir of assetDirsToCopy) {
            const sourcePath = path.join(assetsDir, dir);
            const destPath = path.join(distDir, dir);

            if (fs.existsSync(sourcePath)) {
                copyDirectory(sourcePath, destPath);
                console.log(`✓ Copied assets/${dir}/`);
            } else {
                console.log(`⚠ Warning: assets/${dir}/ not found`);
            }
        }

        console.log('✓ Extension built successfully in dist/ directory');

        // Create zip file using system zip command
        createZipPackage();

    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

function createZipPackage() {
    try {
        const zipFileName = `dyslexic-fix.zip`;
        const zipPath = path.join(rootDir, zipFileName);

        // Remove existing zip file
        if (fs.existsSync(zipPath)) {
            fs.unlinkSync(zipPath);
        }

        // Create zip using system command. We cd into distDir and zip its contents into the root.
        execSync(`cd "${distDir}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
        console.log(`✓ ZIP file created at: ${zipPath}`);

        const stats = fs.statSync(zipPath);
        console.log(`✓ Created ${zipFileName} (${stats.size} bytes)`);

    } catch (error) {
        console.error('❌ Failed to create zip file:', error);
        console.log('Note: Make sure "zip" command is available on your system');
    }
}

// Run build if called directly
if (require.main === module) {
    buildExtension();
}

module.exports = buildExtension;