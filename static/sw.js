const CACHE_NAME = 'minimalist-todo-v1';
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';
const API_CACHE = 'api-v1';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon.svg'
];

const CACHE_STRATEGIES = {
  static: 'cache-first',
  api: 'network-first',
  dynamic: 'stale-while-revalidate'
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)),
      caches.open(DYNAMIC_CACHE),
      caches.open(API_CACHE)
    ]).then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE, CACHE_NAME];
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => !currentCaches.includes(cacheName))
            .map((cacheName) => caches.delete(cacheName))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Utility functions for caching strategies
const cacheFirst = async (request) => {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('Cache first strategy failed:', error);
    throw error;
  }
};

const networkFirst = async (request) => {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache:', error);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
};

const staleWhileRevalidate = async (request) => {
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      const cache = caches.open(DYNAMIC_CACHE);
      cache.then((c) => c.put(request, networkResponse.clone()));
    }
    return networkResponse;
  }).catch(() => cachedResponse);

  return cachedResponse || fetchPromise;
};

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // Handle API requests with network-first strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  
  // Handle static assets (JS, CSS, images) with cache-first strategy
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2)$/)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }
  
  // Handle HTML pages with stale-while-revalidate strategy
  if (url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }
  
  // Default to network first for other requests
  event.respondWith(networkFirst(event.request));
});

// Background sync for offline functionality
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

const doBackgroundSync = async () => {
  // Handle any pending offline actions
  try {
    const cache = await caches.open(API_CACHE);
    const requests = await cache.keys();
    
    for (const request of requests) {
      if (request.url.includes('/api/todos') && request.method !== 'GET') {
        try {
          await fetch(request);
          await cache.delete(request);
        } catch (error) {
          console.log('Background sync failed for request:', request.url);
        }
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
};

// Message handling for client communication
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_CACHE_STATUS') {
    event.ports[0].postMessage({
      type: 'CACHE_STATUS',
      isOnline: navigator.onLine,
      cacheSize: getCacheSize()
    });
  }
});

const getCacheSize = async () => {
  try {
    const cacheNames = await caches.keys();
    let totalSize = 0;
    
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      totalSize += requests.length;
    }
    
    return totalSize;
  } catch (error) {
    return 0;
  }
};

// Handle failed network requests with offline fallback
const handleOfflineRequest = async (request) => {
  // For API requests, return a meaningful offline response
  if (request.url.includes('/api/todos')) {
    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: 'This action will be synced when you\'re back online'
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  // For other requests, try to serve from cache
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Return offline page or error
  return new Response(
    'You are offline. Please check your connection.',
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' }
    }
  );
};