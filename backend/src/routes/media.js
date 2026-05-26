const express = require('express');
const crypto = require('crypto');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const multer = require('multer');

const router = express.Router();
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const ALLOWED_IMAGE_HOSTS = [
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
];

ffmpeg.setFfmpegPath(ffmpegPath);

const uploadVideo = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '') || '.video';
      cb(null, `mindbuddy-video-${Date.now()}-${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: {
    fileSize: MAX_VIDEO_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype?.startsWith('video/')) return cb(null, true);
    return cb(new Error('Only video files are allowed'));
  },
});

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

function compressVideo(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-vf',
        "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))'",
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '28',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '96k',
        '-movflags',
        '+faststart',
      ])
      .format('mp4')
      .on('end', resolve)
      .on('error', reject)
      .save(outputPath);
  });
}

async function removeTempFile(filePath) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.warn('Could not remove temp file:', filePath, error?.message || error);
    }
  }
}

router.post('/compress-video', uploadVideo.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Missing video file' });
  }

  const inputPath = req.file.path;
  const outputPath = path.join(os.tmpdir(), `mindbuddy-compressed-${Date.now()}-${crypto.randomUUID()}.mp4`);
  const originalName = req.file.originalname || 'video-checkin';
  const safeBaseName = path.basename(originalName, path.extname(originalName)).replace(/[^\w.-]+/g, '-');
  const outputName = `${safeBaseName || 'video-checkin'}-compressed.mp4`;

  try {
    await compressVideo(inputPath, outputPath);
    const outputStat = await fs.stat(outputPath);

    if (!outputStat.size || outputStat.size >= req.file.size * 0.98) {
      res.setHeader('X-MindBuddy-Compressed', 'false');
      res.setHeader('X-MindBuddy-Original-Size', String(req.file.size));
      res.setHeader('X-MindBuddy-Compressed-Size', String(outputStat.size || req.file.size));
      res.setHeader('Content-Type', req.file.mimetype || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);
      return res.sendFile(inputPath);
    }

    res.setHeader('X-MindBuddy-Compressed', 'true');
    res.setHeader('X-MindBuddy-Original-Size', String(req.file.size));
    res.setHeader('X-MindBuddy-Compressed-Size', String(outputStat.size));
    res.setHeader('X-MindBuddy-File-Name', encodeURIComponent(outputName));
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(outputName)}"`);
    return res.sendFile(outputPath);
  } catch (error) {
    console.error('Video compression error:', error);
    return res.status(500).json({ error: 'Video compression failed' });
  } finally {
    res.on('finish', () => {
      removeTempFile(inputPath);
      removeTempFile(outputPath);
    });
  }
});

module.exports = router;
