// Node.js script to generate PNG icons using canvas
// Requires: npm install canvas
// Run: node generate-icons-canvas.js

const fs = require('fs');
const path = require('path');

let canvas, createCanvas, loadImage;
try {
    const canvasModule = require('canvas');
    createCanvas = canvasModule.createCanvas;
    loadImage = canvasModule.loadImage;
} catch (e) {
    console.error('Error: canvas module not found.');
    console.log('Please install it with: npm install canvas');
    console.log('\nAlternatively, open generate-icons.html in your browser to generate icons.');
    process.exit(1);
}

const iconsDir = path.join(__dirname, 'icons');

function createIcon(size, isMaskable = false) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, size, size);

    if (isMaskable) {
        // Draw safe zone circle (80% of canvas)
        const centerX = size / 2;
        const centerY = size / 2;
        const radius = size * 0.4;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#1e1e1e';
        ctx.fill();
    }

    // Text "NB"
    ctx.fillStyle = '#3b82f6';
    ctx.font = `bold ${size * 0.52}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NB', size / 2, size / 2);

    return canvas;
}

async function generateIcons() {
    console.log('Generating PNG icons...\n');
    
    const icons = [
        { size: 192, maskable: false, filename: 'icon-192.png' },
        { size: 512, maskable: false, filename: 'icon-512.png' },
        { size: 192, maskable: true, filename: 'icon-maskable-192.png' },
        { size: 512, maskable: true, filename: 'icon-maskable-512.png' }
    ];

    for (const icon of icons) {
        try {
            const canvas = createIcon(icon.size, icon.maskable);
            const buffer = canvas.toBuffer('image/png');
            const filePath = path.join(iconsDir, icon.filename);
            fs.writeFileSync(filePath, buffer);
            console.log(`✅ Generated: ${icon.filename}`);
        } catch (error) {
            console.error(`❌ Error generating ${icon.filename}:`, error.message);
        }
    }
    
    console.log('\n✨ Icon generation complete!');
}

generateIcons().catch(console.error);

