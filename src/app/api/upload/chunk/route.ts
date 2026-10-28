import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, appendFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { isAdmin } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CHUNKS_DIR = path.join(process.cwd(), 'public', 'uploads', '_chunks')
const MAX_CHUNK_SIZE = 30 * 1024 * 1024 // 30MB per chunk

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
    const file = formData.get('chunk') as File | null
    const uploadId = formData.get('uploadId') as string | null
    const chunkIndex = formData.get('chunkIndex') as string | null
    const totalChunks = formData.get('totalChunks') as string | null
    const fileName = formData.get('fileName') as string | null

    if (!file || !uploadId || chunkIndex === null || !fileName) {
      return NextResponse.json(
        { success: false, error: 'Parameter chunk tidak lengkap' },
        { status: 400 }
      )
    }

    if (file.size > MAX_CHUNK_SIZE) {
      return NextResponse.json(
        { success: false, error: `Chunk terlalu besar (maks ${MAX_CHUNK_SIZE / 1024 / 1024}MB)` },
        { status: 413 }
      )
    }

    // Create upload session dir
    const sessionDir = path.join(CHUNKS_DIR, uploadId)
    await mkdir(sessionDir, { recursive: true })

    const chunkBuffer = Buffer.from(await file.arrayBuffer())
    const chunkPath = path.join(sessionDir, `chunk_${chunkIndex.padStart(5, '0')}`)
    await writeFile(chunkPath, chunkBuffer)

    return NextResponse.json({
      success: true,
      data: {
        uploadId,
        chunkIndex: parseInt(chunkIndex, 10),
        totalChunks: totalChunks ? parseInt(totalChunks, 10) : null,
        received: chunkBuffer.length,
      },
    })
  } catch (error: any) {
    console.error('[upload/chunk] POST error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Gagal upload chunk' },
      { status: 500 }
    )
  }
}
