import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth'

export async function POST() {
  try {
    const response = NextResponse.json({
      success: true,
      message: 'Logout berhasil',
    })

    // Clear cookie
    response.cookies.set({
      name: SESSION_COOKIE,
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('POST /api/auth/logout error:', error)
    return NextResponse.json(
      { success: false, error: 'Gagal logout' },
      { status: 500 }
    )
  }
}
