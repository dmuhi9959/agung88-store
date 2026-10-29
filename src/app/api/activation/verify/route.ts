import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { code } = body
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ success: false, error: 'Kode aktivasi wajib diisi' }, { status: 400 })
    }

    // Use admin client (bypass RLS) untuk verifikasi kode
    const client = getAdminClient()
    const { data: activation, error } = await client
      .from('activations')
      .select('*')
      .eq('code', code.trim().toUpperCase())
      .single()

    if (error || !activation) {
      return NextResponse.json(
        { success: false, error: 'Kode aktivasi tidak valid. Hubungi admin via WhatsApp.' },
        { status: 404 }
      )
    }

    if (activation.used) {
      return NextResponse.json(
        { success: false, error: 'Kode aktivasi sudah dipakai. Minta kode baru ke admin.' },
        { status: 400 }
      )
    }

    if (activation.expires_at && new Date() > new Date(activation.expires_at)) {
      return NextResponse.json(
        { success: false, error: 'Kode aktivasi sudah kadaluarsa.' },
        { status: 400 }
      )
    }

    const userAgent = req.headers.get('user-agent') || ''
    await client
      .from('activations')
      .update({
        used: true,
        used_at: new Date().toISOString(),
        device_info: userAgent.substring(0, 200),
      })
      .eq('id', activation.id)

    return NextResponse.json({
      success: true,
      message: 'Kode aktivasi valid!',
      data: { code: activation.code },
    })
  } catch (error) {
    console.error('[activation/verify] error:', error)
    return NextResponse.json({ success: false, error: 'Gagal verifikasi' }, { status: 500 })
  }
}
