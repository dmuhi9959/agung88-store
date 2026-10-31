import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { getAdminClient, STORAGE_BUCKET } from '@/lib/supabase'
import { extractIconFromApk } from '@/lib/extract-icon'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `${slugify(prefix)}_${ts}${rand}${ext}`
}

async function extractApkIcon(apkBuffer: Buffer, apkFileName: string): Promise<string | null> {
  try {
    const iconBuffer = await extractIconFromApk(apkBuffer)
    if (!iconBuffer || iconBuffer.length < 1000) return null

    const iconBaseName = apkFileName.replace(/\.apk$/i, '')
    const iconFileName = `${iconBaseName}-icon.png`
    const client = getAdminClient()
    const iconKey = `icons/${iconFileName}`
    const { error } = await client.storage
      .from(STORAGE_BUCKET)
      .upload(iconKey, iconBuffer, { contentType: 'image/png', upsert: true })
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
        { success: false, error: 'File terlalu besar (maks 500 MB)' },
        { status: 413 }
      )
    }

    if (type === 'mod' && file.size > 4 * 1024 * 1024) {
      return NextResponse.json({
        success: false,
        error: 'File terlalu besar. Gunakan chunked upload.',
        code: 'USE_CHUNKED',
        useChunked: true,
      }, { status: 413 })
    }

    const originalName = file.name
    const buffer = Buffer.from(await file.arrayBuffer())

    let storageKey: string, contentType: string
    if (type === 'mod') {
      const ext = path.extname(originalName).toLowerCase() || '.apk'
      const baseName = path.basename(originalName, ext)
      storageKey = `mods/${ensureUniqueName(baseName, ext)}`
      contentType = 'application/vnd.android.package-archive'
    } else if (type === 'icon') {
      const ext = path.extname(originalName).toLowerCase() || '.png'
      const baseName = path.basename(originalName, ext)
      storageKey = `icons/${ensureUniqueName(baseName, ext)}`
      contentType = file.type || 'image/png'
    } else {
      return NextResponse.json(
        { success: false, error: 'Tipe upload tidak valid' },
        { status: 400 }
      )
    }

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
    const result: UploadResult = {
      path: pub.publicUrl,
      originalName,
      size: buffer.length,
      sizeFormatted: formatSize(buffer.length),
    }

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
