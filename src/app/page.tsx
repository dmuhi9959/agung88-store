'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Boxes, Search, Upload, Moon, Sun, Menu, X, Download, Star,
  CircuitBoard, AppWindow, LayoutGrid, FileVideo, Shield, LifeBuoy,
  Palette, Wrench, Cpu, ChevronRight, TrendingUp, Eye, Trash2,
  CheckCircle2, AlertCircle, FileUp, Image as ImageIcon, Loader2,
  Home as HomeIcon, Package, Sparkles, ArrowRight, Calendar, User, Tag,
  HardDrive, Smartphone, Filter, Github, Heart, Share2, Pencil,
  ExternalLink, Folder, Download as DownloadIcon, QrCode, FileArchive,
  Terminal, Monitor, Tv, CheckCircle, Info, Chrome, Apple, PlayCircle,
  PackageOpen, BookOpen
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  CATEGORIES, STB_TYPES, getCategoryByValue, getStbTypeByValue,
  formatNumber, formatRelativeTime,
} from '@/lib/constants'
import type { Mod, UploadResult } from '@/lib/types'

type View = 'store' | 'upload' | 'my-uploads' | 'download-guide'

const ICON_MAP: Record<string, any> = {
  Boxes, CircuitBoard, AppWindow, LayoutGrid, FileVideo, Shield,
  LifeBuoy, Palette, Wrench,
}

// Helper to render category icon by value (avoid creating component during render)
function renderCategoryIcon(category: string, className: string) {
  const cat = getCategoryByValue(category)
  const IconComp = (cat && ICON_MAP[cat.icon]) || Boxes
  return <IconComp className={className} />
}

