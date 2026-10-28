import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdmin } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest) {
  try {
    const admin = await isAdmin()
    if (!admin) return NextResponse.json({ success: false, error: 'Akses ditolak' }, { status: 403 })
    const body = await req.json().catch(() => ({}))
    const count = Math.min(body.count || 1, 50)
    const codes: string[] = []
    for (let i = 0; i < count; i++) {
      const randomPart = uuidv4().replace(/-/g, '').substring(0, 6).toUpperCase()
      const code = `AGUNG88-${randomPart}`
      let expiresAt = null
      if (body.expiresInDays) expiresAt = new Date(Date.now() + body.expiresInDays * 86400000)
      await db.activation.create({ data: { code, used: false, expiresAt } })
      codes.push(code)
    }
    return NextResponse.json({ success: true, data: { codes }, message: `Berhasil generate ${codes.length} kode` })
  } catch (error) {
    console.error('POST /api/activation/generate error:', error)
    return NextResponse.json({ success: false, error: 'Gagal generate kode' }, { status: 500 })
  }
}
