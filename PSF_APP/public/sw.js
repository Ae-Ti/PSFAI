// Minimal Service Worker (Bypass Cache for Mockup)
self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
    // Do nothing, just bypass for PWA install criteria
    e.respondWith(fetch(e.request));
});
