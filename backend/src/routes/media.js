const express = require('express');

const router = express.Router();
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const ALLOWED_IMAGE_HOSTS = [
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
];

function isAllowedImageUrl(value) {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return false;
    return ALLOWED_IMAGE_HOSTS.includes(url.hostname) || url.hostname.endsWith('.firebasestorage.app');
  } catch {
    return false;
  }
}

router.get('/image', async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl || !isAllowedImageUrl(imageUrl)) {
    return res.status(400).json({ error: 'Invalid image url' });
  }

  try {
    const upstream = await fetch(imageUrl);
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'Could not fetch image' });
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return res.status(415).json({ error: 'URL is not an image' });
    }

    const contentLength = Number(upstream.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: 'Image is too large' });
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: 'Image is too large' });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.send(buffer);
  } catch (error) {
    console.error('Image proxy error:', error);
    return res.status(502).json({ error: 'Image proxy failed' });
  }
});

module.exports = router;
