const CACHE_VERSION = 'v2';
const OFFLINE_FILES = [
  '/Hisab/',
  '/Hisab/index.html',
  '/Hisab/style.css', 
  '/Hisab/script.js',
  '/Hisab/logo.png',
  '/Hisab/app-icon-192.png',
  '/Hisab/app-icon-512.png',
  '/Hisab/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(OFFLINE_FILES);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_VERSION) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        const responseToCache = response.clone();
        caches.open(CACHE_VERSION).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        
        return response;
      });
    }).catch(() => {
      return caches.match('/index.html');
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'warm-cache') {
    event.waitUntil(
      caches.open(CACHE_VERSION).then((cache) => {
        return cache.addAll(OFFLINE_FILES);
      })
    );
  }
});