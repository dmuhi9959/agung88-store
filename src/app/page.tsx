'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Search, Menu, X, Download, Star, Trash2, Upload as UploadIcon,
  Loader2, Shield, LogOut, FileUp, Tag, Calendar, User, HardDrive,
  CheckCircle, AlertCircle, Package, Filter, Lock, Eye, Cpu,
  Plus, Home as HomeIcon, Folder, Image as ImageIcon, Pencil, Boxes,
  RefreshCw, Settings, Tv, PlayCircle, ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import type { Mod, UploadResult } from '@/lib/types'

type View = 'store' | 'admin' | 'settings'

export default function Home() {
  const [view, setView] = useState<View>('store')
  const [search, setSearch] = useState('')
  const [mods, setMods] = useState<Mod[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMod, setSelectedMod] = useState<Mod | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [isDesktop, setIsDesktop] = useState(false)
  const [isActivated, setIsActivated] = useState(false)
  const [activationChecked, setActivationChecked] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<Record<string, { percent: number; loaded: number; total: number }>>({})

  const fetchMods = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      const res = await fetch(`/api/mods?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        setMods(json.data)
      } else {
        toast.error('Gagal memuat daftar APK')
      }
    } catch {
      toast.error('Gagal terhubung ke server')
    } finally {
      setLoading(false)
    }
  }, [search])

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/check')
      const json = await res.json()
      if (json.success) {
        setIsAdmin(json.data.isAdmin)
      }
    } catch {
      // ignore
    } finally {
      setAuthChecking(false)
    }
  }, [])

  useEffect(() => {
    fetchMods()
    checkAuth()
  }, [fetchMods, checkAuth])

  // Deteksi device: PC vs mobile/TV
  useEffect(() => {
    if (typeof window === 'undefined') return
    const detect = () => {
      const ua = navigator.userAgent
      const hasMobileKeyword = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)
      const hasTVKeyword = /TV|Leanback|HbbTV|SmartTV|BRAVIA|Roku|AFT|NETRANGE/i.test(ua)
      const isMobile = hasMobileKeyword && !hasTVKeyword
      const isTV = hasTVKeyword
      const isPC = !isMobile && !isTV
      setIsDesktop(isPC)
    }
    detect()
    window.addEventListener('resize', detect)
    return () => window.removeEventListener('resize', detect)
  }, [])

  // Cek activation status dari localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const activated = localStorage.getItem('stb_activation_code')
      if (activated) setIsActivated(true)
    } catch {}
    setActivationChecked(true)
  }, [])

  // Auto-switch admin view jika ?admin=1
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('admin') === '1') setView('admin')
    }
  }, [])

  // Auto-focus ke card APK pertama setelah mods dimuat
  useEffect(() => {
    if (view === 'store' && mods.length > 0 && !loading) {
      const timer = setTimeout(() => {
        const firstCard = document.querySelector('[role="button"][tabindex="0"]') as HTMLElement
        if (firstCard) firstCard.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [view, mods, loading])

  // Refetch when view changes or after auth update
  useEffect(() => {
    if (view === 'store') fetchMods()
  }, [view, fetchMods])

  const handleDownload = useCallback(async (mod: Mod) => {
    // Trigger download counter first (tidak blocking)
    fetch(`/api/download/${mod.id}`, { method: 'POST' })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setMods((prev) => prev.map((m) => m.id === mod.id ? { ...m, downloads: json.data.downloads } : m))
          if (selectedMod?.id === mod.id) {
            setSelectedMod((prev) => prev ? { ...prev, downloads: json.data.downloads } : prev)
          }
        }
      })
      .catch(() => {})

    if (!mod.filePath) {
      toast.info('File belum tersedia untuk diunduh')
      return
    }

    // Resolve URL absolute (relatif ke origin)
    const fileUrl = mod.filePath.startsWith('http')
      ? mod.filePath
      : window.location.origin + mod.filePath

    // Cek apakah di WebView Android (punya DownloadManager)
    // di WebView: anchor download tetap trigger DownloadListener
    // di browser: gunakan fetch dengan progress
    const isLikelyWebView = /; wv\)/.test(navigator.userAgent) || /Android.*Version\/\d/.test(navigator.userAgent)

    if (isLikelyWebView) {
      // WebView: trigger anchor download, DownloadManager handle sisanya
      const a = document.createElement('a')
      a.href = fileUrl
      a.download = mod.fileName || mod.name
      a.setAttribute('data-filename', mod.fileName || mod.name)
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      toast.success(`Memulai download: ${mod.name}`, {
        description: 'Tunggu progress bar di bawah aplikasi',
      })
      return
    }

    // Browser: fetch dengan progress tracking
    try {
      setDownloadProgress((prev) => ({ ...prev, [mod.id]: { percent: 0, loaded: 0, total: 0 } }))
      toast.info(`Memulai download: ${mod.name}`)

      const response = await fetch(fileUrl)
      if (!response.ok) throw new Error('Gagal mengunduh file')

      const total = Number(response.headers.get('content-length')) || 0
      const reader = response.body?.getReader()
      if (!reader) throw new Error('Browser tidak mendukung streaming download')

      const chunks: Uint8Array[] = []
      let loaded = 0
      let lastUpdate = Date.now()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        loaded += value.length
        const percent = total > 0 ? Math.round((loaded / total) * 100) : 0
        // Throttle update: max 10 fps supaya tidak lag di file besar
        const now = Date.now()
        if (now - lastUpdate > 100 || percent === 100) {
          setDownloadProgress((prev) => ({
            ...prev,
            [mod.id]: { percent, loaded, total },
          }))
          lastUpdate = now
          // Yield ke UI untuk render progress
          await new Promise((r) => setTimeout(r, 0))
        }
      }

      // Final update ke 100%
      setDownloadProgress((prev) => ({
        ...prev,
        [mod.id]: { percent: 100, loaded, total },
      }))
      // Beri waktu 500ms untuk lihat 100% sebelum clear
      await new Promise((r) => setTimeout(r, 500))

      // Gabungkan chunks jadi blob, trus trigger download
      const blob = new Blob(chunks as BlobPart[], { type: 'application/vnd.android.package-archive' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = mod.fileName || mod.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setDownloadProgress((prev) => {
        const next = { ...prev }
        delete next[mod.id]
        return next
      })
      toast.success(`Download selesai: ${mod.name}`, {
        description: 'Cek folder Downloads di File Manager Anda',
      })
    } catch (e: any) {
      setDownloadProgress((prev) => {
        const next = { ...prev }
        delete next[mod.id]
        return next
      })
      // Fallback: trigger anchor download biasa
      const a = document.createElement('a')
      a.href = fileUrl
      a.download = mod.fileName || mod.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      toast.success(`Memulai download: ${mod.name}`)
    }
  }, [selectedMod])

  const openDetail = (mod: Mod) => {
    setSelectedMod(mod)
    setDetailOpen(true)
  }

  const switchView = (v: View) => {
    setView(v)
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      setIsAdmin(false)
      setView('store')
      toast.success('Logout berhasil')
    } catch {
      toast.error('Gagal logout')
    }
  }

  const handleDeleteMod = async (mod: Mod) => {
    if (!confirm(`Hapus APK "${mod.name}"?\n\nFile mod, icon, dan screenshot juga akan dihapus. Tindakan ini tidak bisa dibatalkan.`)) return
    try {
      const res = await fetch(`/api/mods/${mod.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast.success(`APK "${mod.name}" berhasil dihapus`)
        setMods((prev) => prev.filter((m) => m.id !== mod.id))
        setDetailOpen(false)
      } else {
        toast.error(json.error || 'Gagal menghapus APK')
      }
    } catch {
      toast.error('Gagal terhubung ke server')
    }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden relative" style={{ backgroundImage: 'url(/wallpaper.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0 bg-black/50 pointer-events-none"></div>

      {/* Top bar */}
      <header className="relative border-b border-primary/30 bg-black/60 shrink-0 z-10">
        <div className="flex h-14 items-center gap-2 sm:gap-3 px-3 sm:px-5">
          {/* Logo + Nama App */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="size-9 sm:size-10 rounded-lg overflow-hidden ring-2 ring-primary/40 shadow-md">
              <img src="/logo.png" alt="AGUNG88 APP STORE" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col leading-tight min-w-0">
              <span className="font-bold text-xs sm:text-sm truncate text-foreground">AGUNG88</span>
              <span className="text-[9px] sm:text-[10px] text-primary/80 hidden sm:block">APP STORE</span>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1"></div>

          {/* Refresh button - tabIndex=-1 supaya D-pad skip ke card APK */}
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchMods}
            disabled={loading}
            aria-label="Refresh"
            title="Refresh daftar APK"
            tabIndex={-1}
            className="shrink-0 size-9 text-foreground hover:bg-primary/20"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          {/* Admin button - HANYA di PC (hidden di mobile/TV/STB) */}
          {!authChecking && isDesktop && (
            isAdmin ? (
              view !== 'admin' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setView('admin')}
                  className="gap-1.5 ml-auto border-primary/50 text-primary hover:bg-primary/20"
                >
                  <Shield className="h-4 w-4" />
                  <span className="hidden lg:inline">Admin Panel</span>
                </Button>
              )
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView('admin')}
                aria-label="Login admin"
                title="Login admin"
                className="ml-auto gap-1.5 text-foreground hover:bg-primary/20"
              >
                <Lock className="h-4 w-4" />
                <span className="hidden lg:inline">Login Admin</span>
              </Button>
            )
          )}
        </div>
      </header>

      {/* Content - SCROLLABLE */}
      <main className="relative flex-1 overflow-y-auto z-10">
        {view === 'store' && (
          <StoreView
            mods={mods}
            loading={loading}
            search={search}
            isAdmin={isAdmin}
            onOpenDetail={openDetail}
            onDownload={handleDownload}
            onGoAdmin={() => setView('admin')}
            downloadProgress={downloadProgress}
            />
          )}
          {view === 'settings' && (
            <SettingsView onBack={() => setView('store')} />
          )}
          {view === 'admin' && (
            isAdmin ? (
              <AdminView
                mods={mods}
                onRefresh={fetchMods}
                onLogout={handleLogout}
                onBackToStore={() => setView('store')}
              />
            ) : (
              <LoginView
                onLoginSuccess={() => {
                  setIsAdmin(true)
                  setView('admin')
                }}
                onBack={() => setView('store')}
              />
            )
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-primary/30 bg-gradient-to-r from-emerald-900/30 via-background to-teal-900/30 shrink-0">
          <div className="px-4 py-2 text-center text-[10px] text-muted-foreground">
            {mods.length} APK tersedia • AGUNG88 APP STORE
          </div>
        </footer>

      {/* Detail Dialog */}
      <DetailDialog
        mod={selectedMod}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onDownload={handleDownload}
        onDelete={isAdmin ? handleDeleteMod : undefined}
        isAdmin={isAdmin}
      />
    </div>
  )
}

