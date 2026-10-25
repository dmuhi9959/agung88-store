#!/usr/bin/env node
/**
 * Upload APK baru ke store:
 * 1. MovieBoxTV.apk (39 MB) - com.community.mbox.tv
 * 2. VORX TV v1.23-news-release.apk (20 MB) - com.ramz1649.itachitv
 */

import { db } from '../src/lib/db'
import { copyFile, stat, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const UPLOADS_DIR = '/home/z/my-project/public/uploads/mods'

const NEW_APKS = [
  {
    sourcePath: '/home/z/my-project/upload/MovieBoxTV.apk',
    targetFilename: 'moviebox-tv-v1.1.11.apk',
    name: 'MovieBox TV',
    slug: 'moviebox-tv',
    description: 'MovieBox TV - Streaming film, series, dan acara TV terbaru dengan kualitas HD dan 4K. Dilengkapi dengan daftar watchlist, search, dan dukungan multiple server streaming. Gratis tanpa registrasi.',
    version: 'v1.1.11.0915',
    developer: 'MovieBox Community',
    tags: 'moviebox, streaming, movies, series, tv shows, hd, 4k',
    changelog: '- Versi 1.1.11.0915\n- Update library film terbaru\n- Fix bug playback\n- Tambah server streaming cepat\n- Support subtitle multi-bahasa',
  },
  {
    sourcePath: '/home/z/my-project/upload/VORX TV v1.23-news-release (SFILE.MOBI) - Copy.apk',
    targetFilename: 'vorx-tv-v1.23.apk',
    name: 'VORX TV',
    slug: 'vorx-tv',
    description: 'VORX TV - Aplikasi IPTV untuk streaming live TV channel Indonesia dan internasional. Mendukung EPG, catch-up TV, VOD, dan multi-device. Stabil dan anti-buffering untuk STB/Android TV.',
    version: 'v1.23',
    developer: 'VORX',
    tags: 'vorx, iptv, live tv, streaming, epg, catch-up, stb',
    changelog: '- Versi 1.23 new release\n- Tambah channel lokal Indonesia\n- Fix EPG tidak muncul\n- Optimasi untuk Android TV / STB\n- Anti buffering untuk koneksi lambat',
  },
]

async function main() {
  console.log('🚀 Memulai upload APK baru ke store...\n')

  // Ensure target directory exists
  await mkdir(UPLOADS_DIR, { recursive: true })

  for (const apk of NEW_APKS) {
    console.log(`━━━ ${apk.name} ━━━`)

    // Check source file
    if (!existsSync(apk.sourcePath)) {
      console.error(`❌ Source tidak ditemukan: ${apk.sourcePath}`)
      continue
    }

    // Get file size
    const stats = await stat(apk.sourcePath)
    const sizeStr = formatBytes(stats.size)
    console.log(`📦 Size: ${sizeStr}`)

    // Copy to public uploads
    const targetPath = path.join(UPLOADS_DIR, apk.targetFilename)
    if (existsSync(targetPath)) {
      console.log(`⚠️  File sudah ada, akan di-overwrite`)
    }
    await copyFile(apk.sourcePath, targetPath)
    console.log(`✅ Copied ke: ${targetPath}`)

    // Check if mod with same slug already exists
    const existing = await db.mod.findFirst({ where: { slug: apk.slug } })
    if (existing) {
      // Update existing
      const updated = await db.mod.update({
        where: { id: existing.id },
        data: {
          name: apk.name,
          description: apk.description,
          version: apk.version,
          developer: apk.developer,
          tags: apk.tags,
          changelog: apk.changelog,
          fileSize: sizeStr,
          fileName: path.basename(apk.sourcePath),
          filePath: `/uploads/mods/${apk.targetFilename}`,
          featured: true,
          published: true,
        },
      })
      console.log(`✅ Updated record: ${updated.id}`)
    } else {
      // Create new record
      const newMod = await db.mod.create({
        data: {
          name: apk.name,
          slug: apk.slug,
          description: apk.description,
          version: apk.version,
          developer: apk.developer,
          category: 'app',
          stbType: 'android-tv',
          tags: apk.tags,
          fileSize: sizeStr,
          fileName: path.basename(apk.sourcePath),
          filePath: `/uploads/mods/${apk.targetFilename}`,
          changelog: apk.changelog,
          iconUrl: '',
          downloads: 0,
          rating: 5.0,
          featured: true,
          published: true,
        },
      })
      console.log(`✅ Created record: ${newMod.id}`)
    }
    console.log()
  }

  // Summary
  const allMods = await db.mod.findMany({ orderBy: { createdAt: 'desc' } })
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 TOTAL APK DI STORE:', allMods.length)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  for (const m of allMods) {
    console.log(`  • ${m.name} ${m.version} (${m.fileSize})`)
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
