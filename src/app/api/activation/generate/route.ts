import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'
import { isAdmin } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Akses ditolak' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const count = Math.min(body.count || 1, 50)
    const codes: string[] = []
    const adminClient = getAdminClient()

    const rows: { code: string; used: boolean; expires_at: string | null }[] = []
    for (let i = 0; i < count; i++) {
      const randomPart = uuidv4().replace(/-/g, '').substring(0, 6).toUpperCase()
      const code = `AGUNG88-${randomPart}`
      let expiresAt: string | null = null
      if (body.expiresInDays) {
        expiresAt = new Date(Date.now() + body.expiresInDays * 86400000).toISOString()
      }
      rows.push({ code, used: false, expires_at: expiresAt })
      codes.push(code)
    }

    const { error } = await adminClient.from('activations').insert(rows as any)
    if (error) {
      return NextResponse.json({ success: false, error: 'Gagal generate: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: { codes },
      message: `Berhasil generate ${codes.length} kode`,
    })
  } catch (error: any) {
    console.error('[activation/generate] error:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Gagal generate kode' }, { status: 500 })
  }
}
