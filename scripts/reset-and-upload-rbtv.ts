#!/usr/bin/env node
/**
 * Reset database - hapus semua mod contoh, upload APK RBTV sebagai satu-satunya APK di store
 */

import { db } from '../src/lib/db'
import { unlink, mkdir, copyFile, stat } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const SOURCE_APK = '/home/z/my-project/upload/RBTV+ v3.0.323.apk'
const TARGET_DIR = '/home/z/my-project/public/uploads/mods'
const TARGET_FILENAME = 'rbtv-v3.0.323.apk'

async function main() {
  console.log('🧹 Membersihkan database...')

  // Get all mods to delete their files too
  const allMods = await db.mod.findMany()
  console.log(`Ditemukan ${allMods.length} mod di database`)

  // Delete associated files
  for (const mod of allMods) {
    if (mod.filePath) {
      const absPath = path.join(process.cwd(), 'public', mod.filePath)
      if (existsSync(absPath)) {
        try {
          await unlink(absPath)
          console.log(`  ✓ Deleted file: ${mod.filePath}`)
        } catch (e) {
          // ignore
        }
      }
    }
    if (mod.iconUrl) {
      const absPath = path.join(process.cwd(), 'public', mod.iconUrl)
      if (existsSync(absPath)) {
        try { await unlink(absPath) } catch {}
      }
    }
  }

  // Delete all mods
  await db.mod.deleteMany({})
  console.log('✅ Semua mod berhasil dihapus dari database')

  // Verify source APK exists
  if (!existsSync(SOURCE_APK)) {
    console.error(`❌ Source APK tidak ditemukan: ${SOURCE_APK}`)
    process.exit(1)
  }

  const stats = await stat(SOURCE_APK)
  console.log(`📦 File APK ditemukan: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)

  // Ensure target directory exists
  await mkdir(TARGET_DIR, { recursive: true })

  // Copy APK to public/uploads/mods
  const targetPath = path.join(TARGET_DIR, TARGET_FILENAME)
  console.log(`📋 Copy APK ke ${targetPath}...`)
  await copyFile(SOURCE_APK, targetPath)
  console.log('✅ APK berhasil di-copy')

  // Format file size
  const sizeStr = formatBytes(stats.size)

  // Create mod record in database
  console.log('💾 Menyimpan record ke database...')
  const newMod = await db.mod.create({
    data: {
      name: 'RBTV+',
      slug: 'rbtv-plus-v3-0-323',
      description: 'Aplikasi RBTV+ v3.0.323 untuk streaming TV. Mendukung live TV, VOD, series, dan movies dengan kualitas HD/4K. Optimized untuk STB / Android TV.',
      version: 'v3.0.323',
      developer: 'RBTV',
      category: 'app',
      stbType: 'android-tv',
      tags: 'rbtv, streaming, iptv, live tv, vod, movies',
      fileSize: sizeStr,
      fileName: 'RBTV+ v3.0.323.apk',
      filePath: `/uploads/mods/${TARGET_FILENAME}`,
      screenshots: '',
      changelog: '- RBTV+ v3.0.323\n- Versi terbaru dengan fitur streaming yang ditingkatkan\n- Support kualitas HD dan 4K\n- Optimized untuk STB dan Android TV',
      iconUrl: '',
      downloads: 0,
      rating: 5.0,
      featured: true,
      published: true,
    },
  })

  console.log('✅ APK RBTV+ berhasil ditambahkan ke database!')
  console.log(`   - ID: ${newMod.id}`)
  console.log(`   - Name: ${newMod.name}`)
  console.log(`   - Version: ${newMod.version}`)
  console.log(`   - Size: ${newMod.fileSize}`)
  console.log(`   - Path: ${newMod.filePath}`)

  const finalCount = await db.mod.count()
  console.log(`\n📊 Total APK di database: ${finalCount}`)
  console.log('\n🎉 Selesai! Store sekarang hanya berisi APK RBTV+ Anda.')
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
