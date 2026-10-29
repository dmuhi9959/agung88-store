import { NextRequest, NextResponse } from 'next/server'
import { getPublicClient, getAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST - increment download counter
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const client = getPublicClient()
    const { data: mod } = await client
      .from('mods')
      .select('*')
      .eq('id', id)
      .single()

    if (!mod) {
      return NextResponse.json({ success: false, error: 'Mod tidak ditemukan' }, { status: 404 })
    }

    const adminClient = getAdminClient()
    const { data: updated } = await adminClient
      .from('mods')
      .update({ downloads: (mod.downloads || 0) + 1 })
      .eq('id', id)
      .select('downloads')
      .single()

    return NextResponse.json({
      success: true,
      data: {
        downloads: updated?.downloads || (mod.downloads || 0) + 1,
      },
    })
  } catch (error: any) {
    console.error('[download POST] error:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Gagal update counter' }, { status: 500 })
  }
}

// GET - redirect ke public URL Supabase Storage
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const client = getPublicClient()
    const { data: mod } = await client
      .from('mods')
      .select('*')
      .eq('id', id)
      .single()

    if (!mod) {
      return NextResponse.json({ success: false, error: 'Mod tidak ditemukan' }, { status: 404 })
    }

    if (!mod.file_path) {
      return NextResponse.json({ success: false, error: 'File belum tersedia' }, { status: 404 })
    }

    // mod.file_path sudah berupa public URL Supabase Storage
    // Redirect ke URL tersebut
    return NextResponse.redirect(mod.file_path, { status: 302 })
  } catch (error: any) {
    console.error('[download GET] error:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Gagal download' }, { status: 500 })
  }
}
