// Self-destruct: clears all caches, unregisters, and reloads open tabs.
// (The old caching worker got in the way during active editing.)
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    const keys = await caches.keys();
    await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    await self.registration.unregister();
    const clients = await self.clients.matchAll();
    clients.forEach(function (c) { c.navigate(c.url); });
  })());
});
