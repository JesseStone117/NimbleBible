// Node.js script to generate PNG icons from SVG
// Requires: npm install sharp
// Run: node generate-icons.js

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
    sharp = require('sharp');
} catch (e) {
    console.error('Error: sharp module not found.');
    console.log('Please install it with: npm install sharp');
    console.log('\nAlternatively, open generate-icons.html in your browser to generate icons.');
    process.exit(1);
}

const iconsDir = path.join(__dirname, 'icons');

// Icon configurations
const icons = [
    { svg: 'icon-192.svg', png: 'icon-192.png', size: 192 },
    { svg: 'icon-512.svg', png: 'icon-512.png', size: 512 },
    { svg: 'icon-maskable-192.svg', png: 'icon-maskable-192.png', size: 192 },
    { svg: 'icon-maskable-512.svg', png: 'icon-maskable-512.png', size: 512 }
];

async function generateIcons() {
    console.log('Generating PNG icons...\n');
    
    for (const icon of icons) {
        const svgPath = path.join(iconsDir, icon.svg);
        const pngPath = path.join(iconsDir, icon.png);
        
        if (!fs.existsSync(svgPath)) {
            console.log(`⚠️  SVG file not found: ${icon.svg}`);
            continue;
        }
        
        try {
            await sharp(svgPath)
                .resize(icon.size, icon.size)
                .png()
                .toFile(pngPath);
            console.log(`✅ Generated: ${icon.png}`);
        } catch (error) {
            console.error(`❌ Error generating ${icon.png}:`, error.message);
        }
    }
    
    console.log('\n✨ Icon generation complete!');
}

generateIcons().catch(console.error);

