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
