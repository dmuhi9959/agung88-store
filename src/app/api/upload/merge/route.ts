import { NextRequest, NextResponse } from 'next/server'
import { readdir, readFile, unlink, rm } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { isAdmin } from '@/lib/auth'
import { getAdminClient, STORAGE_BUCKET } from '@/lib/supabase'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, mkdir } from 'fs/promises'

const execFileAsync = promisify(execFile)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CHUNKS_DIR = '/tmp/agung88-chunks'

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
    const scriptPath = path.join(process.cwd(), 'scripts', 'extract_single_icon.py')
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
      .upload(iconKey, iconBuffer, { contentType: 'image/png', upsert: true })
    try { await unlink(tmpApkPath); await unlink(tmpIconPath) } catch {}
    if (error) return null

    const { data: pub } = client.storage.from(STORAGE_BUCKET).getPublicUrl(iconKey)
    return pub.publicUrl
  } catch (err) {
    console.error('[upload/merge] Icon extraction error:', err)
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
    const body = await req.json()
    const { uploadId, fileName, totalChunks } = body as { uploadId?: string; fileName?: string; totalChunks?: number }
    if (!uploadId || !fileName) {
      return NextResponse.json(
        { success: false, error: 'uploadId dan fileName wajib diisi' },
        { status: 400 }
      )
    }
    const safeUploadId = uploadId.replace(/[^a-zA-Z0-9-]/g, '')
    const sessionDir = path.join(CHUNKS_DIR, safeUploadId)
    if (!existsSync(sessionDir)) {
      return NextResponse.json(
        { success: false, error: 'Upload session tidak ditemukan' },
        { status: 404 }
      )
    }
    const chunkFiles = (await readdir(sessionDir)).filter(n => n.startsWith('chunk_')).sort()
    if (chunkFiles.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada chunk ditemukan' },
        { status: 400 }
      )
    }
    if (totalChunks && chunkFiles.length !== totalChunks) {
      return NextResponse.json(
        { success: false, error: `Jumlah chunk tidak match (${chunkFiles.length}/${totalChunks})` },
        { status: 400 }
      )
    }

    // Merge chunks ke single buffer
    const chunks: Buffer[] = []
    let totalSize = 0
    for (const chunkFile of chunkFiles) {
      const chunkBuffer = await readFile(path.join(sessionDir, chunkFile))
      chunks.push(chunkBuffer)
      totalSize += chunkBuffer.length
    }
    const mergedBuffer = Buffer.concat(chunks, totalSize)

    // Cleanup chunks
    try { await rm(sessionDir, { recursive: true, force: true }) } catch {}

    // Generate storage key
    const ext = path.extname(fileName).toLowerCase() || '.apk'
    const baseName = path.basename(fileName, ext)
    const uniqueName = ensureUniqueName(baseName, ext)
    const storageKey = `mods/${uniqueName}`

    // Upload merged file ke Supabase Storage
    const client = getAdminClient()
    const { error: upErr } = await client.storage
      .from(STORAGE_BUCKET)
      .upload(storageKey, mergedBuffer, {
        contentType: 'application/vnd.android.package-archive',
        upsert: true,
      })

    if (upErr) {
      return NextResponse.json(
        { success: false, error: 'Gagal upload ke storage: ' + upErr.message },
        { status: 500 }
      )
    }

    const { data: pub } = client.storage.from(STORAGE_BUCKET).getPublicUrl(storageKey)

    const result: any = {
      path: pub.publicUrl,
      originalName: fileName,
      size: totalSize,
      sizeFormatted: formatSize(totalSize),
      useChunked: true,
    }

    // Auto-extract icon
    if (fileName.toLowerCase().endsWith('.apk')) {
      const iconUrl = await extractApkIcon(mergedBuffer, fileName)
      if (iconUrl) {
        result.iconExtracted = true
        result.iconUrl = iconUrl
      }
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error('[upload/merge] POST error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Gagal merge chunks' },
      { status: 500 }
    )
  }
}
