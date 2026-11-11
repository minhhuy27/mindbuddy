/* MindBuddy Service Worker — Workbox-powered offline caching */
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js');

// Configure Workbox
workbox.setConfig({ debug: false });

const { precaching, routing, strategies, expiration, cacheableResponse } = workbox;
const { registerRoute, NavigationRoute, setCatchHandler } = routing;
const { CacheFirst, NetworkFirst, StaleWhileRevalidate } = strategies;
const { ExpirationPlugin } = expiration;
const { CacheableResponsePlugin } = cacheableResponse;

const SHARE_TARGET_CACHE = 'mb-share-target';
const SHARE_PAYLOAD_KEY = '/share-payload.json';
const CHECKIN_META_CACHE = 'mb-notif-meta';
const CHECKIN_META_KEY = '/checkin-meta.json';
const CHECKIN_ACTIONS = [
  { action: 'checkin', title: '💭 Check-in ngay' },
  { action: 'dismiss', title: 'Để sau' },
];

async function handleShareTargetPost(request) {
  const redirectUrl = new URL('/mood', self.location.origin);
  redirectUrl.searchParams.set('quick', 'share');

  try {
    const formData = await request.formData();
    const rawTitle = formData.get('title');
    const rawText = formData.get('text');
    const rawUrl = formData.get('url');

    const title = typeof rawTitle === 'string' ? rawTitle : '';
    const text = typeof rawText === 'string' ? rawText : '';
    const sharedUrl = typeof rawUrl === 'string' ? rawUrl : '';
    const files = formData
      .getAll('media')
      .filter((entry) => entry instanceof File && entry.size > 0);

    const cache = await caches.open(SHARE_TARGET_CACHE);
    const existingKeys = await cache.keys();
    await Promise.all(existingKeys.map((req) => cache.delete(req)));

    const fileKeys = [];
    for (let idx = 0; idx < files.length; idx += 1) {
      const file = files[idx];
      const fileKey = `/share-file-${idx}`;
      fileKeys.push(fileKey);
      await cache.put(
        fileKey,
        new Response(file, {
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
            'X-Share-File-Name': encodeURIComponent(file.name || 'shared-file'),
          },
        })
      );
    }

    await cache.put(
      SHARE_PAYLOAD_KEY,
      new Response(
        JSON.stringify({
          title,
          text,
          url: sharedUrl,
          fileKeys,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    if (title && title.length <= 200) {
      redirectUrl.searchParams.set('title', title);
    }
    if (text && text.length <= 500) {
      redirectUrl.searchParams.set('text', text);
    }
    if (sharedUrl && sharedUrl.length <= 500) {
      redirectUrl.searchParams.set('url', sharedUrl);
    }
  } catch (err) {
    // Redirect cleanly to share entry even if parsing fails
  }

  return Response.redirect(redirectUrl.toString(), 303);
}

// --- Web Share Target Level 2 POST Handler (registered before Workbox routes) ---
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'POST') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/mood' && url.searchParams.get('quick') === 'share') {
    event.respondWith(handleShareTargetPost(event.request));
  }
});

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

// --- Notification Action & Click Handling ---
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action;

  if (action === 'dismiss') {
    return;
  }

  const targetPath =
    action === 'checkin'
      ? '/mood?tab=today&quick=mood'
      : (event.notification.data?.url || '/');
  const parsedUrl = new URL(targetPath, self.location.origin);
  const targetUrl =
    parsedUrl.origin === self.location.origin
      ? parsedUrl.href
      : `${self.location.origin}/`;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          await client.focus();
          if (client.url !== targetUrl && 'navigate' in client) {
            try {
              await client.navigate(targetUrl);
            } catch (err) {
              // Keep window focused even if client navigation is unsupported
            }
          }
          return client;
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

// --- Periodic Background Sync ---
async function showPeriodicCheckinReminder() {
  try {
    const cache = await caches.open(CHECKIN_META_CACHE);
    const metaRes = await cache.match(CHECKIN_META_KEY);
    if (metaRes) {
      const meta = await metaRes.json();
      if (meta && meta.enabled === false) {
        return;
      }
    }
  } catch (err) {
    // Proceed with notification if metadata cache is unreadable
  }

  await self.registration.showNotification('💭 Nhắc check-in cảm xúc', {
    body: 'Hôm nay bạn cảm thấy thế nào? Hãy ghi lại nhé!',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    tag: 'mb-daily-checkin',
    renotify: true,
    vibrate: [100, 50, 100],
    data: { url: '/mood?tab=today&quick=mood' },
    actions: CHECKIN_ACTIONS,
  });
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'mb-checkin-reminder') {
    event.waitUntil(showPeriodicCheckinReminder());
  }
});

// --- SW Update & Notification Messaging ---
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data.type === 'SHOW_NOTIFICATION' && data.title) {
    const notifOptions = {
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      ...(data.options && typeof data.options === 'object' ? data.options : {}),
    };
    event.waitUntil(self.registration.showNotification(data.title, notifOptions));
    return;
  }

  if (data.type === 'CHECKIN_REMINDER_META') {
    event.waitUntil(
      caches.open(CHECKIN_META_CACHE).then((cache) =>
        cache.put(
          CHECKIN_META_KEY,
          new Response(
            JSON.stringify({
              enabled: data.enabled !== false,
              hour: data.hour,
              minute: data.minute,
              updatedAt: Date.now(),
            }),
            { headers: { 'Content-Type': 'application/json' } }
          )
        )
      )
    );
  }
});
