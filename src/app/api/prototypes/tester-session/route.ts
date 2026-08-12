import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import {
  hashPrototypeTesterToken,
  PROTOTYPE_ADMIN_EMAIL,
  PROTOTYPE_TESTER_COOKIE,
  prototypeTesterRequest,
} from '@/lib/prototype-testers'

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30

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
  if (isAdmin) return sessionResponse({ authenticated: true, isAdmin: true })

  const token = randomBytes(32).toString('base64url')
  const result = await prototypeTesterRequest({
    action: 'create',
    email,
    tokenHash: hashPrototypeTesterToken(token),
  })
  if (!result.ok) return sessionResponse({ error: 'Unable to create tester session' }, { status: 502 })

  const response = sessionResponse({
    authenticated: true,
    isAdmin: false,
    nextSpreadAt: result.data?.nextSpreadAt ?? null,
  })
  response.cookies.set(PROTOTYPE_TESTER_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })
  return response
}

export async function GET(request: NextRequest) {
  const auth = await createServerClient()
  const { data: { user } } = await auth.auth.getUser()
  const email = user?.email?.toLowerCase()
  if (!email) return sessionResponse({ authenticated: false })
  if (email === PROTOTYPE_ADMIN_EMAIL) return createVerifiedTesterSession(email, true)

  const token = request.cookies.get(PROTOTYPE_TESTER_COOKIE)?.value
  if (token) {
    const result = await prototypeTesterRequest({
      action: 'verify',
      tokenHash: hashPrototypeTesterToken(token),
    })
    if (result.ok && result.data?.authenticated === true) {
      return sessionResponse({
        authenticated: true,
        isAdmin: false,
        nextSpreadAt: result.data?.nextSpreadAt ?? null,
      })
    }
  }

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

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get(PROTOTYPE_TESTER_COOKIE)?.value
  if (token) {
    await prototypeTesterRequest({
      action: 'revoke',
      tokenHash: hashPrototypeTesterToken(token),
    })
  }

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
