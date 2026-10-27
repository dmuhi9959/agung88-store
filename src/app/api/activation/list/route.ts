import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdmin } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const admin = await isAdmin()
    if (!admin) return NextResponse.json({ success: false, error: 'Akses ditolak' }, { status: 403 })
    const { searchParams } = new URL(req.url)
    const filter = searchParams.get('filter')
    const where: any = {}
    if (filter === 'used') where.used = true
    else if (filter === 'unused') where.used = false
    const activations = await db.activation.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 })
    return NextResponse.json({ success: true, data: activations })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Gagal memuat' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await isAdmin()
    if (!admin) return NextResponse.json({ success: false, error: 'Akses ditolak' }, { status: 403 })
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, error: 'ID wajib' }, { status: 400 })
    await db.activation.delete({ where: { id } })
    return NextResponse.json({ success: true, message: 'Kode dihapus' })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Gagal hapus' }, { status: 500 })
  }
}