// Sidebar menu item helper
function SidebarMenuItem({
  icon: Icon, label, active, onClick, badge,
}: {
  icon: any
  label: string
  active?: boolean
  onClick: () => void
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'hover:bg-accent text-foreground/80'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-left truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
          active ? 'bg-primary-foreground/20' : 'bg-muted'
        }`}>
          {badge}
        </span>
      )}
    </button>
  )
}

// ============= STORE VIEW (USER) =============

function StoreView({
  mods, loading, search, isAdmin, onOpenDetail, onDownload, onGoAdmin, downloadProgress,
}: {
  mods: Mod[]
  loading: boolean
  search: string
  isAdmin: boolean
  onOpenDetail: (m: Mod) => void
  onDownload: (m: Mod) => void
  onGoAdmin: () => void
  downloadProgress: Record<string, { percent: number; loaded: number; total: number }>
}) {
  return (
    <div className="px-1.5 py-1 max-w-7xl mx-auto">
      {/* Banner promo - kecil */}
      <div className="mb-1.5 rounded-lg overflow-hidden border border-primary/30 relative" style={{ maxHeight: '50px' }}>
        <img src="/wallpaper-banner.jpg" alt="STB Android" className="w-full" style={{ display: 'block', maxHeight: '50px', objectFit: 'cover', objectPosition: 'center' }} tabIndex={-1} />
      </div>

      {/* Loading skeleton */}
      {loading ? (
        <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-1.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <Card key={i} className="p-1 border-border/60 bg-black/70">
              <div className="size-10 rounded-lg bg-muted animate-pulse mx-auto mb-1" />
              <div className="h-2 w-3/4 bg-muted rounded animate-pulse mb-1 mx-auto" />
              <div className="h-4 w-full bg-muted rounded animate-pulse" />
            </Card>
          ))}
        </div>
      ) : mods.length === 0 ? (
        <Card className="p-4 text-center border-dashed bg-black/70">
          <Package className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
          <p className="text-xs text-muted-foreground">Belum ada APK</p>
        </Card>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-1.5 sm:gap-2">
          {mods.map((mod) => (
            <ApkCard
              key={mod.id}
              mod={mod}
              onDownload={() => onDownload(mod)}
              onOpen={() => onOpenDetail(mod)}
              progress={downloadProgress[mod.id]}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ApkCard({
  mod, onDownload, onOpen, progress,
}: {
  mod: Mod
  onDownload: () => void
  onOpen: () => void
  progress?: { percent: number; loaded: number; total: number }
}) {
  const isDownloading = !!progress
  const percent = progress?.percent ?? 0

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      onDownload()
    }
  }

  return (
    <Card
      className="relative p-1 flex flex-col items-center text-center cursor-pointer outline-none transition-colors hover:border-primary/50 focus-visible:ring-4 focus-visible:ring-primary/50 focus-visible:border-primary bg-black/70 border-primary/30"
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`APK ${mod.name}, tekan Enter untuk download`}
    >
      <div className="size-10 sm:size-12 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-primary/20 pointer-events-none mb-1">
        {mod.iconUrl ? (
          <img src={mod.iconUrl} alt={mod.name} className="w-full h-full object-cover rounded-lg" />
        ) : (
          <Package className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
        )}
      </div>

      <h3 className="font-semibold text-[9px] sm:text-[10px] leading-tight line-clamp-2 w-full mb-0.5 min-h-[2em]">
        {mod.name}
        {mod.featured && (
          <Star className="inline-block h-2 w-2 fill-amber-500 text-amber-500 ml-0.5" />
        )}
      </h3>

      {mod.version && (
        <div className="mb-1 w-full">
          <Badge variant="outline" className="text-[7px] sm:text-[8px] h-3 px-0.5 font-mono bg-background/60 w-full justify-center truncate">
            {mod.version}
          </Badge>
        </div>
      )}

      {isDownloading && (
        <div className="w-full mb-1">
          <div className="flex items-center justify-between text-[7px] mb-0.5">
            <span className="text-primary font-medium">{percent >= 100 ? '✓' : '⏳'}</span>
            <span className="font-mono font-bold text-primary">{percent}%</span>
          </div>
          <div className="h-0.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      <Button
        onClick={(e) => { e.stopPropagation(); onDownload() }}
        disabled={isDownloading}
        size="sm"
        tabIndex={-1}
        className={`w-full gap-0.5 h-6 text-[9px] sm:text-[10px] font-semibold outline-none ${
          isDownloading ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700'
        }`}
      >
        {isDownloading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Download className="h-2.5 w-2.5" />}
        <span>{isDownloading ? `${percent}%` : 'Install'}</span>
      </Button>
    </Card>
  )
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  if (years > 0) return `${years} tahun lalu`
  if (months > 0) return `${months} bulan lalu`
  if (weeks > 0) return `${weeks} minggu lalu`
  if (days > 0) return `${days} hari lalu`
  if (hours > 0) return `${hours} jam lalu`
  if (minutes > 0) return `${minutes} menit lalu`
  return 'baru saja'
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

// ============= SETTINGS VIEW =============

function SettingsView({ onBack }: { onBack: () => void }) {
  const [clearing, setClearing] = useState(false)
  const [showAbout, setShowAbout] = useState(false)

  const handleClearCache = async () => {
    if (!confirm('Hapus cache aplikasi? Daftar APK akan dimuat ulang dari server.')) return
    setClearing(true)
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
      toast.success('Cache berhasil dihapus')
      setTimeout(() => window.location.reload(), 800)
    } catch {
      toast.error('Gagal menghapus cache')
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="px-4 sm:px-6 py-5 max-w-3xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 mb-5">
        <Settings className="h-5 w-5 text-primary" />
        Pengaturan
      </h1>

      <div className="space-y-3">
        {/* About */}
        <Card className="p-4">
          <button
            onClick={() => setShowAbout((o) => !o)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Tv className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-sm">Tentang Aplikasi</div>
                <div className="text-xs text-muted-foreground">Info versi & developer</div>
              </div>
            </div>
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showAbout ? 'rotate-90' : ''}`} />
          </button>
          {showAbout && (
            <div className="mt-3 pt-3 border-t border-border text-xs space-y-2 text-muted-foreground">
              <div className="flex justify-between">
                <span>Nama Aplikasi</span>
                <span className="font-mono font-medium text-foreground">AGUNG88 APP STORE</span>
              </div>
              <div className="flex justify-between">
                <span>Versi</span>
                <span className="font-mono font-medium text-foreground">1.3.0</span>
              </div>
              <div className="flex justify-between">
                <span>Developer</span>
                <span className="font-medium text-foreground">AGUNG88 APP STORE</span>
              </div>
              <div className="flex justify-between">
                <span>Layanan</span>
                <span className="font-medium text-foreground">ROOT • UNLOCK • INSTALL APK</span>
              </div>
            </div>
          )}
        </Card>

        {/* Clear Cache */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <RefreshCw className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <div className="font-semibold text-sm">Hapus Cache</div>
                <div className="text-xs text-muted-foreground">Bersihkan cache aplikasi web</div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCache}
              disabled={clearing}
              className="gap-1.5 text-xs"
            >
              {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Hapus
            </Button>
          </div>
        </Card>

        {/* Admin Login */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-sm">Admin Panel</div>
                <div className="text-xs text-muted-foreground">Upload & hapus APK</div>
              </div>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={onBack}
              className="gap-1.5 text-xs bg-primary hover:bg-primary/90"
            >
              <Lock className="h-3.5 w-3.5" />
              Login Admin
            </Button>
          </div>
        </Card>

        {/* DOWNLOAD APK SECTION - paling penting! */}
        <div className="pt-3 pb-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Download className="h-3 w-3" />
            Download APK Aplikasi
          </div>
        </div>

        {/* APK Store - untuk STB/User */}
        <Card className="p-4 border-2 border-primary/30 bg-gradient-to-br from-emerald-500/5 to-teal-500/5">
          <div className="flex items-start gap-3">
            <div className="size-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
              <Tv className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm">AGUNG88 APP STORE</h3>
                <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  v1.4.0 • 5.9 MB
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                APK untuk STB / Android TV. User bisa lihat daftar APK & download.
              </p>
              <a href="/downloads/jasa-root-cikampek-v1.4.0.apk" download>
                <Button className="w-full mt-3 gap-1.5 bg-primary hover:bg-primary/90" size="sm">
                  <Download className="h-4 w-4" />
                  Download APK Store
                </Button>
              </a>
            </div>
          </div>
        </Card>

        {/* APK Admin - untuk HP Admin */}
        <Card className="p-4 border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
          <div className="flex items-start gap-3">
            <div className="size-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm">AGUNG88 Admin</h3>
                <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  v1.1.0 • 5.9 MB
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                APK untuk HP Admin. Upload & hapus APK dari store.
              </p>
              <a href="/downloads/jasa-root-admin-v1.1.0.apk" download>
                <Button className="w-full mt-3 gap-1.5 bg-amber-500 hover:bg-amber-600" size="sm">
                  <Download className="h-4 w-4" />
                  Download APK Admin
                </Button>
              </a>
            </div>
          </div>
        </Card>

        {/* Info Card */}
        <Card className="p-4 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border-primary/20">
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
              <Tv className="h-4 w-4 text-white" />
            </div>
            <div className="text-xs">
              <div className="font-bold text-sm mb-1">AGUNG88 APP STORE</div>
              <p className="text-muted-foreground">
                Store APK untuk STB / Android TV. Download aplikasi dengan mudah,
                cepat, dan gratis. Admin bisa upload APK baru lewat menu Admin Panel.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

// ============= DETAIL DIALOG =============

function DetailDialog({
  mod, open, onOpenChange, onDownload, onDelete, isAdmin,
}: {
  mod: Mod | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onDownload: (m: Mod) => void
  onDelete?: (m: Mod) => void
  isAdmin: boolean
}) {
  return (
    <Dialog open={open && !!mod} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden p-0 gap-0">
        {mod && (
          <div className="overflow-y-auto max-h-[90vh]">
            <div className="p-5 space-y-4">
              <DialogHeader className="p-0 space-y-1">
                <div className="flex items-start gap-3">
                  <div className="size-14 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center shrink-0">
                    <Package className="h-7 w-7 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-lg leading-tight">{mod.name}</DialogTitle>
                    <DialogDescription className="text-xs mt-1 line-clamp-2">{mod.description}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <div className="text-[10px] text-muted-foreground">Versi</div>
                  <div className="font-semibold mt-0.5">{mod.version}</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <div className="text-[10px] text-muted-foreground">Developer</div>
                  <div className="font-semibold mt-0.5 truncate">{mod.developer || '-'}</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <div className="text-[10px] text-muted-foreground">Ukuran</div>
                  <div className="font-semibold mt-0.5">{mod.fileSize || '-'}</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <div className="text-[10px] text-muted-foreground">Downloads</div>
                  <div className="font-semibold mt-0.5">{formatNum(mod.downloads)}</div>
                </div>
              </div>

              {/* Tags */}
              {mod.tags && (
                <div className="flex flex-wrap gap-1">
                  {mod.tags.split(',').map((t, i) => (
                    t.trim() && (
                      <Badge key={i} variant="secondary" className="text-[10px] h-5">
                        {t.trim()}
                      </Badge>
                    )
                  ))}
                </div>
              )}

              {/* Changelog */}
              {mod.changelog && (
                <div>
                  <div className="text-xs font-semibold mb-1.5">Changelog</div>
                  <div className="rounded-lg bg-muted/30 p-3 text-xs space-y-1">
                    {mod.changelog.split('\n').filter(Boolean).map((line, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <CheckCircle className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                        <span className="text-foreground/80">{line.replace(/^-\s*/, '')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  size="lg"
                  onClick={() => onDownload(mod)}
                  className="flex-1 gap-2 bg-primary hover:bg-primary/90"
                >
                  <Download className="h-4 w-4" />
                  Download APK
                </Button>
                {isAdmin && onDelete && (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => onDelete(mod)}
                    className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    Hapus
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ============= LOGIN VIEW =============

function LoginView({
  onLoginSuccess, onBack,
}: {
  onLoginSuccess: () => void
  onBack: () => void
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) {
      setError('Username dan password wajib diisi')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Login berhasil')
        onLoginSuccess()
      } else {
        setError(json.error || 'Login gagal')
      }
    } catch {
      setError('Gagal terhubung ke server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-sm p-6">
        <div className="text-center mb-5">
          <div className="size-14 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/20">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-lg font-bold">Login Admin</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Login untuk upload & hapus APK
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-xs">Username</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="h-10"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-2.5 text-xs text-destructive flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full gap-2 bg-primary hover:bg-primary/90 h-10"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            {loading ? 'Memproses...' : 'Login'}
          </Button>
        </form>

        <div className="mt-4 rounded-lg bg-muted/50 p-3 text-xs">
          <div className="font-medium mb-1 flex items-center gap-1">
            <AlertCircle className="h-3 w-3 text-primary" />
            Default credentials:
          </div>
          <div className="text-muted-foreground font-mono">Username: <strong>admin</strong></div>
          <div className="text-muted-foreground font-mono">Password: <strong>admin123</strong></div>
          <div className="text-[10px] mt-1 text-muted-foreground">
            Ganti password di file src/lib/auth.ts untuk keamanan
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="w-full mt-3 text-xs"
        >
          ← Kembali ke Store
        </Button>
      </Card>
    </div>
  )
}

// ============= ADMIN VIEW =============

function AdminView({
  mods, onRefresh, onLogout, onBackToStore,
}: {
  mods: Mod[]
  onRefresh: () => void
  onLogout: () => void
  onBackToStore: () => void
}) {
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [adminMods, setAdminMods] = useState<Mod[]>(mods)
  const [editingMod, setEditingMod] = useState<Mod | null>(null)
  const [detailMod, setDetailMod] = useState<Mod | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Refresh mods from props
  useEffect(() => {
    setAdminMods(mods)
  }, [mods])

  const handleDelete = async (mod: Mod) => {
    if (!confirm(`Hapus APK "${mod.name}"?\n\nFile mod, icon, dan screenshot juga akan dihapus.`)) return
    setDeletingId(mod.id)
    try {
      const res = await fetch(`/api/mods/${mod.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast.success(`"${mod.name}" berhasil dihapus`)
        setAdminMods((prev) => prev.filter((m) => m.id !== mod.id))
        onRefresh()
      } else {
        toast.error(json.error || 'Gagal menghapus')
      }
    } catch {
      toast.error('Gagal terhubung ke server')
    } finally {
      setDeletingId(null)
    }
  }

  // Toggle featured (highlight APK)
  const handleToggleFeatured = async (mod: Mod) => {
    try {
      const res = await fetch(`/api/mods/${mod.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featured: !mod.featured }),
      })
      const json = await res.json()
      if (json.success) {
        // Update local state
        setAdminMods((prev) => prev.map((m) =>
          m.id === mod.id ? { ...m, featured: !m.featured } : m
        ))
        toast.success(`"${mod.name}" ${!mod.featured ? 'ditandai sebagai Featured' : 'dihapus dari Featured'}`)
      } else if (res.status === 403) {
        toast.error('Sesi admin berakhir. Login ulang.')
      } else {
        toast.error(json.error || 'Gagal update')
      }
    } catch {
      toast.error('Gagal terhubung ke server')
    }
  }

  const handleOpenDetail = (mod: Mod) => {
    setDetailMod(mod)
    setDetailOpen(true)
  }

  const totalDownloads = adminMods.reduce((s, m) => s + m.downloads, 0)

  return (
    <div className="px-3 sm:px-4 py-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold">Admin Panel</h1>
            <p className="text-[10px] text-muted-foreground">Kelola APK di store</p>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={onBackToStore} className="gap-1.5 text-xs">
            <HomeIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Store</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={onLogout} className="gap-1.5 text-xs">
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Card className="p-3">
          <div className="text-[10px] text-muted-foreground">Total APK</div>
          <div className="text-lg font-bold mt-0.5">{adminMods.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] text-muted-foreground">Total Downloads</div>
          <div className="text-lg font-bold mt-0.5">{formatNum(totalDownloads)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] text-muted-foreground">Featured</div>
          <div className="text-lg font-bold mt-0.5">{adminMods.filter((m) => m.featured).length}</div>
        </Card>
      </div>

      {/* Upload button */}
      <Button
        onClick={() => setShowUploadForm(true)}
        className="w-full gap-2 bg-primary hover:bg-primary/90 mb-4 h-11"
        size="lg"
      >
        <Plus className="h-4 w-4" />
        Upload APK Baru
      </Button>

      {/* APK list with actions */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>Daftar APK ({adminMods.length})</span>
          <span className="text-[10px] normal-case">Klik card untuk detail</span>
        </div>
        {adminMods.length === 0 ? (
          <Card className="p-8 text-center">
            <Package className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Belum ada APK. Upload yang pertama!</p>
          </Card>
        ) : (
          adminMods.map((mod) => (
            <Card
              key={mod.id}
              className="p-3 flex items-center gap-3 hover:border-primary/40 hover:bg-accent/30 transition-colors cursor-pointer"
              onClick={() => handleOpenDetail(mod)}
            >
              {/* Icon APK - pakai icon asli kalau ada */}
              <div className="size-12 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center shrink-0 overflow-hidden">
                {mod.iconUrl ? (
                   
                  <img src={mod.iconUrl} alt={mod.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="h-6 w-6 text-primary" />
                )}
              </div>

              {/* Info APK - tengah, bisa klik untuk detail */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{mod.name}</div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">{mod.version}</Badge>
                  <span className="flex items-center gap-0.5">
                    <Download className="h-2.5 w-2.5" />
                    {formatNum(mod.downloads)}
                  </span>
                  {mod.fileSize && <span>{mod.fileSize}</span>}
                  {mod.featured && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 gap-0.5 bg-amber-500/15 text-amber-600 dark:text-amber-400">
                      <Star className="h-2 w-2 fill-amber-500 text-amber-500" />
                      Featured
                    </Badge>
                  )}
                </div>
              </div>

              {/* Action buttons - kanan */}
              <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                {/* Toggle Featured */}
                <Button
                  variant="ghost"
                  size="icon"
                  className={`size-8 ${mod.featured ? 'text-amber-500' : 'text-muted-foreground'}`}
                  disabled={deletingId === mod.id}
                  onClick={() => handleToggleFeatured(mod)}
                  title={mod.featured ? 'Hapus dari Featured' : 'Tandai sebagai Featured'}
                  aria-label="Toggle featured"
                >
                  <Star className={`h-4 w-4 ${mod.featured ? 'fill-amber-500' : ''}`} />
                </Button>

                {/* Tombol Hapus */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={deletingId === mod.id}
                  onClick={() => handleDelete(mod)}
                  title="Hapus APK"
                  aria-label="Hapus"
                >
                  {deletingId === mod.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Upload form dialog */}
      <UploadDialog
        open={showUploadForm}
        onOpenChange={setShowUploadForm}
        onSuccess={() => {
          setShowUploadForm(false)
          onRefresh()
        }}
      />

      {/* Detail Dialog - klik card untuk lihat detail */}
      <DetailDialog
        mod={detailMod}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onDownload={() => {
          if (detailMod) {
            // Trigger download di tab baru
            if (detailMod.filePath) {
              const a = document.createElement('a')
              a.href = detailMod.filePath
              a.download = detailMod.fileName || detailMod.name
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
            }
          }
        }}
        onDelete={(m) => {
          setDetailOpen(false)
          handleDelete(m)
        }}
        isAdmin={true}
      />
    </div>
  )
}

// ============= UPLOAD DIALOG =============

function UploadDialog({
  open, onOpenChange, onSuccess,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    version: '',
    developer: '',
    tags: '',
    changelog: '',
    featured: false,
  })
  const [modFile, setModFile] = useState<UploadResult | null>(null)
  const [iconFile, setIconFile] = useState<UploadResult | null>(null)
  const [uploadingMod, setUploadingMod] = useState(false)
  const [uploadingIcon, setUploadingIcon] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const updateForm = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }))

  const uploadFile = async (
    file: File,
    type: 'mod' | 'icon'
  ): Promise<UploadResult> => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('type', type)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })

    // Handle non-JSON response (404, 500, dll)
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      throw new Error(`Server error HTTP ${res.status}. API tidak ditemukan atau server bermasalah.`)
    }

    const json = await res.json()
    if (!json.success) {
      // Handle specific status codes
      if (res.status === 403) {
        throw new Error('Sesi admin berakhir. Silakan login ulang.')
      } else if (res.status === 400) {
        throw new Error(json.error || 'File tidak valid')
      } else if (res.status === 413) {
        throw new Error('File terlalu besar (maks 500 MB)')
      }
      throw new Error(json.error || `Upload gagal (HTTP ${res.status})`)
    }
    return json.data
  }

  const handleModFile = async (file: File) => {
    setUploadingMod(true)
    try {
      const result = await uploadFile(file, 'mod')
      setModFile(result)
      // Auto-fill form
      setForm((p) => ({
        ...p,
        name: p.name || result.originalName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
        fileSize: result.sizeFormatted,
      }))
      toast.success(`File ${result.originalName} berhasil diunggah`)
    } catch (e: any) {
      toast.error(e.message || 'Gagal mengunggah file')
    } finally {
      setUploadingMod(false)
    }
  }

  const handleIconFile = async (file: File) => {
    setUploadingIcon(true)
    try {
      const result = await uploadFile(file, 'icon')
      setIconFile(result)
      toast.success(`Icon berhasil diunggah`)
    } catch (e: any) {
      toast.error(e.message || 'Gagal mengunggah icon')
    } finally {
      setUploadingIcon(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleModFile(file)
  }

  const resetForm = () => {
    setForm({
      name: '', description: '', version: '', developer: '',
      tags: '', changelog: '', featured: false,
    })
    setModFile(null)
    setIconFile(null)
  }

  const handleSubmit = async () => {
    if (!form.name || !form.description || !form.version || !form.developer) {
      toast.error('Field wajib belum lengkap', {
        description: 'Nama, deskripsi, versi, dan developer harus diisi.',
      })
      return
    }
    if (!modFile) {
      toast.error('File APK belum diunggah', {
        description: 'Pilih file APK (.apk, .zip, .rar) dulu sebelum publikasi.',
      })
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        category: 'app',
        stbType: 'android-tv',
        filePath: modFile.path,
        fileName: modFile.originalName,
        fileSize: modFile.sizeFormatted,
        iconUrl: iconFile?.path || '',
      }
      const res = await fetch('/api/mods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      // Handle non-JSON response (misal 404 API tidak ada)
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        toast.error('Server error - API tidak ditemukan', {
          description: `HTTP ${res.status}. Hubungi developer.`,
        })
        return
      }

      const json = await res.json()
      if (json.success) {
        toast.success('APK berhasil dipublikasikan!', {
          description: `${form.name} ${form.version} sekarang tersedia di store.`,
        })
        resetForm()
        onSuccess()
      } else {
        // Handle specific status codes
        if (res.status === 403) {
          toast.error('Sesi admin berakhir', {
            description: 'Silakan login ulang ke admin panel.',
          })
          onOpenChange(false)
        } else if (res.status === 400) {
          toast.error('Data tidak valid', {
            description: json.error || 'Cek field form dan coba lagi.',
          })
        } else if (res.status === 413) {
          toast.error('File terlalu besar', {
            description: 'Ukuran file melebihi batas 500 MB.',
          })
        } else {
          toast.error('Gagal upload APK', {
            description: json.error || `HTTP ${res.status}`,
          })
        }
      }
    } catch (e: any) {
      toast.error('Gagal terhubung ke server', {
        description: e.message || 'Cek koneksi internet dan coba lagi.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden p-0 gap-0">
        <div className="overflow-y-auto max-h-[90vh]">
          <div className="p-5 space-y-4">
            <DialogHeader className="p-0 space-y-1">
              <DialogTitle className="flex items-center gap-2 text-base">
                <UploadIcon className="h-4 w-4 text-primary" />
                Upload APK Baru
              </DialogTitle>
              <DialogDescription className="text-xs">
                Upload file APK + isi metadata untuk dipublikasikan ke store
              </DialogDescription>
            </DialogHeader>

            {/* File APK upload */}
            <div className="space-y-2">
              <Label className="text-xs">File APK *</Label>
              {!modFile ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-lg p-5 text-center transition-colors ${
                    dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <input
                    type="file"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    accept=".apk,.zip,.rar,.7z,.img,.bin,.tar,.gz"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleModFile(f)
                    }}
                  />
                  <div className="size-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-2">
                    {uploadingMod ? (
                      <Loader2 className="h-6 w-6 text-primary animate-spin" />
                    ) : (
                      <FileUp className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div className="text-xs font-medium">
                    {uploadingMod ? 'Sedang mengunggah...' : 'Tarik file ke sini atau klik untuk pilih'}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    APK, ZIP, RAR, 7Z - maks 500MB
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-border p-3 flex items-center gap-2">
                  <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Package className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{modFile.originalName}</div>
                    <div className="text-[10px] text-muted-foreground">{modFile.sizeFormatted}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setModFile(null)}
                    className="gap-1 text-destructive hover:text-destructive h-7"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {/* Form fields */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs">Nama APK *</Label>
                <Input
                  id="name"
                  placeholder="Contoh: IPTV Premium Unlocker"
                  value={form.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-xs">Deskripsi *</Label>
                <Textarea
                  id="description"
                  placeholder="Jelaskan APK, fitur utama, keunggulannya..."
                  rows={3}
                  value={form.description}
                  onChange={(e) => updateForm('description', e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="version" className="text-xs">Versi *</Label>
                  <Input
                    id="version"
                    placeholder="v1.0.0"
                    value={form.version}
                    onChange={(e) => updateForm('version', e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="developer" className="text-xs">Developer *</Label>
                  <Input
                    id="developer"
                    placeholder="Nama Anda"
                    value={form.developer}
                    onChange={(e) => updateForm('developer', e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tags" className="text-xs">Tags (pisahkan dengan koma)</Label>
                <Input
                  id="tags"
                  placeholder="iptv, premium, unlocker"
                  value={form.tags}
                  onChange={(e) => updateForm('tags', e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="changelog" className="text-xs">Changelog</Label>
                <Textarea
                  id="changelog"
                  placeholder={'- Fix bug A\n- Tambah fitur B'}
                  rows={3}
                  value={form.changelog}
                  onChange={(e) => updateForm('changelog', e.target.value)}
                  className="text-sm"
                />
              </div>

              {/* Icon upload (opsional) */}
              <div className="space-y-1.5">
                <Label className="text-xs">Icon APK (opsional)</Label>
                <div className="flex items-center gap-2">
                  <div className="size-12 rounded-lg border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30">
                    {iconFile ? (
                       
                      <img src={iconFile.path} alt="icon" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleIconFile(f)
                      }}
                    />
                    <Button variant="outline" size="sm" asChild disabled={uploadingIcon} className="text-xs">
                      <span className="gap-1.5">
                        {uploadingIcon ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                        {iconFile ? 'Ganti' : 'Upload Icon'}
                      </span>
                    </Button>
                  </label>
                  {iconFile && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIconFile(null)}
                      className="gap-1 text-destructive hover:text-destructive h-8"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="text-xs font-medium">Tandai sebagai Featured</div>
                  <div className="text-[10px] text-muted-foreground">
                    Tampil dengan badge bintang di store
                  </div>
                </div>
                <Switch
                  checked={form.featured}
                  onCheckedChange={(c) => updateForm('featured', c)}
                />
              </div>
            </div>

            {/* Actions */}
            <DialogFooter className="flex gap-2 p-0">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                disabled={saving}
              >
                Batal
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving || !modFile}
                className="flex-1 gap-2 bg-primary hover:bg-primary/90"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UploadIcon className="h-4 w-4" />
                )}
                {saving ? 'Menyimpan...' : 'Publikasikan'}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
