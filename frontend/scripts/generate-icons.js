const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

const REGULAR_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const MASKABLE_SIZES = [192, 512];

function drawRoundedRect(ctx, x, y, width, height, radius) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
    ctx.fill();
  }
}

function generateRegularIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Purple rounded rectangle background
  const cornerRadius = Math.round(size * 0.2);
  ctx.fillStyle = '#6c63ff';
  drawRoundedRect(ctx, 0, 0, size, size, cornerRadius);

  // Centered bold white "M"
  const fontSize = Math.round(size * 0.55);
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('M', size / 2, size / 2);

  const filename = `icon-${size}.png`;
  const filePath = path.join(ICONS_DIR, filename);
  fs.writeFileSync(filePath, canvas.toBuffer('image/png'));
  console.log(`Generated: ${filename} (${size}x${size})`);
}

function generateMaskableIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Full bleed background for maskable icon
  ctx.fillStyle = '#6c63ff';
  ctx.fillRect(0, 0, size, size);

  // Centered bold white "M" inside safe zone (20% padding)
  const fontSize = Math.round(size * 0.44);
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('M', size / 2, size / 2);

  const filename = `icon-maskable-${size}.png`;
  const filePath = path.join(ICONS_DIR, filename);
  fs.writeFileSync(filePath, canvas.toBuffer('image/png'));
  console.log(`Generated: ${filename} (${size}x${size})`);
}

console.log('Generating PWA icons...');
for (const size of REGULAR_SIZES) {
  generateRegularIcon(size);
}

for (const size of MASKABLE_SIZES) {
  generateMaskableIcon(size);
}

console.log('All icons generated successfully in', ICONS_DIR);
