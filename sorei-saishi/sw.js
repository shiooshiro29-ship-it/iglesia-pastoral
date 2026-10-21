const CACHE = 'sorei-v2';
const RUTAS = ['./', './index.html', './manifest.json', './css/styles.css', './js/api.js', './js/app.js', '../config.js'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(RUTAS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    if (e.request.method !== 'GET' || !/^https?:$/.test(url.protocol)) return;
    if (url.origin !== self.location.origin) return;
    e.respondWith(
        caches.match(e.request).then(res => res || fetch(e.request).then(net => {
            const copy = net.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
            return net;
        }))
    );
});
