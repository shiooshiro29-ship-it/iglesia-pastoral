const CACHE = 'miembro-v3';
const ASSETS = ['./', './index.html', './css/styles.css', './js/api.js', './js/app.js', './manifest.json', '../config.js'];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);
    if (e.request.method !== 'GET' || !/^https?:$/.test(url.protocol)) return;
    if (url.origin !== self.location.origin) return;
    e.respondWith(
        caches.match(e.request).then((cached) => cached || fetch(e.request).then((resp) => {
            const copy = resp.clone();
            if (resp.ok) caches.open(CACHE).then((c) => c.put(e.request, copy));
            return resp;
        }).catch(() => caches.match('./index.html')))
    );
});
