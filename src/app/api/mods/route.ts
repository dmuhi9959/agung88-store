import { NextRequest, NextResponse } from 'next/server'
import { getPublicClient, getAdminClient, modFromDb, modToCamel } from '@/lib/supabase'
import { isAdmin } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

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

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')
    const limit = searchParams.get('limit')

    const client = getPublicClient()
    let query = client
      .from('mods')
      .select('*')
      .eq('published', true)
      .order('created_at', { ascending: false })

    if (limit) {
      query = query.limit(parseInt(limit, 10))
    }

    const { data, error } = await query

    if (error) {
      console.error('[mods GET] Supabase error:', error)
      return NextResponse.json(
        { success: false, error: 'Gagal memuat daftar mod' },
        { status: 500 }
      )
    }

    let mods = data || []
    if (search) {
      const lower = search.toLowerCase()
      mods = mods.filter((m: any) =>
        m.name?.toLowerCase().includes(lower) ||
        m.description?.toLowerCase().includes(lower) ||
        m.tags?.toLowerCase().includes(lower) ||
        m.developer?.toLowerCase().includes(lower)
      )
    }

    const result = mods.map((m: any) => modToCamel(modFromDb(m)))
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('[mods GET] error:', error)
    return NextResponse.json(
      { success: false, error: 'Gagal memuat daftar mod' },
      { status: 500 }
    )
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
    const {
      name, description, version, developer,
      category, stbType, tags, fileSize, fileName,
      filePath, screenshots, changelog, iconUrl, featured,
    } = body

    if (!name || !description || !version || !developer) {
      return NextResponse.json(
        { success: false, error: 'Field wajib belum lengkap (nama, deskripsi, versi, developer)' },
        { status: 400 }
      )
    }

    let slug = slugify(name)
    const client = getAdminClient()
    const { data: existing } = await client
      .from('mods')
      .select('id')
      .eq('slug', slug)
      .limit(1)

    if (existing && existing.length > 0) {
      slug = `${slug}-${uuidv4().slice(0, 6)}`
    }

    const { data, error } = await client
      .from('mods')
      .insert({
        name: String(name),
        slug,
        description: String(description),
        version: String(version),
        developer: String(developer),
        category: category ? String(category) : 'app',
        stb_type: stbType ? String(stbType) : 'android-tv',
        tags: tags ? String(tags) : '',
        file_size: fileSize ? String(fileSize) : '',
        file_name: fileName ? String(fileName) : '',
        file_path: filePath ? String(filePath) : '',
        screenshots: screenshots ? String(screenshots) : '',
        changelog: changelog ? String(changelog) : '',
        icon_url: iconUrl ? String(iconUrl) : '',
        featured: Boolean(featured),
        published: true,
      })
      .select()
      .single()

    if (error) {
      console.error('[mods POST] Supabase error:', error)
      return NextResponse.json(
        { success: false, error: 'Gagal membuat mod baru: ' + error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: modToCamel(modFromDb(data)) })
  } catch (error: any) {
    console.error('[mods POST] error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Gagal membuat mod baru' },
      { status: 500 }
    )
  }
}
