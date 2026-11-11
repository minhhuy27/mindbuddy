const rateLimit = require('express-rate-limit');

const aiRateLimiter = rateLimit({
  windowMs: 60000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.uid || (rateLimit.ipKeyGenerator ? rateLimit.ipKeyGenerator(req) : req.ip),
  message: { error: 'Too many requests, please try again later.' },
  validate: { keyGeneratorIpFallback: false },
});

module.exports = {
  aiRateLimiter,
};
