import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { isAdmin } from '@/lib/auth'

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')
    const limit = searchParams.get('limit')

    const where: any = { published: true }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { tags: { contains: search } },
        { developer: { contains: search } },
      ]
    }

    const mods = await db.mod.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...(limit ? { take: parseInt(limit, 10) } : {}),
    })

    return NextResponse.json({ success: true, data: mods })
  } catch (error) {
    console.error('GET /api/mods error:', error)
    return NextResponse.json(
      { success: false, error: 'Gagal memuat daftar mod' },
      { status: 500 }
    )
  }
}

// POST - hanya admin
export async function POST(req: NextRequest) {
  try {
    // Check admin access
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak. Login admin diperlukan.' },
        { status: 403 }
      )
    }

    const body = await req.json()

    const {
      name,
      description,
      version,
      developer,
      category,
      stbType,
      tags,
      fileSize,
      fileName,
      filePath,
      screenshots,
      changelog,
      iconUrl,
      featured,
    } = body

    if (!name || !description || !version || !developer) {
      return NextResponse.json(
        { success: false, error: 'Field wajib belum lengkap (nama, deskripsi, versi, developer)' },
        { status: 400 }
      )
    }

    let slug = slugify(name)
    // Ensure unique slug
    const existing = await db.mod.findFirst({ where: { slug } })
    if (existing) {
      slug = `${slug}-${uuidv4().slice(0, 6)}`
    }

    const mod = await db.mod.create({
      data: {
        name: String(name),
        slug,
        description: String(description),
        version: String(version),
        developer: String(developer),
        category: category ? String(category) : 'app',
        stbType: stbType ? String(stbType) : 'android-tv',
        tags: tags ? String(tags) : '',
        fileSize: fileSize ? String(fileSize) : '',
        fileName: fileName ? String(fileName) : '',
        filePath: filePath ? String(filePath) : '',
        screenshots: screenshots ? String(screenshots) : '',
        changelog: changelog ? String(changelog) : '',
        iconUrl: iconUrl ? String(iconUrl) : '',
        featured: Boolean(featured),
        published: true,
      },
    })

    return NextResponse.json({ success: true, data: mod })
  } catch (error) {
    console.error('POST /api/mods error:', error)
    return NextResponse.json(
      { success: false, error: 'Gagal membuat mod baru' },
      { status: 500 }
    )
  }
}
