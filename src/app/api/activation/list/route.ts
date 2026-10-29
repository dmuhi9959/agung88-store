import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'
import { isAdmin } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Akses ditolak' }, { status: 403 })
    }
    const { searchParams } = new URL(req.url)
    const filter = searchParams.get('filter')

    const adminClient = getAdminClient()
    const { data, error } = await adminClient
      .from('activations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    let activations = data || []
    if (filter === 'used') {
      activations = activations.filter((a: any) => a.used)
    } else if (filter === 'unused') {
      activations = activations.filter((a: any) => !a.used)
    }

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: activations })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Gagal memuat' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Akses ditolak' }, { status: 403 })
    }
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID wajib' }, { status: 400 })
    }
    const adminClient = getAdminClient()
    const { error } = await adminClient.from('activations').delete().eq('id', id)
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, message: 'Kode dihapus' })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Gagal hapus' }, { status: 500 })
  }
}
