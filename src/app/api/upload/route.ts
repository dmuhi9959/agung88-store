import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { getAdminClient, STORAGE_BUCKET } from '@/lib/supabase'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, mkdir, readFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const execFileAsync = promisify(execFile)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4MB (Vercel limit ~4.5MB)
const CHUNK_THRESHOLD = 4 * 1024 * 1024 // >4MB pakai chunked

interface UploadResult {
  path: string
  originalName: string
  size: number
  sizeFormatted: string
  iconExtracted?: boolean
  iconUrl?: string
  useChunked?: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w\-.]+/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function ensureUniqueName(prefix: string, ext: string): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)
  return `${slugify(prefix)}_${timestamp}${random}${ext}`
}

async function extractApkIcon(apkBuffer: Buffer, apkFileName: string): Promise<string | null> {
  try {
    const tmpDir = '/tmp/agung88-icon-extract'
    await mkdir(tmpDir, { recursive: true })
    const tmpApkPath = path.join(tmpDir, `${Date.now()}-${slugify(apkFileName)}`)
    await writeFile(tmpApkPath, apkBuffer)
    const iconBaseName = apkFileName.replace(/\.apk$/i, '')
    const iconFileName = `${iconBaseName}-icon.png`
    const tmpIconPath = path.join(tmpDir, iconFileName)
    const cwd = process.cwd()
    const scriptPath = path.join(cwd, 'scripts', 'extract_single_icon.py')
    if (!existsSync(scriptPath)) {
      try { await unlink(tmpApkPath) } catch {}
      return null
    }
    try {
      await execFileAsync('python3', [scriptPath, tmpApkPath, tmpIconPath], { timeout: 30000, maxBuffer: 1024 * 1024 * 50 })
    } catch {
      try { await unlink(tmpApkPath) } catch {}
      return null
    }
    if (!existsSync(tmpIconPath)) {
      try { await unlink(tmpApkPath) } catch {}
      return null
    }
    const iconBuffer = await readFile(tmpIconPath)
    if (iconBuffer.length < 1000) {
      try { await unlink(tmpApkPath); await unlink(tmpIconPath) } catch {}
      return null
    }

    // Upload icon ke Supabase Storage
    const client = getAdminClient()
    const iconKey = `icons/${iconFileName}`
    const { error } = await client.storage
      .from(STORAGE_BUCKET)
      .upload(iconKey, iconBuffer, {
        contentType: 'image/png',
        upsert: true,
      })
    try { await unlink(tmpApkPath); await unlink(tmpIconPath) } catch {}
    if (error) return null

    const { data: pub } = client.storage.from(STORAGE_BUCKET).getPublicUrl(iconKey)
    return pub.publicUrl
  } catch (err) {
    console.error('[upload] Icon extraction error:', err)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak. Login admin diperlukan.' },
        { status: 403 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file')
    const type = (formData.get('type') as string) || 'mod'

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'File tidak ditemukan dalam request' },
        { status: 400 }
      )
    }

    if (file.size > 500 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: `File terlalu besar (maks 500 MB)` },
        { status: 413 }
      )
    }

    // Untuk APK > 4MB, pakai chunked upload
    if (type === 'mod' && file.size > CHUNK_THRESHOLD) {
      return NextResponse.json({
        success: false,
        error: 'File terlalu besar. Gunakan chunked upload.',
        code: 'USE_CHUNKED',
        useChunked: true,
      }, { status: 413 })
    }

    const originalName = file.name
    const buffer = Buffer.from(await file.arrayBuffer())

    let storageKey: string, contentType: string, publicUrl: string
    if (type === 'mod') {
      const ext = path.extname(originalName).toLowerCase() || '.apk'
      const baseName = path.basename(originalName, ext)
      const uniqueName = ensureUniqueName(baseName, ext)
      storageKey = `mods/${uniqueName}`
      contentType = 'application/vnd.android.package-archive'
    } else if (type === 'icon') {
      const ext = path.extname(originalName).toLowerCase() || '.png'
      const baseName = path.basename(originalName, ext)
      const uniqueName = ensureUniqueName(baseName, ext)
      storageKey = `icons/${uniqueName}`
      contentType = file.type || 'image/png'
    } else {
      return NextResponse.json(
        { success: false, error: 'Tipe upload tidak valid' },
        { status: 400 }
      )
    }

    // Upload to Supabase Storage
    const client = getAdminClient()
    const { error: upErr } = await client.storage
      .from(STORAGE_BUCKET)
      .upload(storageKey, buffer, { contentType, upsert: true })

    if (upErr) {
      return NextResponse.json(
        { success: false, error: 'Gagal upload: ' + upErr.message },
        { status: 500 }
      )
    }

    const { data: pub } = client.storage.from(STORAGE_BUCKET).getPublicUrl(storageKey)
    publicUrl = pub.publicUrl

    const result: UploadResult = {
      path: publicUrl,
      originalName,
      size: buffer.length,
      sizeFormatted: formatSize(buffer.length),
    }

    // Auto-extract icon untuk APK
    if (type === 'mod' && originalName.toLowerCase().endsWith('.apk')) {
      const iconUrl = await extractApkIcon(buffer, originalName)
      if (iconUrl) {
        result.iconExtracted = true
        result.iconUrl = iconUrl
      }
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error('[upload] POST error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Gagal upload file' },
      { status: 500 }
    )
  }
}
