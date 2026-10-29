import { NextRequest, NextResponse } from 'next/server'
import { getPublicClient, getAdminClient, modFromDb, modToCamel, STORAGE_BUCKET } from '@/lib/supabase'
import { isAdmin } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const client = getPublicClient()
    const { data, error } = await client
      .from('mods')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: 'Mod tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: modToCamel(modFromDb(data)) })
  } catch (error) {
    console.error('[mods/[id] GET] error:', error)
    return NextResponse.json(
      { success: false, error: 'Gagal memuat detail mod' },
      { status: 500 }
    )
  }
}

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
    const client = getAdminClient()

    const { data: existing } = await client
      .from('mods')
      .select('*')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Mod tidak ditemukan' },
        { status: 404 }
      )
    }

    const update: any = { updated_at: new Date().toISOString() }
    if (body.name !== undefined) update.name = String(body.name)
    if (body.description !== undefined) update.description = String(body.description)
    if (body.version !== undefined) update.version = String(body.version)
    if (body.developer !== undefined) update.developer = String(body.developer)
    if (body.tags !== undefined) update.tags = String(body.tags)
    if (body.changelog !== undefined) update.changelog = String(body.changelog)
    if (body.fileSize !== undefined) update.file_size = String(body.fileSize)
    if (body.fileName !== undefined) update.file_name = String(body.fileName)
    if (body.filePath !== undefined) update.file_path = String(body.filePath)
    if (body.iconUrl !== undefined) update.icon_url = String(body.iconUrl)
    if (body.featured !== undefined) update.featured = Boolean(body.featured)
    if (body.published !== undefined) update.published = Boolean(body.published)

    const { data, error } = await client
      .from('mods')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Gagal update: ' + error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: modToCamel(modFromDb(data)) })
  } catch (error: any) {
    console.error('[mods/[id] PUT] error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Gagal update mod' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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
    const client = getAdminClient()

    const { data: mod } = await client
      .from('mods')
      .select('*')
      .eq('id', id)
      .single()

    if (!mod) {
      return NextResponse.json(
        { success: false, error: 'Mod tidak ditemukan' },
        { status: 404 }
      )
    }

    // Hapus file APK dari Supabase Storage
    if (mod.file_path) {
      try {
        const apkKey = mod.file_path.split('/agung88-store/')[1]
        if (apkKey) await client.storage.from(STORAGE_BUCKET).remove([apkKey])
      } catch (e) {}
    }

    // Hapus icon dari Supabase Storage
    if (mod.icon_url) {
      try {
        const iconKey = mod.icon_url.split('/agung88-store/')[1]
        if (iconKey) await client.storage.from(STORAGE_BUCKET).remove([iconKey])
      } catch (e) {}
    }

    // Hapus record dari database
    const { error } = await client
      .from('mods')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Gagal hapus: ' + error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: 'Mod berhasil dihapus' })
  } catch (error: any) {
    console.error('[mods/[id] DELETE] error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Gagal hapus mod' },
      { status: 500 }
    )
  }
}
