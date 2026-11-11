/* MindBuddy Service Worker — Workbox-powered offline caching */
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js');

// Configure Workbox
workbox.setConfig({ debug: false });

const { precaching, routing, strategies, expiration, cacheableResponse } = workbox;
const { registerRoute, NavigationRoute, setCatchHandler } = routing;
const { CacheFirst, NetworkFirst, StaleWhileRevalidate } = strategies;
const { ExpirationPlugin } = expiration;
const { CacheableResponsePlugin } = cacheableResponse;

// --- App Shell: Cache the navigation (HTML pages) with NetworkFirst ---
const htmlStrategy = new NetworkFirst({
  cacheName: 'mb-pages',
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
    new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 7 * 24 * 60 * 60 }),
  ],
});

// All navigation requests → NetworkFirst (try network, fallback to cache)
const navigationRoute = new NavigationRoute(htmlStrategy, {
  // Don't cache API or media proxy requests as navigation
  denylist: [/^\/api\//, /^\/sw\.js$/],
});
registerRoute(navigationRoute);

// --- Static Assets: CacheFirst for JS/CSS chunks ---
registerRoute(
  ({ request }) =>
    request.destination === 'script' ||
    request.destination === 'style',
  new CacheFirst({
    cacheName: 'mb-static',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

// --- Google Fonts: CacheFirst ---
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'mb-fonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 }),
    ],
  })
);

// --- Images: CacheFirst ---
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'mb-images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

// --- Firebase Storage media: StaleWhileRevalidate ---
registerRoute(
  ({ url }) => url.hostname.includes('firebasestorage.googleapis.com'),
  new StaleWhileRevalidate({
    cacheName: 'mb-firebase-media',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 14 * 24 * 60 * 60 }),
    ],
  })
);

// --- API calls: NetworkFirst (try network, fallback to cached response) ---
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'mb-api',
    networkTimeoutSeconds: 15,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 }),
    ],
  })
);

// --- Offline Fallback ---
setCatchHandler(async ({ event }) => {
  if (event.request.destination === 'document') {
    return caches.match('/offline.html');
  }
  return Response.error();
});

// Pre-cache the offline page on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('mb-offline').then((cache) => cache.add('/offline.html'))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// --- Notification Handling (preserved from original) ---
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action;
  let urlToOpen = '/';

  if (action === 'checkin') {
    urlToOpen = '/mood?tab=today&quick=mood';
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(urlToOpen);
    })
  );
});

// --- SW Update Messaging ---
// Listen for skip-waiting message from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
