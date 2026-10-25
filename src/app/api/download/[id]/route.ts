import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const mod = await db.mod.findUnique({ where: { id } })
    if (!mod) {
      return NextResponse.json(
        { success: false, error: 'Mod tidak ditemukan' },
        { status: 404 }
      )
    }

    const updated = await db.mod.update({
      where: { id },
      data: { downloads: { increment: 1 } },
    })

    return NextResponse.json({
      success: true,
      data: {
        downloads: updated.downloads,
        filePath: mod.filePath,
        fileName: mod.fileName || mod.name,
      },
    })
  } catch (error) {
    console.error('POST /api/download/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Gagal memproses download' },
      { status: 500 }
    )
  }
}
