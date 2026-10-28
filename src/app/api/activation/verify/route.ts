import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { code } = body
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ success: false, error: 'Kode aktivasi wajib diisi' }, { status: 400 })
    }
    const activation = await db.activation.findFirst({ where: { code: code.trim().toUpperCase() } })
    if (!activation) {
      return NextResponse.json({ success: false, error: 'Kode aktivasi tidak valid. Hubungi admin via WhatsApp.' }, { status: 404 })
    }
    if (activation.used) {
      return NextResponse.json({ success: false, error: 'Kode aktivasi sudah dipakai. Minta kode baru ke admin.' }, { status: 400 })
    }
    if (activation.expiresAt && new Date() > activation.expiresAt) {
      return NextResponse.json({ success: false, error: 'Kode aktivasi sudah kadaluarsa.' }, { status: 400 })
    }
    const userAgent = req.headers.get('user-agent') || ''
    await db.activation.update({
      where: { id: activation.id },
      data: { used: true, usedAt: new Date(), deviceInfo: userAgent.substring(0, 200) }
    })
    return NextResponse.json({ success: true, message: 'Kode aktivasi valid!', data: { code: activation.code } })
  } catch (error) {
    console.error('POST /api/activation/verify error:', error)
    return NextResponse.json({ success: false, error: 'Gagal verifikasi' }, { status: 500 })
  }
}
