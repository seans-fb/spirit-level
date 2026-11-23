/**
 * Service worker for Level: makes the app installable and usable offline.
 * Bump CACHE_VERSION whenever you change files, so phones pick up the new version.
 */
const CACHE_VERSION = 'level-v1';

// Files from this site, cached when the app is installed
const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './icon-maskable-192.png',
    './icon-maskable-512.png'
];

// Third-party files the page needs (styles and font)
const CDN_HOSTS = ['cdn.tailwindcss.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const CDN_PRECACHE = [
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600;700&display=swap'
];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_VERSION);
        await cache.addAll(APP_SHELL);
        // CDN files are best-effort: a failure here must not block installation
        await Promise.all(CDN_PRECACHE.map(url =>
            fetch(url, { mode: 'no-cors' }).then(res => cache.put(url, res)).catch(() => {})
        ));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);

    // Pages: network first, so updates show up; fall back to the cached copy offline
    if (request.mode === 'navigate') {
        event.respondWith((async () => {
            try {
                const response = await fetch(request);
                if (response.ok) {
                    const cache = await caches.open(CACHE_VERSION);
                    cache.put('./index.html', response.clone());
                }
                return response;
            } catch (_) {
                return (await caches.match('./index.html')) || (await caches.match('./'));
            }
        })());
        return;
    }

    const sameOrigin = url.origin === self.location.origin;
    if (!sameOrigin && !CDN_HOSTS.includes(url.hostname)) return;

    // Everything else: serve from cache straight away, refresh it in the background
    event.respondWith((async () => {
        const cache = await caches.open(CACHE_VERSION);
        const cached = await cache.match(request);
        const network = fetch(request)
            .then(response => {
                if (response && (response.ok || response.type === 'opaque')) {
                    cache.put(request, response.clone());
                }
                return response;
            })
            .catch(() => cached);
        return cached || network;
    })());
});
