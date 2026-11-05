import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, STORAGE_BUCKET } from '@/lib/supabase'
import { isAdmin } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CHUNK_DIR = 'chunks'

function chunkPath(uploadId: string, index: number): string {
  return `${CHUNK_DIR}/${uploadId}/${String(index).padStart(6, '0')}.part`
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
    const chunk = form.get('chunk')
    const uploadId = String(form.get('uploadId') || '')
    const chunkIndex = parseInt(String(form.get('chunkIndex') || ''), 10)
    const totalChunks = parseInt(String(form.get('totalChunks') || ''), 10)

    if (!chunk || typeof chunk === 'string') {
      return NextResponse.json(
        { success: false, error: 'Chunk tidak ditemukan.' },
        { status: 400 }
      )
    }

    if (!/^[A-Za-z0-9._-]{1,80}$/.test(uploadId)) {
      return NextResponse.json(
        { success: false, error: 'uploadId tidak valid.' },
        { status: 400 }
      )
    }

    if (
      !Number.isFinite(chunkIndex) ||
      chunkIndex < 0 ||
      !Number.isFinite(totalChunks) ||
      totalChunks < 1 ||
      chunkIndex >= totalChunks
    ) {
      return NextResponse.json(
        { success: false, error: 'Index chunk tidak valid.' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await chunk.arrayBuffer())
    const admin = getAdminClient()

    const { error } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(chunkPath(uploadId, chunkIndex), buffer, {
        contentType: 'application/octet-stream',
        cacheControl: '3600',
        upsert: true,
      })

    if (error) {
      console.error('[upload/chunk] storage error:', error)
      return NextResponse.json(
        { success: false, error: 'Gagal menyimpan chunk: ' + error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { uploadId, chunkIndex, totalChunks },
    })
  } catch (error: any) {
    console.error('[upload/chunk] error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Upload chunk gagal' },
      { status: 500 }
    )
  }
}
