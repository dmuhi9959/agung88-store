import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdmin } from '@/lib/auth'
import { unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export async function GET(
  _req: NextRequest,
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
    return NextResponse.json({ success: true, data: mod })
  } catch (error) {
    console.error('GET /api/mods/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Gagal memuat detail mod' },
      { status: 500 }
    )
  }
}

// PUT - hanya admin
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak. Login admin diperlukan.' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await req.json()

    const existing = await db.mod.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Mod tidak ditemukan' },
        { status: 404 }
      )
    }

    const updated = await db.mod.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        description: body.description ?? existing.description,
        version: body.version ?? existing.version,
        developer: body.developer ?? existing.developer,
        category: body.category ?? existing.category,
        stbType: body.stbType ?? existing.stbType,
        tags: body.tags ?? existing.tags,
        fileSize: body.fileSize ?? existing.fileSize,
        fileName: body.fileName ?? existing.fileName,
        filePath: body.filePath ?? existing.filePath,
        screenshots: body.screenshots ?? existing.screenshots,
        changelog: body.changelog ?? existing.changelog,
        iconUrl: body.iconUrl ?? existing.iconUrl,
        featured: body.featured ?? existing.featured,
        published: body.published ?? existing.published,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('PUT /api/mods/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Gagal memperbarui mod' },
      { status: 500 }
    )
  }
}

// DELETE - hanya admin
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak. Login admin diperlukan.' },
        { status: 403 }
      )
    }

    const { id } = await params
    const existing = await db.mod.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Mod tidak ditemukan' },
        { status: 404 }
      )
    }

    // Delete associated files
    if (existing.filePath) {
      const absPath = path.join(process.cwd(), 'public', existing.filePath)
      if (existsSync(absPath)) {
        try { await unlink(absPath) } catch {}
      }
    }
    if (existing.screenshots) {
      const shots = existing.screenshots.split('|').filter(Boolean)
      for (const s of shots) {
        const absPath = path.join(process.cwd(), 'public', s)
        if (existsSync(absPath)) {
          try { await unlink(absPath) } catch {}
        }
      }
    }
    if (existing.iconUrl) {
      const absPath = path.join(process.cwd(), 'public', existing.iconUrl)
      if (existsSync(absPath)) {
        try { await unlink(absPath) } catch {}
      }
    }

    await db.mod.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/mods/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Gagal menghapus mod' },
      { status: 500 }
    )
  }
}
