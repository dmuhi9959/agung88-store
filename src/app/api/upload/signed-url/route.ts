import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { getAdminClient, STORAGE_BUCKET } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

/**
 * POST /api/upload/signed-url
 *
 * Generate signed upload URL Supabase Storage supaya browser bisa
 * upload APK langsung ke Supabase (bypass Vercel, no timeout issue).
 */
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
    const { fileName, contentType } = body as {
      fileName?: string
      contentType?: string
    }

    if (!fileName) {
      return NextResponse.json(
        { success: false, error: 'fileName wajib diisi' },
        { status: 400 }
      )
    }

    const ext = fileName.toLowerCase().endsWith('.apk') ? '.apk' :
                fileName.toLowerCase().endsWith('.png') ? '.png' :
                fileName.toLowerCase().endsWith('.jpg') ? '.jpg' : ''
    const baseName = fileName.replace(/\.[^/.]+$/, '')
    const folder = fileName.toLowerCase().endsWith('.apk') ? 'mods' : 'icons'
    const storageKey = `${folder}/${ensureUniqueName(baseName, ext)}`

    const client = getAdminClient()
    const { data, error } = await client.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(storageKey)

    if (error || !data) {
      console.error('[signed-url] Supabase error:', error)
      return NextResponse.json(
        { success: false, error: 'Gagal buat signed URL: ' + (error?.message || 'unknown') },
        { status: 500 }
      )
    }

    const { data: pub } = client.storage.from(STORAGE_BUCKET).getPublicUrl(storageKey)

    return NextResponse.json({
      success: true,
      data: {
        signedUrl: data.signedUrl,
        token: data.token,
        path: data.path,
        publicUrl: pub.publicUrl,
        contentType: contentType || (folder === 'mods' ? 'application/vnd.android.package-archive' : 'image/png'),
      },
    })
  } catch (error: any) {
    console.error('[signed-url] POST error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Gagal generate signed URL' },
      { status: 500 }
    )
  }
}
