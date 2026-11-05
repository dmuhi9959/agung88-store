import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, STORAGE_BUCKET } from '@/lib/supabase'
import { isAdmin } from '@/lib/auth'
import { extractAndStoreApk } from '@/lib/apk-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Vercel membatasi body request ~4.5 MB, jadi file besar dikirim per chunk.
const MAX_SINGLE = 4 * 1024 * 1024 // 4 MB
const MAX_FILE = 500 * 1024 * 1024 // 500 MB

function safeName(name: string): string {
  const cleaned = (name || 'file')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_.]+/, '')
  return (cleaned || 'file').slice(-140)
}

function sizeFormatted(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return bytes + ' B'
}

function uniquePrefix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak. Login admin diperlukan.' },
        { status: 403 }
      )
    }

    const form = await req.formData()
    const file = form.get('file')
    const type = String(form.get('type') || 'mod')

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { success: false, error: 'File tidak ditemukan pada request.' },
        { status: 400 }
      )
    }

    const originalName = (file as File).name || 'file'
    const size = file.size

    // Frontend sudah memecah APK > 4 MB, tapi jaga-jaga kalau ada yang lolos.
    if (size > MAX_SINGLE && type === 'mod' && /\.apk$/i.test(originalName)) {
      return NextResponse.json({ success: false, useChunked: true })
    }

    if (size > MAX_FILE) {
      return NextResponse.json(
        { success: false, error: 'File terlalu besar (maks 500 MB).' },
        { status: 413 }
      )
    }

    const folder =
      type === 'icon' ? 'icons' : type === 'screenshot' ? 'screenshots' : 'mods'
    const path = `${folder}/${uniquePrefix()}-${safeName(originalName)}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const admin = getAdminClient()

    const { error } = await admin.storage.from(STORAGE_BUCKET).upload(path, buffer, {
      contentType:
        type === 'mod'
          ? 'application/vnd.android.package-archive'
          : (file as File).type || 'application/octet-stream',
      cacheControl: '31536000',
      upsert: false,
    })

    if (error) {
      console.error('[upload] storage error:', error)
      return NextResponse.json(
        { success: false, error: 'Gagal menyimpan file: ' + error.message },
        { status: 500 }
      )
    }

    const url = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl

    // APK: ekstrak nama, versi, developer, deskripsi & icon secara otomatis.
    let meta = null
    if (type === 'mod' && /\.apk$/i.test(originalName)) {
      meta = await extractAndStoreApk(buffer, originalName, sizeFormatted(size))
    }

    return NextResponse.json({
      success: true,
      data: {
        path: url,
        originalName,
        size,
        sizeFormatted: sizeFormatted(size),
        iconUrl: meta?.iconUrl || '',
        iconExtracted: meta?.iconExtracted || false,
        meta,
      },
    })
  } catch (error: any) {
    console.error('[upload] error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Upload gagal' },
      { status: 500 }
    )
  }
}
