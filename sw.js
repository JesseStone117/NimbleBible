const CACHE_PREFIX = 'nimble-bible';
const RUNTIME_CACHE = `${CACHE_PREFIX}-runtime`;

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) =>
                Promise.all(
                    cacheNames
                        .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX) && cacheName !== RUNTIME_CACHE)
                        .map((cacheName) => caches.delete(cacheName))
                )
            )
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET' || url.origin !== location.origin) {
        return;
    }

    event.respondWith(fetchFreshWithCacheFallback(request));
});

async function fetchFreshWithCacheFallback(request) {
    const cache = await caches.open(RUNTIME_CACHE);

    try {
        const response = await fetch(request);

        if (response && response.status === 200 && response.type === 'basic') {
            cache.put(request, response.clone());
        }

        return response;
    } catch (error) {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) return cachedResponse;

        if (request.mode === 'navigate') {
            const cachedIndex = await cache.match('/index.html');
            if (cachedIndex) return cachedIndex;
        }

        return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}
