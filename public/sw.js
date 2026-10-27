// AGUNG88 APP STORE - Service Worker
// SIMPEL: Tidak cache apapun, selalu ambil dari server
// Supaya tidak ada masalah cache lama di STB

const CACHE_VERSION = 'agung88-v3'

// Install - bersihkan SEMUA cache lama
self.addEventListener('install', (event) => {
  console.log('[AGUNG88] Installing SW v3 - clearing all old caches')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('[AGUNG88] Deleting old cache:', cacheName)
          return caches.delete(cacheName)
        })
      )
    }).then(() => self.skipWaiting())
  )
})

// Activate - clear semua cache lagi
self.addEventListener('activate', (event) => {
  console.log('[AGUNG88] Activating SW v3')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          return caches.delete(cacheName)
        })
      )
    }).then(() => self.clients.claim())
  )
})

// Fetch - SELALU network, JANGAN cache apapun
// Ini supaya STB selalu dapat halaman terbaru dari server
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return

  // Network only - tidak pakai cache sama sekali
  event.respondWith(
    fetch(event.request).catch(() => {
      // Kalau offline, coba cache (fallback)
      return caches.match(event.request).then((cached) => {
        return cached || new Response('Offline', { status: 503 })
      })
    })
  )
})

// Handle messages
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
