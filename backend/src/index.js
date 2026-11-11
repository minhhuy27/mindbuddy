require('dotenv').config();
const express = require('express');
const cors = require('cors');
const aiRoutes = require('./routes/ai');
const mediaRoutes = require('./routes/media');
const { verifyFirebaseToken } = require('./middleware/firebaseAuth');
const { aiRateLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3000',
    ];
    // Allow Netlify subdomain and custom domain (mobile clients won't send Origin header)
    if (!origin || allowed.includes(origin) || origin.endsWith('.netlify.app')) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
  exposedHeaders: [
    'X-MindBuddy-Compressed',
    'X-MindBuddy-Original-Size',
    'X-MindBuddy-Compressed-Size',
    'X-MindBuddy-File-Name',
  ],
}));
app.use(express.json());

app.use('/api/ai', verifyFirebaseToken, aiRateLimiter, aiRoutes);
app.use('/api/media', verifyFirebaseToken, mediaRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', version: '1.1.0' }));

app.listen(PORT, () => {
  console.log(`MindBuddy backend running on port ${PORT}`);
});
