// Served as /sw.js on thefreemancup.com only (see vercel.json). Anyone who
// opened the domain before the scoreboard shipped has the app's service
// worker installed on this origin, and it would keep serving the cached app
// shell forever. This worker replaces it, wipes the caches, unregisters
// itself, and reloads every open tab. The app's own origin never sees it.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(c => c.navigate(c.url));
  })());
});
