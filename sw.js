const CACHE_VERSION = 'v1';
const CACHE_NAME = `nimble-bible-${CACHE_VERSION}`;
const RUNTIME_CACHE = 'nimble-bible-runtime';

// Assets to cache on install
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './js/data.js',
    './data/esv.json',
    './manifest.json'
];

// Install event - precache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Precaching assets');
                return cache.addAll(PRECACHE_ASSETS);
            })
            .then(() => {
                console.log('[SW] Assets precached');
                // Force the waiting service worker to become the active service worker
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Precache failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((cacheName) => {
                            // Delete old caches that don't match current version
                            return cacheName.startsWith('nimble-bible-') && 
                                   cacheName !== CACHE_NAME;
                        })
                        .map((cacheName) => {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Service worker activated');
                // Take control of all pages immediately
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip cross-origin requests
    if (url.origin !== location.origin) {
        return;
    }

    // Strategy: Cache first for static assets, network first for HTML
    if (request.destination === 'document' || request.mode === 'navigate') {
        // Network first for HTML pages (to get updates)
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Clone the response
                    const responseToCache = response.clone();
                    // Cache the response
                    caches.open(RUNTIME_CACHE)
                        .then((cache) => {
                            cache.put(request, responseToCache);
                        });
                    return response;
                })
                .catch(() => {
                    // Network failed, try cache
                    return caches.match(request)
                        .then((cachedResponse) => {
                            if (cachedResponse) {
                                return cachedResponse;
                            }
                            // Fallback to index.html for navigation requests
                            return caches.match('./index.html');
                        });
                })
        );
    } else {
        // Cache first for static assets (CSS, JS, JSON, images)
        event.respondWith(
            caches.match(request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // Not in cache, fetch from network
                    return fetch(request)
                        .then((response) => {
                            // Don't cache non-successful responses
                            if (!response || response.status !== 200 || response.type !== 'basic') {
                                return response;
                            }
                            // Clone the response
                            const responseToCache = response.clone();
                            // Cache the response
                            caches.open(RUNTIME_CACHE)
                                .then((cache) => {
                                    cache.put(request, responseToCache);
                                });
                            return response;
                        })
                        .catch(() => {
                            // Network failed and not in cache
                            // Return a fallback if available
                            if (request.destination === 'image') {
                                // Could return a placeholder image here
                                return new Response('', { status: 404 });
                            }
                            return new Response('Offline', { 
                                status: 503,
                                statusText: 'Service Unavailable'
                            });
                        });
                })
        );
    }
});
