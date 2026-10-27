'use client'

import { useEffect, useRef } from 'react'

/**
 * ServiceWorkerRegister - Sederhana, tanpa PWA install prompt
 * Hanya unregister service worker lama supaya cache "JASA ROOT" di-clear
 * Tidak register SW baru (untuk hindari caching issue di STB)
 */
export function ServiceWorkerRegister() {
  const hasInitRef = useRef(false)

  useEffect(() => {
    if (hasInitRef.current) return
    hasInitRef.current = true

    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    // Unregister SEMUA service worker lama supaya cache di-clear
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister().then(() => {
          console.log('[AGUNG88] Old service worker unregistered:', registration.scope)
        })
      })
    })

    // Clear semua caches lama
    if ('caches' in window) {
      caches.keys().then((keys) => {
        keys.forEach((key) => {
          caches.delete(key).then(() => {
            console.log('[AGUNG88] Old cache deleted:', key)
          })
        })
      })
    }
  }, [])

  return null
}
