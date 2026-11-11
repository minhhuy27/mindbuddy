/**
 * MindBuddy PWA Icon Generator
 * 
 * Generates all PWA icons from the Buddy Sprout source image.
 * Source: public/icons/icon-512.png (512x512 Buddy Sprout design)
 * 
 * Usage: node scripts/generate-icons.js
 * 
 * For generating from a new source image:
 *   node scripts/generate-icons-from-image.js <path-to-source-image.jpg>
 */
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');
const SOURCE_ICON = path.join(ICONS_DIR, 'icon-512.png');

const REGULAR_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const MASKABLE_SIZES = [192, 512];
const MASKABLE_SAFE_ZONE = 0.80;

async function main() {
  if (!fs.existsSync(SOURCE_ICON)) {
    console.error(`Source icon not found: ${SOURCE_ICON}`);
    console.error('Run generate-icons-from-image.js first with a source image.');
    process.exit(1);
  }

  const sourceImage = await loadImage(fs.readFileSync(SOURCE_ICON));
  console.log('Generating PWA icons from Buddy Sprout design...');

  for (const size of REGULAR_SIZES) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    const r = Math.round(size * 0.18);
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.lineTo(size - r, 0);
    ctx.arcTo(size, 0, size, r, r); ctx.lineTo(size, size - r);
    ctx.arcTo(size, size, size - r, size, r); ctx.lineTo(r, size);
    ctx.arcTo(0, size, 0, size - r, r); ctx.lineTo(0, r);
    ctx.arcTo(0, 0, r, 0, r); ctx.closePath(); ctx.clip();
    ctx.drawImage(sourceImage, 0, 0, size, size);
    const buf = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(ICONS_DIR, `icon-${size}.png`), buf);
    console.log(`  icon-${size}.png (${(buf.length / 1024).toFixed(1)}KB)`);
  }

  for (const size of MASKABLE_SIZES) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#6c63ff';
    ctx.fillRect(0, 0, size, size);
    const safe = Math.round(size * MASKABLE_SAFE_ZONE);
    const off = Math.round((size - safe) / 2);
    ctx.drawImage(sourceImage, off, off, safe, safe);
    const buf = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(ICONS_DIR, `icon-maskable-${size}.png`), buf);
    console.log(`  icon-maskable-${size}.png (${(buf.length / 1024).toFixed(1)}KB)`);
  }

  // Favicon
  const fav = createCanvas(32, 32);
  const fctx = fav.getContext('2d');
  fctx.drawImage(sourceImage, 0, 0, 32, 32);
  const fb = fav.toBuffer('image/png');
  fs.writeFileSync(path.join(ICONS_DIR, 'favicon-32.png'), fb);
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'favicon.png'), fb);
  console.log(`  favicon-32.png (${(fb.length / 1024).toFixed(1)}KB)`);

  console.log('All icons generated successfully!');
}

main().catch(err => { console.error(err); process.exit(1); });
