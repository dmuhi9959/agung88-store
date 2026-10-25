import { NextResponse } from 'next/server'
import { isAdmin, ADMIN_USERNAME } from '@/lib/auth'

export async function GET() {
  try {
    const admin = await isAdmin()
    return NextResponse.json({
      success: true,
      data: {
        isAdmin: admin,
        username: admin ? ADMIN_USERNAME : null,
      },
    })
  } catch (error) {
    console.error('GET /api/auth/check error:', error)
    return NextResponse.json(
      { success: false, error: 'Gagal cek session' },
      { status: 500 }
    )
  }
}
