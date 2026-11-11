const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');

// Compatibility wrapper for admin.apps and admin.auth in firebase-admin v13+
if (!admin.apps) {
  Object.defineProperty(admin, 'apps', {
    get: () => (admin.getApps ? admin.getApps() : []),
  });
}

if (!admin.auth) {
  admin.auth = () => getAuth();
}

if (!admin.apps.length) {
  try {
    admin.initializeApp();
  } catch (err) {
    console.error('Firebase Admin initialization error:', err.message);
  }
}

async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const idToken = authHeader.split('Bearer ')[1]?.trim();
  if (!idToken) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
    };
    return next();
  } catch (error) {
    console.error('Firebase token verification error:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const idToken = authHeader.split('Bearer ')[1]?.trim();
  if (!idToken) {
    req.user = null;
    return next();
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
    };
  } catch (error) {
    console.error('Firebase optional auth token verification error:', error.message);
    req.user = null;
  }
  return next();
}

module.exports = {
  verifyFirebaseToken,
  optionalAuth,
};
