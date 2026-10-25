'use client'

import { useEffect, useState, useRef } from 'react'
import { Download, X, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function ServiceWorkerRegister() {
  // Use lazy initializer for SSR-safety without setState-in-effect
  const [isStandalone, setIsStandalone] = useState(false)
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [showManualGuide, setShowManualGuide] = useState(false)
  const hasCheckedStandaloneRef = useRef(false)

  useEffect(() => {
    if (hasCheckedStandaloneRef.current) return
    hasCheckedStandaloneRef.current = true

    // Detect if running as standalone (PWA installed)
    const standalone =
      typeof window !== 'undefined' && (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://')
      )

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          console.log('[PWA] Service Worker registered:', reg.scope)
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err)
        })
    }

    // Listen for install prompt event
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
      // Tampilkan dialog setelah 3 detik jika belum pernah install
      const hasSeenPrompt = localStorage.getItem('stb-mod-store-install-prompt-seen')
      if (!hasSeenPrompt && !standalone) {
        setTimeout(() => setShowDialog(true), 3000)
      }
    }

    const handleAppInstalled = () => {
      console.log('[PWA] App installed successfully')
      setInstallEvent(null)
      setShowDialog(false)
      localStorage.setItem('stb-mod-store-installed', 'true')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)

    // Use queueMicrotask to defer setState (avoid synchronous setState in effect body)
    queueMicrotask(() => {
      if (standalone !== isStandalone) {
        setIsStandalone(standalone)
      }
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [isStandalone])

  const handleInstall = async () => {
    if (!installEvent) {
      // No install event (e.g., iOS Safari or desktop). Show manual guide.
      setShowManualGuide(true)
      return
    }
    try {
      await installEvent.prompt()
      const choice = await installEvent.userChoice
      if (choice.outcome === 'accepted') {
        console.log('[PWA] User accepted install')
        localStorage.setItem('stb-mod-store-installed', 'true')
      } else {
        console.log('[PWA] User dismissed install')
      }
      localStorage.setItem('stb-mod-store-install-prompt-seen', 'true')
      setInstallEvent(null)
      setShowDialog(false)
    } catch (e) {
      console.warn('[PWA] Install failed:', e)
      setShowManualGuide(true)
    }
  }

  const handleDismiss = () => {
    setShowDialog(false)
    localStorage.setItem('stb-mod-store-install-prompt-seen', 'true')
  }

  // Don't show anything if already installed as PWA
  if (isStandalone) return null

  return (
    <>
      {/* Auto install prompt dialog */}
      <Dialog open={showDialog} onOpenChange={(o) => !o && handleDismiss()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="size-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-3">
              <Smartphone className="h-8 w-8 text-white" />
            </div>
            <DialogTitle className="text-center text-xl">
              Install STB Mod Store
            </DialogTitle>
            <DialogDescription className="text-center">
              Install aplikasi di perangkat Anda untuk akses cepat, notifikasi update,
              dan bisa dibuka tanpa browser.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-2 my-2 text-center">
            <div className="rounded-lg bg-muted/50 p-3">
              <Download className="h-5 w-5 mx-auto text-primary mb-1" />
              <div className="text-[10px] font-medium">Akses Cepat</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <Smartphone className="h-5 w-5 mx-auto text-primary mb-1" />
              <div className="text-[10px] font-medium">Tanpa Browser</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <svg className="h-5 w-5 mx-auto text-primary mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M2 12h20" />
              </svg>
              <div className="text-[10px] font-medium">Update Otomatis</div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button onClick={handleInstall} className="w-full gap-2 bg-primary hover:bg-primary/90">
              <Download className="h-4 w-4" />
              Install Sekarang
            </Button>
            <Button variant="ghost" onClick={handleDismiss} className="w-full">
              Nanti Saja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual install guide (for iOS / unsupported browsers) */}
      <Dialog open={showManualGuide} onOpenChange={setShowManualGuide}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              Cara Install Manual
            </DialogTitle>
            <DialogDescription>
              Browser Anda tidak mendukung install otomatis. Ikuti langkah berikut:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-border p-3">
              <div className="font-semibold mb-1 flex items-center gap-2">
                <span className="size-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">1</span>
                Android (Chrome)
              </div>
              <p className="text-muted-foreground text-xs ml-7">
                Tap menu (⋮) di pojok kanan atas → <strong>Install app</strong> / <strong>Add to Home screen</strong>
              </p>
            </div>

            <div className="rounded-lg border border-border p-3">
              <div className="font-semibold mb-1 flex items-center gap-2">
                <span className="size-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">2</span>
                iPhone/iPad (Safari)
              </div>
              <p className="text-muted-foreground text-xs ml-7">
                Tap tombol Share → <strong>Add to Home Screen</strong> → <strong>Add</strong>
              </p>
            </div>

            <div className="rounded-lg border border-border p-3">
              <div className="font-semibold mb-1 flex items-center gap-2">
                <span className="size-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">3</span>
                Desktop (Chrome/Edge)
              </div>
              <p className="text-muted-foreground text-xs ml-7">
                Klik icon install (⊕) di address bar → <strong>Install</strong>
              </p>
            </div>

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="font-semibold mb-1 text-amber-600 dark:text-amber-400">
                Android TV / STB
              </div>
              <p className="text-muted-foreground text-xs">
                Untuk Android TV, install via <strong>APK</strong>. Lihat panduan download APK di halaman utama.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowManualGuide(false)} className="w-full">
              Mengerti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating install button (if available, but user dismissed auto-prompt) */}
      {installEvent && !showDialog && (
        <button
          onClick={() => setShowDialog(true)}
          className="fixed bottom-4 right-4 z-30 size-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 transition-transform"
          aria-label="Install aplikasi"
          title="Install aplikasi STB Mod Store"
        >
          <Download className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 size-3 rounded-full bg-red-500 animate-pulse" />
        </button>
      )}
    </>
  )
}
