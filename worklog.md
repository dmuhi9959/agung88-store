---
Task ID: STB-Mod-Store-Main
Agent: Main Agent (Z.ai)
Task: Membuat aplikasi store untuk mod STB (Set-Top Box) dengan fitur upload mod yang dapat dikelola user sendiri

Work Log:
- Inisialisasi environment fullstack dev (Next.js 16 + Prisma + SQLite)
- Mendefinisikan schema Prisma untuk model Mod dengan field lengkap (name, slug, description, version, developer, category, stbType, tags, fileSize, fileName, filePath, screenshots, changelog, iconUrl, downloads, rating, featured, published)
- Push schema ke database SQLite dan generate Prisma Client
- Membuat API routes:
  * /api/mods (GET untuk list dengan filter category/stbType/search/featured, POST untuk create)
  * /api/mods/[id] (GET, PUT, DELETE dengan cleanup file terkait)
  * /api/upload (POST FormData untuk file mod, screenshot, dan icon dengan validasi ekstensi dan ukuran)
  * /api/download/[id] (POST untuk increment counter download)
- Membuat seed script dengan 12 contoh mod STB (Brom ROM, IPTV Smarters, Tivimate, Kodi Build, B860H TWRP Recovery, dll)
- Update globals.css dengan tema emerald/teal, dark mode, custom scrollbar, grid background, glow effect
- Update layout.tsx dengan ThemeProvider (next-themes), metadata SEO Bahasa Indonesia, Toaster & Sonner
- Membuat komponen ThemeProvider untuk dark mode support
- Membuat lib/constants.ts dengan 9 kategori mod (ROM, Aplikasi, Launcher, Codec, System, Recovery, Tema, Tool) dan 8 tipe STB (Android TV, B860H, Evictrio V1, Mi Box S, IndiBox, ZLT S10, dll)
- Membuat lib/types.ts dengan type Mod dan UploadResult
- Membuat halaman utama (page.tsx) sebagai single-page app dengan 3 view:
  * Store: Hero section, Featured mods, All mods grid dengan search/filter/sort
  * Upload: Form lengkap dengan drag-drop file upload, icon, screenshots, metadata, changelog, featured toggle
  * My Uploads: Stats dashboard, grid mod sendiri dengan tombol Lihat/Unduh/Hapus
- Sidebar dengan navigasi, kategori filter, tipe STB filter, dan statistik
- Modal detail mod dengan banner, info, tags, changelog, file info, dan tombol download/share
- Fix lint error: konflik nama `Home` antara import lucide-react dan function component - rename ke HomeIcon
- Fix lint error: refactor `const Icon = ...` jadi helper function `renderCategoryIcon()` agar tidak terdeteksi sebagai component creation during render
- Verifikasi dengan agent-browser: halaman load 200, tidak ada runtime error, semua fitur interaktif bekerja (search, filter kategori, filter STB type, modal detail, navigasi view)

Stage Summary:
- Aplikasi STB Mod Store berhasil dibuat dan berjalan di http://localhost:3000
- 12 mods awal sudah ter-seed di database (termasuk ROM, aplikasi, launcher, codec, dll)
- User dapat langsung upload mod sendiri melalui halaman Upload Mod
- Semua file upload disimpan di /public/uploads/mods dan /public/uploads/screenshots
- Dark mode support dengan tema emerald/teal
- Responsive: mobile-first dengan sidebar drawer untuk layar kecil
- Lint bersih (0 errors, 0 warnings)
- Dev server berjalan stabil di port 3000
- Screenshots tersimpan di /home/z/my-project/download/store-*.png

---
Task ID: STB-Mod-Store-PWA-APK
Agent: Main Agent (Z.ai)
Task: Menambahkan PWA support & fitur download APK untuk STB/Android TV

Work Log:
- Generate PWA icons (14 ukuran: 16-512, maskable, monochrome, favicon.ico, splash screen 1920x1080) menggunakan Python PIL dengan gradient emerald-teal dan ikon CPU/STB
- Buat manifest.json lengkap dengan name, short_name, description, icons (12 entries any+maskable+monochrome), shortcuts (Upload Mod, Mod Saya), categories, theme_color, background_color, display standalone, lang id
- Buat service worker (sw.js) dengan strategi caching:
  * Navigation requests → Network First (fallback cache)
  * API requests → Network First dengan cache 5 menit
  * Static assets → Cache First
  * Default → Stale While Revalidate
- Update layout.tsx dengan metadata lengkap: manifest, icons (9 sizes), apple-touch-icon, theme-color, apple-mobile-web-app-capable, viewport, openGraph, twitter
- Buat komponen ServiceWorkerRegister dengan:
  * Auto register service worker
  * Auto prompt install PWA setelah 3 detik
  * Manual install guide dialog untuk iOS/Safari
  * Floating install button
  * Detect standalone mode
- Tambah view baru "Download APK" di page.tsx (view ke-4):
  * Header dengan ikon TV
  * Quick install via PWA dengan QR code (auto-generate dari URL)
  * 3 metode build APK: PWABuilder, Android Studio Project, Bubblewrap CLI
  * Panduan install di Android TV/STB (USB Flashdisk & ADB Sideload)
  * Kompatibilitas platform (Android TV, HP, iPhone, PC)
  * FAQ accordion 6 pertanyaan
- Tambah tombol "APK" di header dan menu "Download APK" di sidebar
- Buat script Python generate-android-project.py yang membuat Android Studio WebView project ZIP lengkap:
  * settings.gradle, build.gradle (root + app)
  * AndroidManifest.xml dengan Leanback launcher + TV support
  * MainActivity.java (WebView wrapper dengan file upload, permission, pull-to-refresh, D-pad navigation, offline detection)
  * Resources: layout, strings, colors, themes, network_security_config
  * Icons mipmap (mdpi-hdpi-xhdpi-xxhdpi-xxxhdpi + adaptive icon v26)
  * README.md dengan instruksi build lengkap
- ZIP project: 41.5 KB, 29 files, disimpan di /public/downloads/stb-mod-store-android-project.zip
- Fix lint error setState dalam useEffect:
  * sw-register.tsx: pakai queueMicrotask untuk defer setState
  * page.tsx DownloadGuideView: pakai useRef + queueMicrotask
- Verifikasi dengan agent-browser:
  * Halaman download-guide render dengan baik (header, PWA install, 3 metode, install guide, FAQ)
  * Service worker registered dengan scope http://localhost:3000/
  * Manifest link aktif dan JSON valid
  * Theme color dan meta tags ter-set
  * ZIP download berfungsi (HTTP 200, 41534 bytes)
- Lint bersih (0 errors, 0 warnings)

Stage Summary:
- Aplikasi STB Mod Store sekarang adalah PWA lengkap dengan manifest, icons, dan service worker
- User bisa install sebagai PWA langsung dari browser (1 klik)
- User bisa download Android Studio project ZIP untuk build APK sendiri
- Tersedia 3 opsi build APK: PWABuilder (paling mudah), Android Studio (paling customizable), Bubblewrap CLI (Google official)
- Panduan install di STB tersedia 2 metode: USB Flashdisk dan ADB Sideload
- ZIP project siap diakses di /downloads/stb-mod-store-android-project.zip
- Semua verifikasi browser pass, tidak ada runtime error
