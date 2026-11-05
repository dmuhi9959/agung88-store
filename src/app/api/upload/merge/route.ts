import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, STORAGE_BUCKET } from '@/lib/supabase'
import { isAdmin } from '@/lib/auth'
import { extractAndStoreApk } from '@/lib/apk-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CHUNK_DIR = 'chunks'

function safeName(name: string): string {
  const cleaned = (name || 'file.apk')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_.]+/, '')
  return (cleaned || 'file.apk').slice(-140)
}

function sizeFormatted(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return bytes + ' B'
}

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak. Login admin diperlukan.' },
        { status: 403 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const uploadId = String(body.uploadId || '')
    const fileName = String(body.fileName || 'file.apk')
    const totalChunks = parseInt(String(body.totalChunks || ''), 10)

    if (!/^[A-Za-z0-9._-]{1,80}$/.test(uploadId)) {
      return NextResponse.json(
        { success: false, error: 'uploadId tidak valid.' },
        { status: 400 }
      )
    }

    if (!Number.isFinite(totalChunks) || totalChunks < 1 || totalChunks > 500) {
      return NextResponse.json(
        { success: false, error: 'totalChunks tidak valid.' },
        { status: 400 }
      )
    }

    const admin = getAdminClient()
    const parts: Buffer[] = []

    for (let i = 0; i < totalChunks; i++) {
      const name = `${String(i).padStart(6, '0')}.part`
      const { data, error } = await admin.storage
        .from(STORAGE_BUCKET)
        .download(`${CHUNK_DIR}/${uploadId}/${name}`)

      if (error || !data) {
        console.error('[upload/merge] missing chunk', name, error)
        return NextResponse.json(
          {
            success: false,
            error: `Chunk ${i + 1}/${totalChunks} tidak ditemukan. Silakan upload ulang.`,
          },
          { status: 400 }
        )
      }

      parts.push(Buffer.from(await data.arrayBuffer()))
    }

    const merged = Buffer.concat(parts)
    if (merged.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Hasil gabungan kosong.' },
        { status: 400 }
      )
    }

    const finalPath = `mods/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}-${safeName(fileName)}`

    const { error: uploadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(finalPath, merged, {
        contentType: 'application/vnd.android.package-archive',
        cacheControl: '31536000',
        upsert: false,
      })

    if (uploadError) {
      console.error('[upload/merge] upload error:', uploadError)
      return NextResponse.json(
        {
          success: false,
          error: 'Gagal menyimpan hasil gabungan: ' + uploadError.message,
        },
        { status: 500 }
      )
    }

    // Bersihkan chunk sementara (kalau gagal, tidak masalah).
    const paths = Array.from(
      { length: totalChunks },
      (_, i) => `${CHUNK_DIR}/${uploadId}/${String(i).padStart(6, '0')}.part`
    )
    await admin.storage
      .from(STORAGE_BUCKET)
      .remove(paths)
      .catch(() => {})

    const url = admin.storage.from(STORAGE_BUCKET).getPublicUrl(finalPath).data.publicUrl

    // APK: ekstrak nama, versi, developer, deskripsi & icon secara otomatis.
    let meta = null
    if (/\.apk$/i.test(fileName)) {
      meta = await extractAndStoreApk(merged, fileName, sizeFormatted(merged.length))
    }

    return NextResponse.json({
      success: true,
      data: {
        path: url,
        originalName: fileName,
        size: merged.length,
        sizeFormatted: sizeFormatted(merged.length),
        iconUrl: meta?.iconUrl || '',
        iconExtracted: meta?.iconExtracted || false,
        meta,
      },
    })
  } catch (error: any) {
    console.error('[upload/merge] error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Merge gagal' },
      { status: 500 }
    )
  }
}
