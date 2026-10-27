'use client'

import { useEffect } from 'react'

/**
 * ServiceWorkerRegister - Hanya unregister SW lama
 * Tidak register SW baru untuk hindari cache issue di STB
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    // Unregister SEMUA service worker
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister()
      })
    })

    // Clear SEMUA cache
    if ('caches' in window) {
      caches.keys().then((keys) => {
        keys.forEach((key) => caches.delete(key))
      })
    }
  }, [])

  return null
}
