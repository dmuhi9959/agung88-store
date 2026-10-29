/**
 * Migrate 8 APK mods to Supabase (everything):
 *  - Database record
 *  - APK file di Supabase Storage (public bucket)
 *  - Icon di Supabase Storage (public bucket)
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs/promises'
import path from 'path'
import Database from 'better-sqlite3'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const MODS_DIR = '/home/z/my-project/public/uploads/mods'
const ICONS_DIR = '/home/z/my-project/public/uploads/icons'
const DB_PATH = '/home/z/my-project/db/custom.db'
const BUCKET_NAME = 'agung88-store'

async function main() {
  console.log('=== AGUNG88 Migration: SQLite + Local → Supabase Storage ===\n')

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Create bucket (public)
  console.log('🪣 Creating bucket...')
  const { data: buckets } = await supabase.storage.listBuckets()
  const existingBucket = buckets?.find(b => b.name === BUCKET_NAME)
  if (existingBucket) {
    console.log(`✓ Bucket ${BUCKET_NAME} already exists`)
  } else {
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      allowedMimeTypes: ['application/vnd.android.package-archive', 'image/png', 'image/jpeg'],
      fileSizeLimit: '500MB',
    })
    if (error) {
      console.error('❌ Create bucket error:', error.message)
      // Try without options
      const { error: err2 } = await supabase.storage.createBucket(BUCKET_NAME, { public: true })
      if (err2) {
        console.error('❌ Still error:', err2.message)
        process.exit(1)
      }
    }
    console.log(`✓ Created bucket: ${BUCKET_NAME}`)
  }

  // 2. Get public URL helper
  const { data: pub } = supabase.storage.from(BUCKET_NAME).getPublicUrl('test')
  console.log(`✓ Public URL base: ${pub.publicUrl.split('/test')[0]}\n`)

  // 3. Read SQLite
  const db = new Database(DB_PATH, { readonly: true })
  const mods = db.prepare('SELECT * FROM Mod').all()
  db.close()
  console.log(`📊 Found ${mods.length} mods in SQLite\n`)

  const { data: existing } = await supabase
    .from('mods')
    .select('id, name')
  const existingNames = new Set((existing || []).map((m: any) => m.name))
  console.log(`✓ Supabase DB has ${existingNames.size} mods\n`)

  let success = 0
  let failed: string[] = []
  let apkUploaded = 0
  let iconUploaded = 0

  for (const mod of mods) {
    console.log(`\n--- Processing: ${mod.name} ---`)
    if (existingNames.has(mod.name)) {
      console.log('⏭  Already in Supabase, skipping')
      success++
      continue
    }

    try {
      // Upload APK to Supabase Storage
      const apkFileName = path.basename(mod.filePath || '')
      const apkPath = path.join(MODS_DIR, apkFileName)
      let apkPublicUrl = ''
      if (mod.filePath && await fs.access(apkPath).then(() => true).catch(() => false)) {
        const buffer = await fs.readFile(apkPath)
        const stat = await fs.stat(apkPath)
        const storageKey = `mods/${apkFileName}`
        console.log(`  Uploading APK: ${storageKey} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`)
        const { error } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(storageKey, buffer, {
            contentType: 'application/vnd.android.package-archive',
            upsert: true,
          })
        if (error) {
          console.error('  ❌ APK upload error:', error.message)
        } else {
          const { data: pub } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storageKey)
          apkPublicUrl = pub.publicUrl
          console.log(`  ✓ APK uploaded`)
          apkUploaded++
        }
      }

      // Upload icon to Supabase Storage
      let iconPublicUrl = ''
      if (mod.iconUrl) {
        const iconFileName = path.basename(mod.iconUrl)
        const iconPath = path.join(ICONS_DIR, iconFileName)
        if (await fs.access(iconPath).then(() => true).catch(() => false)) {
          const buffer = await fs.readFile(iconPath)
          const storageKey = `icons/${iconFileName}`
          console.log(`  Uploading icon: ${storageKey}`)
          const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(storageKey, buffer, {
              contentType: 'image/png',
              upsert: true,
            })
          if (error) {
            console.error('  ❌ Icon upload error:', error.message)
          } else {
            const { data: pub } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storageKey)
            iconPublicUrl = pub.publicUrl
            console.log(`  ✓ Icon uploaded`)
            iconUploaded++
          }
        }
      }

      // Insert ke database
      const newRow = {
        name: mod.name,
        slug: mod.slug,
        description: mod.description || '',
        version: mod.version || '',
        developer: mod.developer || '',
        category: mod.category || 'app',
        stb_type: mod.stbType || 'android-tv',
        tags: mod.tags || '',
        file_size: mod.fileSize || '',
        file_name: mod.fileName || '',
        file_path: apkPublicUrl,
        screenshots: mod.screenshots || '',
        changelog: mod.changelog || '',
        icon_url: iconPublicUrl,
        downloads: mod.downloads || 0,
        rating: mod.rating || 5.0,
        featured: !!mod.featured,
        published: mod.published !== 0,
        created_at: mod.createdAt ? new Date(parseInt(mod.createdAt)).toISOString() : new Date().toISOString(),
        updated_at: mod.updatedAt ? new Date(parseInt(mod.updatedAt)).toISOString() : null,
      }

      const { data: insertData, error } = await supabase
        .from('mods')
        .insert(newRow)
        .select()
        .single()

      if (error) {
        console.error('  ❌ Insert error:', error.message)
        failed.push(mod.name)
        continue
      }

      console.log('  ✓ Inserted to Supabase, id:', insertData.id)
      success++
    } catch (err: any) {
      console.error(`  ❌ Error:`, err.message || err)
      failed.push(mod.name)
    }
  }

  console.log('\n=== Migration Summary ===')
  console.log(`✅ Success: ${success}/${mods.length}`)
  console.log(`📦 APK uploaded to Supabase Storage: ${apkUploaded}`)
  console.log(`🖼️  Icons uploaded: ${iconUploaded}`)
  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.join(', ')}`)
  }
  console.log('\n✅ Migration complete!')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
