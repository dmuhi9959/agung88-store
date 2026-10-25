import { cookies } from 'next/headers'

// Admin credentials (default: admin / admin123)
// In production, store hashed in env variable
export const ADMIN_USERNAME = 'admin'
export const ADMIN_PASSWORD = 'admin123'
export const SESSION_COOKIE = 'stb_admin_session'
// Session valid for 7 days
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7

// Simple session token generator (not cryptographically secure, but enough for demo)
function generateSessionToken(username: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 12)
  const payload = `${username}:${timestamp}:${random}`
  // Base64 encode (URL-safe)
  return Buffer.from(payload).toString('base64url')
}

export function validateCredentials(username: string, password: string): boolean {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD
}

export function createSession(username: string) {
  const token = generateSessionToken(username)
  const expires = new Date(Date.now() + SESSION_MAX_AGE * 1000)
  return { token, expires }
}

// Server-side: check if current request is admin
export async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  const session = cookieStore.get(SESSION_COOKIE)
  if (!session?.value) return false
  try {
    const decoded = Buffer.from(session.value, 'base64url').toString('utf-8')
    const [username, timestampStr] = decoded.split(':')
    if (username !== ADMIN_USERNAME) return false
    const timestamp = parseInt(timestampStr, 10)
    if (isNaN(timestamp)) return false
    const ageSeconds = (Date.now() - timestamp) / 1000
    if (ageSeconds > SESSION_MAX_AGE) return false
    return true
  } catch {
    return false
  }
}
