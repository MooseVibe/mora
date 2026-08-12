import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import {
  PROTOTYPE_ADMIN_EMAIL,
  PROTOTYPE_TESTER_COOKIE,
} from '@/lib/prototype-testers'

function sessionResponse(body: Record<string, unknown>, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  return response
}

function normalizeEmail(value: unknown) {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null
  return email
}

async function createVerifiedTesterSession(email: string, isAdmin = false) {
  return sessionResponse({ authenticated: true, isAdmin })
}

export async function GET() {
  const auth = await createServerClient()
  const { data: { user } } = await auth.auth.getUser()
  const email = user?.email?.toLowerCase()
  if (!email) return sessionResponse({ authenticated: false })
  if (email === PROTOTYPE_ADMIN_EMAIL) return createVerifiedTesterSession(email, true)

  return createVerifiedTesterSession(email)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const email = normalizeEmail(body?.email)
  if (!email) return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  const auth = await createServerClient()
  const { data: { user } } = await auth.auth.getUser()
  if (user?.email?.toLowerCase() === email) {
    return createVerifiedTesterSession(email, email === PROTOTYPE_ADMIN_EMAIL)
  }

  const otp = typeof body?.otp === 'string' ? body.otp.replace(/\D/g, '').slice(0, 8) : ''
  if (otp) {
    const { data, error } = await auth.auth.verifyOtp({ email, token: otp, type: 'email' })
    if (error || data.user?.email?.toLowerCase() !== email) {
      return sessionResponse({ error: 'Invalid OTP' }, { status: 401 })
    }
    return createVerifiedTesterSession(email, email === PROTOTYPE_ADMIN_EMAIL)
  }

  const { error } = await auth.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: email !== PROTOTYPE_ADMIN_EMAIL },
  })
  if (error) return sessionResponse({ error: 'Unable to send OTP' }, { status: 502 })
  return sessionResponse({ requiresOtp: true })
}

export async function DELETE() {
  const auth = await createServerClient()
  await auth.auth.signOut()

  const response = NextResponse.json({ authenticated: false })
  response.cookies.set(PROTOTYPE_TESTER_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  return response
}
