/**
 * Generate PWA icons from a source image (Buddy Sprout concept).
 * Uses @napi-rs/canvas to resize the source image into all required PWA sizes.
 * 
 * Usage: node scripts/generate-icons-from-image.js <source-image-path>
 */
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

const REGULAR_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const MASKABLE_SIZES = [192, 512];

// Maskable icons need 10% padding on each side (safe zone = 80% center)
const MASKABLE_SAFE_ZONE = 0.80;

async function generateRegularIcon(sourceImage, size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Draw rounded rectangle clip path
  const cornerRadius = Math.round(size * 0.18);
  ctx.beginPath();
  ctx.moveTo(cornerRadius, 0);
  ctx.lineTo(size - cornerRadius, 0);
  ctx.arcTo(size, 0, size, cornerRadius, cornerRadius);
  ctx.lineTo(size, size - cornerRadius);
  ctx.arcTo(size, size, size - cornerRadius, size, cornerRadius);
  ctx.lineTo(cornerRadius, size);
  ctx.arcTo(0, size, 0, size - cornerRadius, cornerRadius);
  ctx.lineTo(0, cornerRadius);
  ctx.arcTo(0, 0, cornerRadius, 0, cornerRadius);
  ctx.closePath();
  ctx.clip();

  // Draw source image scaled to fill
  ctx.drawImage(sourceImage, 0, 0, size, size);

  const filename = `icon-${size}.png`;
  const filePath = path.join(ICONS_DIR, filename);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filePath, buffer);
  console.log(`Generated: ${filename} (${size}x${size}) — ${(buffer.length / 1024).toFixed(1)}KB`);
}

async function generateMaskableIcon(sourceImage, size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Fill background with the app's primary purple color
  ctx.fillStyle = '#6c63ff';
  ctx.fillRect(0, 0, size, size);

  // Draw the source image in the safe zone (center 80%)
  const safeSize = Math.round(size * MASKABLE_SAFE_ZONE);
  const offset = Math.round((size - safeSize) / 2);
  ctx.drawImage(sourceImage, offset, offset, safeSize, safeSize);

  const filename = `icon-maskable-${size}.png`;
  const filePath = path.join(ICONS_DIR, filename);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filePath, buffer);
  console.log(`Generated: ${filename} (${size}x${size}, maskable) — ${(buffer.length / 1024).toFixed(1)}KB`);
}

async function generateFavicon(sourceImage) {
  // Generate 32x32 favicon
  const size = 32;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(sourceImage, 0, 0, size, size);

  const filename = 'favicon-32.png';
  const filePath = path.join(ICONS_DIR, filename);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filePath, buffer);
  console.log(`Generated: ${filename} (${size}x${size}) — ${(buffer.length / 1024).toFixed(1)}KB`);

  // Also copy as favicon.ico replacement (actually PNG)
  const faviconPath = path.join(__dirname, '..', 'public', 'favicon.png');
  fs.writeFileSync(faviconPath, buffer);
  console.log(`Generated: favicon.png (${size}x${size})`);
}

async function main() {
  const sourceImagePath = process.argv[2];
  if (!sourceImagePath) {
    console.error('Usage: node generate-icons-from-image.js <source-image-path>');
    process.exit(1);
  }

  if (!fs.existsSync(sourceImagePath)) {
    console.error(`Source image not found: ${sourceImagePath}`);
    process.exit(1);
  }

  console.log(`Loading source image: ${sourceImagePath}`);
  const sourceImage = await loadImage(fs.readFileSync(sourceImagePath));
  console.log(`Source image size: ${sourceImage.width}x${sourceImage.height}`);
  console.log('');

  console.log('=== Regular Icons (rounded corners) ===');
  for (const size of REGULAR_SIZES) {
    await generateRegularIcon(sourceImage, size);
  }

  console.log('');
  console.log('=== Maskable Icons (full bleed with safe zone) ===');
  for (const size of MASKABLE_SIZES) {
    await generateMaskableIcon(sourceImage, size);
  }

  console.log('');
  await generateFavicon(sourceImage);

  console.log('');
  console.log(`All icons generated in: ${ICONS_DIR}`);
  console.log(`Total files: ${REGULAR_SIZES.length} regular + ${MASKABLE_SIZES.length} maskable + 2 favicon = ${REGULAR_SIZES.length + MASKABLE_SIZES.length + 2}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