export default function Home() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [view, setView] = useState<View>('store')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [activeStbType, setActiveStbType] = useState('all')
  const [sortBy, setSortBy] = useState<'newest' | 'popular' | 'rating'>('newest')

  const [mods, setMods] = useState<Mod[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMod, setSelectedMod] = useState<Mod | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const fetchMods = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (activeCategory !== 'all') params.set('category', activeCategory)
      if (activeStbType !== 'all') params.set('stbType', activeStbType)
      if (search.trim()) params.set('search', search.trim())

      const res = await fetch(`/api/mods?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        setMods(json.data)
      } else {
        toast.error('Gagal memuat mod')
      }
    } catch (e) {
      toast.error('Gagal terhubung ke server')
    } finally {
      setLoading(false)
    }
  }, [activeCategory, activeStbType, search])

  useEffect(() => {
    fetchMods()
  }, [fetchMods])

  const sortedMods = useMemo(() => {
    const arr = [...mods]
    if (sortBy === 'newest') {
      arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    } else if (sortBy === 'popular') {
      arr.sort((a, b) => b.downloads - a.downloads)
    } else {
      arr.sort((a, b) => b.rating - a.rating)
    }
    return arr
  }, [mods, sortBy])

  const featuredMods = useMemo(() => {
    return [...mods]
      .filter((m) => m.featured)
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, 4)
  }, [mods])

  const totalDownloads = useMemo(() => mods.reduce((s, m) => s + m.downloads, 0), [mods])

  const handleDownload = useCallback(async (mod: Mod) => {
    try {
      const res = await fetch(`/api/download/${mod.id}`, { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        // Optimistic update
        setMods((prev) => prev.map((m) => m.id === mod.id ? { ...m, downloads: json.data.downloads } : m))
        if (selectedMod?.id === mod.id) {
          setSelectedMod((prev) => prev ? { ...prev, downloads: json.data.downloads } : prev)
        }

        // Trigger browser download
        if (mod.filePath) {
          const a = document.createElement('a')
          a.href = mod.filePath
          a.download = mod.fileName || mod.name
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          toast.success(`Memulai download: ${mod.name}`)
        } else {
          toast.info('File mod belum tersedia untuk diunduh')
        }
      } else {
        toast.error('Gagal memproses download')
      }
    } catch (e) {
      toast.error('Gagal terhubung ke server')
    }
  }, [selectedMod])

  const openDetail = (mod: Mod) => {
    setSelectedMod(mod)
    setDetailOpen(true)
  }

  const switchView = (v: View) => {
    setView(v)
    setSidebarOpen(false)
    if (v === 'store') {
      fetchMods()
    } else if (v === 'my-uploads') {
      // my-uploads component will fetch itself
    }
  }

  const stats = {
    totalMods: mods.length,
    totalDownloads,
    totalDevelopers: new Set(mods.map((m) => m.developer)).size,
    avgRating: mods.length ? (mods.reduce((s, m) => s + m.rating, 0) / mods.length).toFixed(1) : '0.0',
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="flex h-16 items-center gap-3 px-4 md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          <button
            onClick={() => switchView('store')}
            className="flex items-center gap-2 shrink-0 group"
          >
            <div className="size-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Cpu className="h-5 w-5 text-white" />
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-base font-bold leading-tight">STB Mod Store</div>
              <div className="text-[10px] text-muted-foreground leading-tight">Set-Top Box Modification Hub</div>
            </div>
          </button>

          {/* Search */}
          <div className="flex-1 max-w-2xl mx-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Cari mod, ROM, aplikasi, atau developer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 h-10 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary"
              onKeyDown={(e) => {
                if (e.key === 'Enter') fetchMods()
              }}
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="rounded-lg"
              aria-label="Toggle theme"
            >
              {!mounted ? (
                <div className="h-5 w-5" />
              ) : theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => switchView('download-guide')}
              className="hidden sm:inline-flex gap-2"
            >
              <DownloadIcon className="h-4 w-4" />
              APK
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => switchView('upload')}
              className="hidden sm:inline-flex gap-2 bg-primary hover:bg-primary/90"
            >
              <Upload className="h-4 w-4" />
              Upload Mod
            </Button>
            <Button
              variant="default"
              size="icon"
              onClick={() => switchView('upload')}
              className="sm:hidden bg-primary hover:bg-primary/90"
              aria-label="Upload Mod"
            >
              <Upload className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-sidebar/50 sticky top-16 h-[calc(100vh-4rem)]">
          <SidebarContent
            activeCategory={activeCategory}
            setActiveCategory={(c) => { setActiveCategory(c); if (view !== 'store') switchView('store') }}
            activeStbType={activeStbType}
            setActiveStbType={(t) => { setActiveStbType(t); if (view !== 'store') switchView('store') }}
            view={view}
            switchView={switchView}
            stats={stats}
          />
        </aside>

        {/* Sidebar - Mobile Drawer */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.aside
                initial={{ x: -320 }}
                animate={{ x: 0 }}
                exit={{ x: -320 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed left-0 top-16 bottom-0 z-50 w-72 bg-background border-r border-border lg:hidden overflow-y-auto scrollbar-thin"
              >
                <SidebarContent
                  activeCategory={activeCategory}
                  setActiveCategory={(c) => { setActiveCategory(c); switchView('store') }}
                  activeStbType={activeStbType}
                  setActiveStbType={(t) => { setActiveStbType(t); switchView('store') }}
                  view={view}
                  switchView={switchView}
                  stats={stats}
                />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {view === 'store' && (
            <StoreView
              mods={sortedMods}
              featuredMods={featuredMods}
              loading={loading}
              stats={stats}
              activeCategory={activeCategory}
              activeStbType={activeStbType}
              sortBy={sortBy}
              setSortBy={setSortBy}
              onOpenDetail={openDetail}
              onDownload={handleDownload}
              onUploadClick={() => switchView('upload')}
            />
          )}
          {view === 'upload' && (
            <UploadView
              onDone={() => switchView('store')}
            />
          )}
          {view === 'my-uploads' && (
            <MyUploadsView
              onEdit={(mod) => { setSelectedMod(mod); setDetailOpen(true) }}
              onDownload={handleDownload}
            />
          )}
          {view === 'download-guide' && (
            <DownloadGuideView
              onBack={() => switchView('store')}
            />
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-background mt-auto">
        <div className="px-4 md:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" />
            <span>STB Mod Store &copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4">
            <span>{stats.totalMods} mods tersedia</span>
            <span className="flex items-center gap-1">
              Dibuat dengan <Heart className="h-3 w-3 fill-red-500 text-red-500" /> untuk komunitas STB
            </span>
          </div>
        </div>
      </footer>

      {/* Detail Modal */}
      <ModDetailDialog
        mod={selectedMod}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onDownload={handleDownload}
      />
    </div>
  )
}

function SidebarContent({
  activeCategory, setActiveCategory,
  activeStbType, setActiveStbType,
  view, switchView, stats,
}: {
  activeCategory: string
  setActiveCategory: (c: string) => void
  activeStbType: string
  setActiveStbType: (t: string) => void
  view: View
  switchView: (v: View) => void
  stats: { totalMods: number, totalDownloads: number, totalDevelopers: number, avgRating: string }
}) {
  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-thin">
      {/* Navigation */}
      <div className="p-4">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
          Navigasi
        </div>
        <nav className="space-y-1">
          <button
            onClick={() => switchView('store')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'store'
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent text-foreground/80'
            }`}
          >
            <HomeIcon className="h-4 w-4" />
            Store
          </button>
          <button
            onClick={() => switchView('upload')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'upload'
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent text-foreground/80'
            }`}
          >
            <Upload className="h-4 w-4" />
            Upload Mod
            <Badge variant="secondary" className="ml-auto text-[10px] h-5">NEW</Badge>
          </button>
          <button
            onClick={() => switchView('my-uploads')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'my-uploads'
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent text-foreground/80'
            }`}
          >
            <Package className="h-4 w-4" />
            Mod Saya
            <Badge variant="outline" className="ml-auto text-[10px] h-5">{stats.totalMods}</Badge>
          </button>
          <button
            onClick={() => switchView('download-guide')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'download-guide'
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent text-foreground/80'
            }`}
          >
            <DownloadIcon className="h-4 w-4" />
            Download APK
            <Badge variant="secondary" className="ml-auto text-[10px] h-5 gap-1">
              <Sparkles className="h-2.5 w-2.5" />
              APP
            </Badge>
          </button>
        </nav>
      </div>

      <div className="h-px bg-border mx-4" />

      {/* Categories */}
      <div className="p-4">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
          Kategori
        </div>
        <nav className="space-y-1">
          {CATEGORIES.map((cat) => {
            const Icon = ICON_MAP[cat.icon] || Boxes
            return (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeCategory === cat.value
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/50 text-foreground/70'
                }`}
                title={cat.description}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{cat.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      <div className="h-px bg-border mx-4" />

      {/* STB Types */}
      <div className="p-4">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
          Tipe STB
        </div>
        <div className="space-y-1">
          {STB_TYPES.map((stb) => (
            <button
              key={stb.value}
              onClick={() => setActiveStbType(stb.value)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                activeStbType === stb.value
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50 text-foreground/70'
              }`}
            >
              <span className="truncate">{stb.label}</span>
              <span className="text-[10px] text-muted-foreground">{stb.brand}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-border mx-4" />

      {/* Stats */}
      <div className="p-4 mt-auto">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
          Statistik
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-accent/40 p-3">
            <div className="text-base font-bold">{stats.totalMods}</div>
            <div className="text-[10px] text-muted-foreground">Total Mods</div>
          </div>
          <div className="rounded-lg bg-accent/40 p-3">
            <div className="text-base font-bold">{formatNumber(stats.totalDownloads)}</div>
            <div className="text-[10px] text-muted-foreground">Downloads</div>
          </div>
          <div className="rounded-lg bg-accent/40 p-3">
            <div className="text-base font-bold">{stats.totalDevelopers}</div>
            <div className="text-[10px] text-muted-foreground">Developers</div>
          </div>
          <div className="rounded-lg bg-accent/40 p-3">
            <div className="text-base font-bold">{stats.avgRating}⭐</div>
            <div className="text-[10px] text-muted-foreground">Rating</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StoreView({
  mods, featuredMods, loading, stats, activeCategory, activeStbType,
  sortBy, setSortBy, onOpenDetail, onDownload, onUploadClick,
}: {
  mods: Mod[]
  featuredMods: Mod[]
  loading: boolean
  stats: { totalMods: number, totalDownloads: number, totalDevelopers: number, avgRating: string }
  activeCategory: string
  activeStbType: string
  sortBy: 'newest' | 'popular' | 'rating'
  setSortBy: (s: 'newest' | 'popular' | 'rating') => void
  onOpenDetail: (m: Mod) => void
  onDownload: (m: Mod) => void
  onUploadClick: () => void
}) {
  const cat = getCategoryByValue(activeCategory)
  const stb = getStbTypeByValue(activeStbType)

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-teal-500/10" />
        <div className="relative px-4 md:px-6 lg:px-10 py-12 lg:py-16">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Badge variant="secondary" className="mb-4 gap-1.5">
                <Sparkles className="h-3 w-3" />
                Platform Mod STB Terlengkap
              </Badge>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight"
            >
              Toko Mod <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">Set-Top Box</span>
              <br />Untuk Indonesia
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto"
            >
              Download ROM, aplikasi, launcher, dan modifikasi lainnya untuk STB B860H, IndiBox,
              Evictrio, Mi Box, dan Android TV. Gratis, aman, dan selalu update.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-wrap items-center justify-center gap-3 pt-2"
            >
              <Button size="lg" className="gap-2 bg-primary hover:bg-primary/90" onClick={() => document.getElementById('mod-list')?.scrollIntoView({ behavior: 'smooth' })}>
                <Boxes className="h-4 w-4" />
                Jelajahi {stats.totalMods} Mods
              </Button>
              <Button size="lg" variant="outline" className="gap-2" onClick={onUploadClick}>
                <Upload className="h-4 w-4" />
                Upload Mod Sendiri
              </Button>
            </motion.div>

            {/* Quick stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-6 max-w-3xl mx-auto"
            >
              <div className="rounded-xl bg-card border border-border p-4 text-center">
                <div className="text-2xl font-bold text-primary">{stats.totalMods}+</div>
                <div className="text-xs text-muted-foreground mt-1">Mods Tersedia</div>
              </div>
              <div className="rounded-xl bg-card border border-border p-4 text-center">
                <div className="text-2xl font-bold text-primary">{formatNumber(stats.totalDownloads)}</div>
                <div className="text-xs text-muted-foreground mt-1">Total Downloads</div>
              </div>
              <div className="rounded-xl bg-card border border-border p-4 text-center">
                <div className="text-2xl font-bold text-primary">{stats.totalDevelopers}</div>
                <div className="text-xs text-muted-foreground mt-1">Developers</div>
              </div>
              <div className="rounded-xl bg-card border border-border p-4 text-center">
                <div className="text-2xl font-bold text-primary">{stats.avgRating}⭐</div>
                <div className="text-xs text-muted-foreground mt-1">Rata-rata Rating</div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Featured Mods */}
      {featuredMods.length > 0 && (
        <section className="px-4 md:px-6 lg:px-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Mod Pilihan
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Mod paling populer dan direkomendasikan untuk STB Anda
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredMods.map((mod, i) => (
              <motion.div
                key={mod.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <FeaturedModCard
                  mod={mod}
                  onOpen={() => onOpenDetail(mod)}
                  onDownload={() => onDownload(mod)}
                />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Mod List */}
      <section id="mod-list" className="px-4 md:px-6 lg:px-10 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <Boxes className="h-5 w-5 text-primary" />
              Semua Mods
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {cat?.label}{cat?.value !== 'all' ? ' • ' : ' • '}Tipe: {stb?.label}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Terbaru</SelectItem>
                <SelectItem value="popular">Populer</SelectItem>
                <SelectItem value="rating">Rating Tertinggi</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="overflow-hidden p-0">
                <div className="aspect-video bg-muted animate-pulse" />
                <div className="p-4 space-y-3">
                  <div className="h-5 w-3/4 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-full bg-muted rounded animate-pulse" />
                  <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
                  <div className="flex gap-2">
                    <div className="h-6 w-16 bg-muted rounded animate-pulse" />
                    <div className="h-6 w-16 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : mods.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Boxes className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Belum ada mod ditemukan</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Coba ubah filter atau kata kunci pencarian. Atau, jadilah yang pertama upload mod untuk kategori ini.
            </p>
            <Button onClick={onUploadClick} className="gap-2">
              <Upload className="h-4 w-4" />
              Upload Mod Pertama
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {mods.map((mod, i) => (
              <motion.div
                key={mod.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
              >
                <ModCard
                  mod={mod}
                  onOpen={() => onOpenDetail(mod)}
                  onDownload={() => onDownload(mod)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function FeaturedModCard({
  mod, onOpen, onDownload,
}: {
  mod: Mod
  onOpen: () => void
  onDownload: () => void
}) {
  const cat = getCategoryByValue(mod.category)
  const stb = getStbTypeByValue(mod.stbType)

  return (
    <Card className="overflow-hidden p-0 hover:shadow-lg hover:border-primary/30 transition-all duration-300 group cursor-pointer flex flex-col" >
      <div
        className="relative aspect-[4/3] bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-cyan-500/20 overflow-hidden"
        onClick={onOpen}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          {renderCategoryIcon(mod.category, "h-16 w-16 text-primary/70 group-hover:scale-110 transition-transform duration-300")}
        </div>
        <Badge className="absolute top-2 left-2 gap-1 bg-amber-500/90 text-white hover:bg-amber-500">
          <Sparkles className="h-3 w-3" />
          Featured
        </Badge>
        <Badge variant="secondary" className="absolute top-2 right-2 gap-1 bg-black/40 text-white hover:bg-black/40">
          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          {mod.rating.toFixed(1)}
        </Badge>
      </div>
      <div className="p-4 flex flex-col flex-1" onClick={onOpen}>
        <h3 className="font-semibold text-sm leading-tight line-clamp-2 mb-1">{mod.name}</h3>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{mod.description}</p>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-3 mt-auto">
          <Badge variant="outline" className="text-[10px] h-5">{mod.version}</Badge>
          <Badge variant="secondary" className="text-[10px] h-5">{stb?.label || mod.stbType}</Badge>
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Download className="h-3 w-3" />
            {formatNumber(mod.downloads)}
          </span>
          <span className="truncate max-w-[100px]">oleh {mod.developer}</span>
        </div>
      </div>
      <div className="px-4 pb-4">
        <Button
          size="sm"
          className="w-full gap-2 bg-primary hover:bg-primary/90"
          onClick={(e) => { e.stopPropagation(); onDownload() }}
        >
          <Download className="h-4 w-4" />
          Download
        </Button>
      </div>
    </Card>
  )
}

function ModCard({
  mod, onOpen, onDownload,
}: {
  mod: Mod
  onOpen: () => void
  onDownload: () => void
}) {
  const cat = getCategoryByValue(mod.category)
  const stb = getStbTypeByValue(mod.stbType)

  return (
    <Card className="overflow-hidden p-0 hover:shadow-md hover:border-primary/30 transition-all duration-300 group cursor-pointer flex flex-col h-full">
      <div
        className="relative aspect-video bg-gradient-to-br from-muted to-muted/50 overflow-hidden"
        onClick={onOpen}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          {renderCategoryIcon(mod.category, "h-12 w-12 text-primary/60 group-hover:scale-110 transition-transform duration-300")}
        </div>
        {mod.featured && (
          <Badge className="absolute top-2 left-2 gap-1 bg-amber-500/90 text-white hover:bg-amber-500">
            <Sparkles className="h-3 w-3" />
            Pilihan
          </Badge>
        )}
        <Badge variant="secondary" className="absolute top-2 right-2 gap-1 bg-black/40 text-white hover:bg-black/40">
          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          {mod.rating.toFixed(1)}
        </Badge>
      </div>
      <div className="p-4 flex flex-col flex-1" onClick={onOpen}>
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-sm leading-tight line-clamp-2 flex-1">{mod.name}</h3>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{mod.description}</p>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] mb-3 mt-auto">
          <Badge variant="outline" className="text-[10px] h-5 gap-1">
            <Tag className="h-2.5 w-2.5" />
            {cat?.label}
          </Badge>
          <Badge variant="secondary" className="text-[10px] h-5">{mod.version}</Badge>
          {mod.fileSize && (
            <Badge variant="ghost" className="text-[10px] h-5 gap-1 text-muted-foreground">
              <HardDrive className="h-2.5 w-2.5" />
              {mod.fileSize}
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <Download className="h-3 w-3" />
            {formatNumber(mod.downloads)}
          </span>
          <span className="flex items-center gap-1 truncate">
            <User className="h-3 w-3" />
            {mod.developer}
          </span>
        </div>
      </div>
      <div className="px-4 pb-4 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 gap-1"
          onClick={(e) => { e.stopPropagation(); onOpen() }}
        >
          <Eye className="h-3.5 w-3.5" />
          Detail
        </Button>
        <Button
          size="sm"
          className="flex-1 gap-1 bg-primary hover:bg-primary/90"
          onClick={(e) => { e.stopPropagation(); onDownload() }}
        >
          <Download className="h-3.5 w-3.5" />
          Unduh
        </Button>
      </div>
    </Card>
  )
}

function ModDetailDialog({
  mod, open, onOpenChange, onDownload,
}: {
  mod: Mod | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onDownload: (m: Mod) => void
}) {
  const cat = mod ? getCategoryByValue(mod.category) : null
  const stb = mod ? getStbTypeByValue(mod.stbType) : null
  const tags = mod?.tags ? mod.tags.split(',').map((t) => t.trim()).filter(Boolean) : []
  const changelogLines = mod?.changelog ? mod.changelog.split('\n').filter(Boolean) : []

  return (
    <Dialog open={open && !!mod} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0 gap-0">
        {mod && (
          <div className="overflow-y-auto max-h-[90vh] scrollbar-thin">
            {/* Header / Banner */}
            <div className="relative aspect-[2/1] bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-cyan-500/20 overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                {renderCategoryIcon(mod.category, "h-24 w-24 text-primary/70")}
              </div>
              {mod.featured && (
                <Badge className="absolute top-4 left-4 gap-1 bg-amber-500/90 text-white hover:bg-amber-500">
                  <Sparkles className="h-3 w-3" />
                  Featured
                </Badge>
              )}
            </div>

            <div className="p-6 space-y-6">
              {/* Title */}
              <DialogHeader className="space-y-2 p-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-2xl font-bold leading-tight">
                      {mod.name}
                    </DialogTitle>
                    <DialogDescription className="text-sm mt-1">
                      {mod.description}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Quick info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Versi</div>
                  <div className="text-sm font-semibold mt-0.5">{mod.version}</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Developer</div>
                  <div className="text-sm font-semibold mt-0.5 truncate">{mod.developer}</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Tipe STB</div>
                  <div className="text-sm font-semibold mt-0.5">{stb?.label || mod.stbType}</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Ukuran</div>
                  <div className="text-sm font-semibold mt-0.5">{mod.fileSize || '-'}</div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-amber-500">
                    <Star className="h-4 w-4 fill-amber-500" />
                    <span className="font-bold">{mod.rating.toFixed(1)}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">Rating</div>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-primary">
                    <Download className="h-4 w-4" />
                    <span className="font-bold">{formatNumber(mod.downloads)}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">Downloads</div>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span className="font-bold text-sm">{formatRelativeTime(mod.createdAt)}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">Diperbarui</div>
                </div>
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div>
                  <div className="text-sm font-semibold mb-2">Tags</div>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs gap-1">
                        <Tag className="h-2.5 w-2.5" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Changelog */}
              {changelogLines.length > 0 && (
                <div>
                  <div className="text-sm font-semibold mb-2">Changelog</div>
                  <Card className="p-4 bg-muted/30">
                    <ul className="space-y-1.5">
                      {changelogLines.map((line, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                          <span className="text-foreground/80">{line.replace(/^-\s*/, '')}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>
              )}

              {/* File info */}
              {mod.fileName && (
                <div>
                  <div className="text-sm font-semibold mb-2">File</div>
                  <Card className="p-4 flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Folder className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{mod.fileName}</div>
                      <div className="text-xs text-muted-foreground">
                        {mod.fileSize && `${mod.fileSize} • `}{cat?.label || mod.category}
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-2 sticky bottom-0 bg-background/80 backdrop-blur-md -mx-6 -mb-6 px-6 py-4 border-t border-border">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1 gap-2"
                  onClick={() => {
                    if (mod.filePath) {
                      navigator.clipboard.writeText(window.location.origin + mod.filePath)
                      toast.success('Link disalin ke clipboard')
                    } else {
                      toast.info('File belum tersedia')
                    }
                  }}
                >
                  <Share2 className="h-4 w-4" />
                  Bagikan
                </Button>
                <Button
                  size="lg"
                  className="flex-1 gap-2 bg-primary hover:bg-primary/90"
                  onClick={() => onDownload(mod)}
                >
                  <Download className="h-4 w-4" />
                  Download Sekarang
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function UploadView({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    version: '',
    developer: '',
    category: 'app',
    stbType: 'android-tv',
    tags: '',
    changelog: '',
    featured: false,
  })
  const [modFile, setModFile] = useState<UploadResult | null>(null)
  const [iconFile, setIconFile] = useState<UploadResult | null>(null)
  const [screenshots, setScreenshots] = useState<UploadResult[]>([])
  const [uploadingMod, setUploadingMod] = useState(false)
  const [uploadingIcon, setUploadingIcon] = useState(false)
  const [uploadingShot, setUploadingShot] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const updateForm = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }))

  const uploadFile = async (
    file: File,
    type: 'mod' | 'screenshot' | 'icon'
  ): Promise<UploadResult> => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('type', type)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || 'Upload gagal')
    return json.data
  }

  const handleModFile = async (file: File) => {
    setUploadingMod(true)
    try {
      const result = await uploadFile(file, 'mod')
      setModFile(result)
      // Auto-fill form
      if (!form.name) {
        updateForm('name', result.originalName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '))
      }
      if (!form.fileSize) updateForm('fileSize', result.sizeFormatted)
      toast.success(`File ${result.originalName} berhasil diunggah`)
    } catch (e: any) {
      toast.error(e.message || 'Gagal mengunggah file mod')
    } finally {
      setUploadingMod(false)
    }
  }

  const handleIconFile = async (file: File) => {
    setUploadingIcon(true)
    try {
      const result = await uploadFile(file, 'icon')
      setIconFile(result)
      toast.success(`Icon ${result.originalName} berhasil diunggah`)
    } catch (e: any) {
      toast.error(e.message || 'Gagal mengunggah icon')
    } finally {
      setUploadingIcon(false)
    }
  }

  const handleScreenshotFiles = async (files: FileList) => {
    setUploadingShot(true)
    try {
      const results: UploadResult[] = []
      for (const f of Array.from(files)) {
        const r = await uploadFile(f, 'screenshot')
        results.push(r)
      }
      setScreenshots((p) => [...p, ...results])
      toast.success(`${results.length} screenshot berhasil diunggah`)
    } catch (e: any) {
      toast.error(e.message || 'Gagal mengunggah screenshot')
    } finally {
      setUploadingShot(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleModFile(file)
  }

  const handleSubmit = async () => {
    if (!form.name || !form.description || !form.version || !form.developer) {
      toast.error('Field wajib belum lengkap', { description: 'Nama, deskripsi, versi, dan developer harus diisi.' })
      return
    }
    if (!modFile) {
      toast.error('File mod belum diunggah', { description: 'Silakan upload file mod (zip, apk, dll).' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        filePath: modFile.path,
        fileName: modFile.originalName,
        fileSize: modFile.sizeFormatted,
        iconUrl: iconFile?.path || '',
        screenshots: screenshots.map((s) => s.path).join('|'),
      }
      const res = await fetch('/api/mods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Mod berhasil dipublikasikan!', {
          description: `${form.name} ${form.version} sekarang tersedia di store.`,
        })
        onDone()
      } else {
        throw new Error(json.error)
      }
    } catch (e: any) {
      toast.error(e.message || 'Gagal menyimpan mod')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" size="sm" onClick={onDone} className="mb-3 gap-1 -ml-2">
          <ArrowRight className="h-4 w-4 rotate-180" />
          Kembali ke Store
        </Button>
        <div className="flex items-center gap-3 mb-2">
          <div className="size-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Upload className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Upload Mod Baru</h1>
            <p className="text-sm text-muted-foreground">
              Bagikan mod STB Anda ke komunitas. Semua mod dipublikasikan secara gratis.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* File Upload Section */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileUp className="h-5 w-5 text-primary" />
                File Mod
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Upload file mod (zip, apk, rar, 7z, img, bin, tar.gz) - maks 500MB
              </p>
            </div>
            {modFile && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                Terunggah
              </Badge>
            )}
          </div>

          {!modFile ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              <input
                type="file"
                id="mod-file-input"
                className="absolute inset-0 opacity-0 cursor-pointer"
                accept=".zip,.apk,.rar,.7z,.img,.bin,.tar,.gz"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleModFile(f)
                }}
              />
              <div className="size-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
                {uploadingMod ? (
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                ) : (
                  <FileUp className="h-8 w-8 text-primary" />
                )}
              </div>
              <div className="text-sm font-medium mb-1">
                {uploadingMod ? 'Sedang mengunggah...' : 'Tarik file ke sini atau klik untuk pilih'}
              </div>
              <div className="text-xs text-muted-foreground">
                Format yang didukung: .zip, .apk, .rar, .7z, .img, .bin, .tar.gz
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border p-4 flex items-center gap-3">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Folder className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{modFile.originalName}</div>
                <div className="text-xs text-muted-foreground">{modFile.sizeFormatted}</div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setModFile(null)}
                className="gap-1 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Hapus
              </Button>
            </div>
          )}
        </Card>

        {/* Basic Info */}
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Informasi Mod
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Detail yang ditampilkan ke pengguna store
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="name">Nama Mod *</Label>
              <Input
                id="name"
                placeholder="Contoh: Brom ROM Premium STB"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Deskripsi *</Label>
              <Textarea
                id="description"
                placeholder="Jelaskan mod, fitur utama, dan keunggulannya..."
                rows={4}
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="version">Versi *</Label>
              <Input
                id="version"
                placeholder="v1.0.0"
                value={form.version}
                onChange={(e) => updateForm('version', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="developer">Developer *</Label>
              <Input
                id="developer"
                placeholder="Nama Anda / Tim"
                value={form.developer}
                onChange={(e) => updateForm('developer', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Kategori</Label>
              <Select value={form.category} onValueChange={(v) => updateForm('category', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.filter((c) => c.value !== 'all').map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stbType">Tipe STB</Label>
              <Select value={form.stbType} onValueChange={(v) => updateForm('stbType', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STB_TYPES.filter((t) => t.value !== 'all').map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label} ({t.brand})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="tags">Tags (pisahkan dengan koma)</Label>
              <Input
                id="tags"
                placeholder="contoh: rom, firmware, hdr, iptv"
                value={form.tags}
                onChange={(e) => updateForm('tags', e.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="changelog">Changelog</Label>
              <Textarea
                id="changelog"
                placeholder={'Perubahan dalam versi ini:\n- Fix bug A\n- Tambah fitur B\n- Optimasi C'}
                rows={4}
                value={form.changelog}
                onChange={(e) => updateForm('changelog', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Gunakan baris baru untuk setiap perubahan, awali dengan tanda <code>-</code> opsional
              </p>
            </div>

            <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <div className="text-sm font-medium">Tandai sebagai Featured</div>
                <div className="text-xs text-muted-foreground">
                  Mod akan ditampilkan di section "Mod Pilihan" di halaman utama
                </div>
              </div>
              <Switch
                checked={form.featured}
                onCheckedChange={(c) => updateForm('featured', c)}
              />
            </div>
          </div>
        </Card>

        {/* Icon & Screenshots */}
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              Media (Opsional)
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Icon dan screenshot untuk mempercantik tampilan mod di store
            </p>
          </div>

          {/* Icon */}
          <div className="space-y-2">
            <Label>Icon / Logo</Label>
            <div className="flex items-center gap-3">
              <div className="size-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30">
                {iconFile ? (
                   
                  <img src={iconFile.path} alt="icon" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
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
                <Button variant="outline" size="sm" asChild disabled={uploadingIcon}>
                  <span className="gap-2">
                    {uploadingIcon ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                    {iconFile ? 'Ganti Icon' : 'Upload Icon'}
                  </span>
                </Button>
              </label>
              {iconFile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIconFile(null)}
                  className="gap-1 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Screenshots */}
          <div className="space-y-2">
            <Label>Screenshots</Label>
            {screenshots.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                {screenshots.map((s, i) => (
                  <div key={i} className="relative aspect-video rounded-lg overflow-hidden border border-border group">
                    { }
                    <img src={s.path} alt={`screenshot-${i}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => setScreenshots((p) => p.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 size-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="cursor-pointer">
              <input
                type="file"
                className="hidden"
                accept="image/*"
                multiple
                onChange={(e) => {
                  if (e.target.files?.length) handleScreenshotFiles(e.target.files)
                }}
              />
              <div className="border-2 border-dashed border-border hover:border-primary/50 rounded-lg p-4 text-center transition-colors">
                {uploadingShot ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Mengunggah...
                  </div>
                ) : (
                  <>
                    <ImageIcon className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                    <div className="text-xs text-muted-foreground">
                      Klik untuk upload screenshot (bisa pilih multiple)
                    </div>
                  </>
                )}
              </div>
            </label>
          </div>
        </Card>

        {/* Warning notice */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium mb-1">Catatan Upload</div>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              <li>Pastikan mod sudah Anda uji sebelum dipublikasikan</li>
              <li>Sertakan changelog yang jelas agar pengguna tahu apa yang baru</li>
              <li>Mod yang melanggar hukum atau berisi malware akan dihapus</li>
              <li>Dengan upload, Anda setuju mod dapat diunduh publik secara gratis</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-4 flex gap-2 z-10">
          <Button variant="outline" size="lg" onClick={onDone} className="flex-1">
            Batal
          </Button>
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={saving || !modFile}
            className="flex-1 gap-2 bg-primary hover:bg-primary/90"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {saving ? 'Menyimpan...' : 'Publikasikan Mod'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function MyUploadsView({
  onEdit, onDownload,
}: {
  onEdit: (mod: Mod) => void
  onDownload: (m: Mod) => void
}) {
  const [mods, setMods] = useState<Mod[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/mods?limit=1000')
      const json = await res.json()
      if (json.success) {
        setMods(json.data)
      }
    } catch {
      toast.error('Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleDelete = async (mod: Mod) => {
    if (!confirm(`Hapus mod "${mod.name}"? Tindakan ini tidak bisa dibatalkan.`)) return
    setDeletingId(mod.id)
    try {
      const res = await fetch(`/api/mods/${mod.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast.success('Mod berhasil dihapus')
        setMods((p) => p.filter((m) => m.id !== mod.id))
      } else {
        toast.error(json.error || 'Gagal menghapus mod')
      }
    } catch {
      toast.error('Gagal terhubung ke server')
    } finally {
      setDeletingId(null)
    }
  }

  const totalDownloads = mods.reduce((s, m) => s + m.downloads, 0)
  const avgRating = mods.length ? (mods.reduce((s, m) => s + m.rating, 0) / mods.length).toFixed(1) : '0.0'

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="size-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Package className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Mod Saya</h1>
            <p className="text-sm text-muted-foreground">
              Kelola semua mod yang sudah Anda upload
            </p>
          </div>
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Boxes className="h-4 w-4 text-primary" />
            <div className="text-xs text-muted-foreground">Total Mods</div>
          </div>
          <div className="text-2xl font-bold">{mods.length}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Download className="h-4 w-4 text-primary" />
            <div className="text-xs text-muted-foreground">Total Downloads</div>
          </div>
          <div className="text-2xl font-bold">{formatNumber(totalDownloads)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Star className="h-4 w-4 text-amber-500" />
            <div className="text-xs text-muted-foreground">Avg Rating</div>
          </div>
          <div className="text-2xl font-bold">{avgRating}⭐</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-primary" />
            <div className="text-xs text-muted-foreground">Featured</div>
          </div>
          <div className="text-2xl font-bold">{mods.filter((m) => m.featured).length}</div>
        </Card>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-6 space-y-3">
              <div className="h-5 w-3/4 bg-muted rounded animate-pulse" />
              <div className="h-4 w-full bg-muted rounded animate-pulse" />
              <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
              <div className="h-9 w-full bg-muted rounded animate-pulse" />
            </Card>
          ))}
        </div>
      ) : mods.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Belum ada mod</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Anda belum upload mod apapun. Mulai bagikan karya Anda sekarang!
          </p>
          <Button onClick={() => window.location.reload()} className="gap-2">
            <Upload className="h-4 w-4" />
            Upload Mod Pertama
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mods.map((mod) => {
            const cat = getCategoryByValue(mod.category)
            return (
              <Card key={mod.id} className="overflow-hidden p-0 flex flex-col">
                <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center relative">
                  {renderCategoryIcon(mod.category, "h-12 w-12 text-primary/60")}
                  {mod.featured && (
                    <Badge className="absolute top-2 left-2 gap-1 bg-amber-500/90 text-white hover:bg-amber-500">
                      <Sparkles className="h-3 w-3" />
                      Featured
                    </Badge>
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-semibold text-sm mb-1 line-clamp-1">{mod.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{mod.description}</p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <Badge variant="outline" className="text-[10px] h-5">{mod.version}</Badge>
                    <Badge variant="secondary" className="text-[10px] h-5">{cat?.label}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-3 mt-auto">
                    <span className="flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      {formatNumber(mod.downloads)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                      {mod.rating.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1"
                      onClick={() => onEdit(mod)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Lihat
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1"
                      onClick={() => onDownload(mod)}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Unduh
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                      disabled={deletingId === mod.id}
                      onClick={() => handleDelete(mod)}
                    >
                      {deletingId === mod.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DownloadGuideView({ onBack }: { onBack: () => void }) {
  const [origin, setOrigin] = useState('')
  const [installPromptAvailable, setInstallPromptAvailable] = useState(false)
  const [copied, setCopied] = useState(false)
  const hasInitRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined' || hasInitRef.current) return
    hasInitRef.current = true

    // Read origin synchronously, defer setState via microtask to avoid cascading render
    const detectedOrigin = window.location.origin
    queueMicrotask(() => {
      setOrigin(detectedOrigin)
    })

    // Check if PWA install is available
    const handler = (e: any) => {
      e.preventDefault()
      queueMicrotask(() => setInstallPromptAvailable(true))
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstallPWA = async () => {
    // Trigger the deferred prompt if available
    const evt = new Event('beforeinstallprompt') as any
    window.dispatchEvent(evt)
    // Fallback: try opening install via Browser API
    alert('Klik icon Install (⊕) di address bar browser, atau pilih menu → Install app / Add to Home screen.')
  }

  const handleCopyLink = () => {
    if (origin) {
      navigator.clipboard.writeText(origin)
        .then(() => {
          setCopied(true)
          toast.success('Link berhasil disalin!')
          setTimeout(() => setCopied(false), 2000)
        })
        .catch(() => toast.error('Gagal menyalin link'))
    }
  }

  const qrUrl = origin
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&bgcolor=ffffff&color=059669&data=${encodeURIComponent(origin)}`
    : ''

  const androidProjectUrl = '/downloads/stb-mod-store-android-project.zip'
  const pwaBuilderUrl = 'https://www.pwabuilder.com/'
  const apkIconUrl = '/icons/icon-512x512.png'

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-3 gap-1 -ml-2">
          <ArrowRight className="h-4 w-4 rotate-180" />
          Kembali ke Store
        </Button>
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-2">
          <div className="size-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Tv className="h-8 w-8 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold">Download Aplikasi</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Install STB Mod Store di Android TV, STB, HP Android, atau PC Anda.
              Pilih salah satu dari 4 metode di bawah ini.
            </p>
          </div>
        </div>
      </div>

      {/* Quick install via PWA */}
      <Card className="p-6 border-primary/30 bg-gradient-to-br from-emerald-500/5 to-teal-500/5">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                <Sparkles className="h-3 w-3" />
                PALING CEPAT
              </Badge>
              <Badge variant="outline">Tanpa build APK</Badge>
            </div>
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Chrome className="h-5 w-5 text-primary" />
              Install sebagai PWA (1 klik)
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Install langsung dari browser. PWA berfungsi seperti aplikasi native:
              ada icon di home screen, full screen, dan bisa offline (sebagian).
              Cocok untuk HP Android dan Android TV yang sudah ada Chrome/Edge.
            </p>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleInstallPWA} className="gap-2 bg-primary hover:bg-primary/90">
                <DownloadIcon className="h-4 w-4" />
                Install PWA Sekarang
              </Button>
              <Button variant="outline" onClick={handleCopyLink} className="gap-2">
                {copied ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <Share2 className="h-4 w-4" />}
                {copied ? 'Tersalin!' : 'Salin Link'}
              </Button>
            </div>

            {!installPromptAvailable && (
              <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Jika tombol install tidak muncul, gunakan menu browser: <strong>⋮ → Install app</strong> (Chrome Android) atau <strong>Share → Add to Home Screen</strong> (iOS Safari).
              </p>
            )}
          </div>

          {/* QR Code */}
          {qrUrl && (
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 rounded-xl bg-white border-2 border-emerald-500/20">
                { }
                <img src={qrUrl} alt="QR Code" width={160} height={160} className="rounded-md" />
              </div>
              <div className="text-xs text-center text-muted-foreground">
                <div className="flex items-center gap-1 justify-center">
                  <QrCode className="h-3 w-3" />
                  Scan dengan HP / STB
                </div>
                <div className="mt-1 font-mono text-[10px]">{origin}</div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* 3 Methods Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Method 1: PWABuilder */}
        <Card className="p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <PackageOpen className="h-5 w-5 text-purple-500" />
            </div>
            <Badge variant="outline" className="text-xs">Metode 1</Badge>
          </div>
          <h3 className="font-bold mb-2 flex items-center gap-1">
            PWABuilder
            <Badge variant="secondary" className="text-[10px] h-4 ml-1">FREE</Badge>
          </h3>
          <p className="text-xs text-muted-foreground mb-4 flex-1">
            Generate APK otomatis dari PWA di website PWABuilder.com (Microsoft).
            Tanpa coding, hasil APK langsung jadi. Cocok untuk pemula.
          </p>
          <ol className="text-xs space-y-1 mb-4 text-muted-foreground">
            <li>1. Buka pwabuilder.com</li>
            <li>2. Paste link aplikasi ini</li>
            <li>3. Klik "Build My PWA" → pilih Android</li>
            <li>4. Download APK siap install</li>
          </ol>
          <a href={pwaBuilderUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="w-full gap-2">
              <ExternalLink className="h-3.5 w-3.5" />
              Buka PWABuilder
            </Button>
          </a>
        </Card>

        {/* Method 2: Android Studio Project */}
        <Card className="p-5 flex flex-col border-primary/40">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <FileArchive className="h-5 w-5 text-primary" />
            </div>
            <Badge variant="secondary" className="text-xs gap-1">
              <Sparkles className="h-2.5 w-2.5" />
              Metode 2
            </Badge>
          </div>
          <h3 className="font-bold mb-2 flex items-center gap-1">
            Android Studio Project
            <Badge variant="secondary" className="text-[10px] h-4 ml-1">TEMPLATE</Badge>
          </h3>
          <p className="text-xs text-muted-foreground mb-4 flex-1">
            Download template project Android Studio (WebView wrapper) yang sudah
            siap build. Tinggal buka di Android Studio, klik Build APK, jadi!
            Cocok untuk developer / yang sudah punya Android Studio.
          </p>
          <ol className="text-xs space-y-1 mb-4 text-muted-foreground">
            <li>1. Download ZIP di bawah (~50KB)</li>
            <li>2. Extract & buka di Android Studio</li>
            <li>3. Tunggu Gradle sync selesai</li>
            <li>4. Klik Build → Build APK</li>
          </ol>
          <a href={androidProjectUrl} download>
            <Button size="sm" className="w-full gap-2 bg-primary hover:bg-primary/90">
              <DownloadIcon className="h-3.5 w-3.5" />
              Download Project ZIP
            </Button>
          </a>
        </Card>

        {/* Method 3: Bubblewrap CLI */}
        <Card className="p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Terminal className="h-5 w-5 text-blue-500" />
            </div>
            <Badge variant="outline" className="text-xs">Metode 3</Badge>
          </div>
          <h3 className="font-bold mb-2 flex items-center gap-1">
            Bubblewrap CLI
            <Badge variant="secondary" className="text-[10px] h-4 ml-1">Google</Badge>
          </h3>
          <p className="text-xs text-muted-foreground mb-4 flex-1">
            Generate TWA (Trusted Web Activity) APK resmi dari Google.
            Hasil APK signed dan siap upload ke Play Store.
            Butuh Node.js + Java JDK 11.
          </p>
          <ol className="text-xs space-y-1 mb-4 text-muted-foreground">
            <li>1. Install Node.js + Java JDK 11</li>
            <li>2. <code className="text-[10px] bg-muted px-1 rounded">npm i -g @bubblewrap/cli</code></li>
            <li>3. <code className="text-[10px] bg-muted px-1 rounded">bubblewrap init --manifest={origin}/manifest.json</code></li>
            <li>4. <code className="text-[10px] bg-muted px-1 rounded">bubblewrap build</code></li>
          </ol>
          <a href="https://github.com/GoogleChromeLabs/bubblewrap" target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="w-full gap-2">
              <BookOpen className="h-3.5 w-3.5" />
              Lihat Dokumentasi
            </Button>
          </a>
        </Card>
      </div>

      {/* Installation Guide for STB/Android TV */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="size-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Tv className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Cara Install di Android TV / STB</h2>
            <p className="text-xs text-muted-foreground">
              Panduan step-by-step install APK di STB / Android TV Box
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Method A: USB Flashdisk */}
          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">A</Badge>
              <h3 className="font-semibold text-sm">Via USB Flashdisk</h3>
            </div>
            <ol className="text-xs text-muted-foreground space-y-2 list-decimal pl-4">
              <li>Download APK dari metode 1, 2, atau 3 di atas</li>
              <li>Copy file APK ke USB flashdisk</li>
              <li>Colokkan USB ke port STB / Android TV</li>
              <li>Buka <strong>File Manager</strong> di STB (atau X-plore / FX File Explorer)</li>
              <li>Pilih USB storage → cari file APK</li>
              <li>Klik file APK → <strong>Install</strong></li>
              <li>Jika muncul "Unknown sources", allow di Settings → Security</li>
              <li>Tunggu install selesai → buka aplikasi dari menu STB</li>
            </ol>
            <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-2 text-xs text-amber-700 dark:text-amber-300">
              <strong>Tips:</strong> Pastikan STB Anda mendukung "Unknown sources" di Settings → Security.
            </div>
          </div>

          {/* Method B: ADB Sideload */}
          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 dark:text-blue-300">B</Badge>
              <h3 className="font-semibold text-sm">Via ADB Sideload (PC)</h3>
            </div>
            <ol className="text-xs text-muted-foreground space-y-2 list-decimal pl-4">
              <li>Download APK + install ADB di PC (Android Platform Tools)</li>
              <li>Enable <strong>Developer Options</strong> di STB: Settings → About → tap Build Number 7x</li>
              <li>Enable <strong>USB Debugging</strong> di Settings → Developer Options</li>
              <li>Hubungkan STB ke PC dengan kabel USB (atau via IP network ADB)</li>
              <li>Buka Command Prompt / Terminal di PC</li>
              <li><code className="text-[10px] bg-muted px-1 rounded">adb connect &lt;IP_STB&gt;</code> (untuk network)</li>
              <li><code className="text-[10px] bg-muted px-1 rounded">adb install stb-mod-store.apk</code></li>
              <li>Tunggu "Success" → aplikasi muncul di menu STB</li>
            </ol>
            <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-2 text-xs text-blue-700 dark:text-blue-300">
              <strong>Tips:</strong> Download ADB dari <a href="https://developer.android.com/tools/releases/platform-tools" target="_blank" rel="noopener noreferrer" className="underline">developer.android.com</a>
            </div>
          </div>
        </div>
      </Card>

      {/* Platform Support */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Monitor className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Kompatibilitas Platform</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Tv, name: "Android TV / STB", support: "Android 5.0+", color: "text-emerald-500" },
            { icon: Smartphone, name: "HP Android", support: "Android 5.0+", color: "text-emerald-500" },
            { icon: Apple, name: "iPhone / iPad", support: "PWA only (iOS 11.3+)", color: "text-blue-500" },
            { icon: Monitor, name: "PC Windows/Mac", support: "PWA (Chrome/Edge)", color: "text-purple-500" },
          ].map((p, i) => {
            const Icon = p.icon
            return (
              <div key={i} className="rounded-xl border border-border p-4 text-center">
                <Icon className={`h-7 w-7 mx-auto mb-2 ${p.color}`} />
                <div className="text-sm font-semibold mb-1">{p.name}</div>
                <div className="text-[10px] text-muted-foreground">{p.support}</div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* FAQ */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Info className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">FAQ - Pertanyaan Umum</h2>
        </div>
        <div className="space-y-3">
          {[
            {
              q: "Apakah aplikasi ini gratis?",
              a: "Ya, 100% gratis. Aplikasi ini dibuat untuk komunitas STB Indonesia. Anda juga bisa upload mod gratis dan gratis di-download user lain."
            },
            {
              q: "Apakah butuh internet untuk pakai?",
              a: "Ya, butuh internet untuk download mod baru. Tapi setelah dibuka sekali, beberapa halaman (store list, mod detail) bisa diakses offline berkat PWA caching."
            },
            {
              q: "Kenapa APK lebih besar dari PWA?",
              a: "APK berisi WebView browser + application wrapper (~5-10MB). PWA hanya butuh browser yang sudah ada di STB, jadi tidak perlu install ulang."
            },
            {
              q: "Apakah aplikasi aman?",
              a: "Aplikasi ini hanya me-load website STB Mod Store. Tidak ada tracking, tidak ada iklan, tidak ada permission berbahaya. Source code bisa Anda audit."
            },
            {
              q: "Bisa di-set sebagai launcher default STB?",
              a: "Bisa, setelah install APK, masuk ke Settings → Default Apps → Home App → pilih STB Mod Store. Aplikasi akan otomatis terbuka saat STB dinyalakan."
            },
            {
              q: "Bagaimana cara update aplikasi?",
              a: "PWA: update otomatis saat buka aplikasi. APK: re-install dengan APK versi baru, atau gunakan fitur update di dalam aplikasi (coming soon)."
            }
          ].map((faq, i) => (
            <details key={i} className="group rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium flex items-center justify-between gap-2">
                <span>{faq.q}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90 shrink-0" />
              </summary>
              <p className="text-xs text-muted-foreground mt-2 pl-1">{faq.a}</p>
            </details>
          ))}
        </div>
      </Card>

      {/* Footer notice */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-start gap-3">
        <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-medium mb-1">Sudah siap download!</div>
          <p className="text-xs text-muted-foreground">
            Pilih metode yang paling sesuai dengan kebutuhan Anda. Untuk pemula,
            gunakan <strong>PWA (1 klik)</strong>. Untuk yang ingin APK standalone,
            gunakan <strong>PWABuilder</strong>. Untuk developer, gunakan
            <strong> Android Studio Project</strong> atau <strong>Bubblewrap CLI</strong>.
          </p>
        </div>
      </div>
    </div>
  )
}
