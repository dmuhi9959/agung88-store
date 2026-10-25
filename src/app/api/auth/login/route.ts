import { NextRequest, NextResponse } from 'next/server'
import { validateCredentials, createSession, SESSION_COOKIE, SESSION_MAX_AGE, ADMIN_USERNAME } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username dan password wajib diisi' },
        { status: 400 }
      )
    }

    if (!validateCredentials(username, password)) {
      return NextResponse.json(
        { success: false, error: 'Username atau password salah' },
        { status: 401 }
      )
    }

    const session = createSession(username)

    const response = NextResponse.json({
      success: true,
      data: {
        username,
        message: 'Login berhasil',
      },
    })

    // Set HTTP-only cookie
    response.cookies.set({
      name: SESSION_COOKIE,
      value: session.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('POST /api/auth/login error:', error)
    return NextResponse.json(
      { success: false, error: 'Gagal login' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    success: false,
    error: 'Gunakan POST untuk login',
    hint: `Default credentials: ${ADMIN_USERNAME} / ***`,
  })
}
