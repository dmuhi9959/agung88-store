// AGUNG88 APP STORE - Service Worker
// Caching strategy untuk performa offline yang lebih baik di STB/Android TV

const CACHE_VERSION = 'agung88-v1'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`
const API_CACHE = `${CACHE_VERSION}-api`

// Resources yang di-cache saat install
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-192x192-maskable.png',
  '/icons/icon-512x512-maskable.png',
  '/icons/splash-1920x1080.png',
  '/icons/favicon.ico',
]

// Install - precache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...')
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Pre-caching static assets')
        return cache.addAll(PRECACHE_URLS).catch((err) => {
          // Don't fail install if some assets fail to cache
          console.warn('[SW] Some assets failed to pre-cache:', err)
        })
      })
      .then(() => self.skipWaiting())
  )
})

// Activate - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...')
  const currentCaches = [STATIC_CACHE, RUNTIME_CACHE, API_CACHE]
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!currentCaches.includes(cacheName)) {
              console.log('[SW] Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => self.clients.claim())
  )
})

// Helper: is API request
function isApiRequest(url) {
  return url.pathname.startsWith('/api/')
}

// Helper: is static asset
function isStaticAsset(url) {
  return /\.(?:js|css|woff2?|ttf|otf|eot|png|jpg|jpeg|gif|svg|webp|ico)$/.test(url.pathname)
    || url.pathname.startsWith('/icons/')
    || url.pathname.startsWith('/_next/static/')
}

// Helper: is navigation request
function isNavigationRequest(request) {
  return request.mode === 'navigate'
}

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip cross-origin requests
  if (url.origin !== location.origin) return

  // Skip non-GET requests (POST/PUT/DELETE for upload/api mutations)
  if (request.method !== 'GET') return

  // Skip chrome-extension requests
  if (url.protocol === 'chrome-extension:') return

  // Strategy 1: Navigation requests - Network First (fallback to cache)
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cloned = response.clone()
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, cloned))
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    )
    return
  }

  // Strategy 2: API requests - Network First, short cache
  if (isApiRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful GET responses
          if (response.ok) {
            const cloned = response.clone()
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, cloned)
              // Expire after 5 minutes by re-fetching in background
              setTimeout(() => cache.delete(request), 5 * 60 * 1000)
            })
          }
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // Strategy 3: Static assets - Cache First
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const cloned = response.clone()
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, cloned))
          }
          return response
        })
      })
    )
    return
  }

  // Strategy 4: Default - Stale While Revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((response) => {
        if (response.ok) {
          const cloned = response.clone()
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, cloned))
        }
        return response
      }).catch(() => cached)
      return cached || fetchPromise
    })
  )
})

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  if (event.data === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION })
  }
})
