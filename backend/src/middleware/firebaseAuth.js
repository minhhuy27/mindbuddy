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

let firebaseAdminReady = false;

if (!admin.apps.length) {
  try {
    const initConfig = {};

    // Support FIREBASE_SERVICE_ACCOUNT_KEY as JSON string (for Render/Heroku)
    // or GOOGLE_APPLICATION_CREDENTIALS as file path (for local dev)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      initConfig.credential = admin.credential.cert(serviceAccount);
    }
    // If GOOGLE_APPLICATION_CREDENTIALS is set, admin.initializeApp() picks it up automatically

    admin.initializeApp(initConfig);
    firebaseAdminReady = true;
    console.log('Firebase Admin initialized successfully.');
  } catch (err) {
    console.error('Firebase Admin initialization error:', err.message);
    console.warn('Auth verification will be skipped — all requests will be allowed.');
  }
} else {
  firebaseAdminReady = true;
}

/**
 * Middleware: Verify Firebase Auth token (required).
 * If Firebase Admin is not initialized, skip verification and allow request.
 */
async function verifyFirebaseToken(req, res, next) {
  // If Firebase Admin is not ready, skip auth (dev/staging without credentials)
  if (!firebaseAdminReady) {
    req.user = null;
    return next();
  }

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

/**
 * Middleware: Optional auth — allow unauthenticated requests.
 */
async function optionalAuth(req, res, next) {
  if (!firebaseAdminReady) {
    req.user = null;
    return next();
  }

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
  firebaseAdminReady: () => firebaseAdminReady,
};
