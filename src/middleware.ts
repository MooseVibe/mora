import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(cookie => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token') && cookie.value.length > 0)
}

function isLocalDebugDrawRequest(request: NextRequest) {
  return request.nextUrl.pathname === '/' &&
    request.nextUrl.searchParams.get('debugDraw') === '1' &&
    ['localhost', '127.0.0.1', '::1'].includes(request.nextUrl.hostname)
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const isPublicEntry = request.nextUrl.pathname === '/' || request.nextUrl.pathname === '/auth'

  if (isLocalDebugDrawRequest(request)) {
    return supabaseResponse
  }

  if (isPublicEntry && !hasSupabaseAuthCookie(request)) {
    return supabaseResponse
  }

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (isPublicEntry && user) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      url.search = ''
      return NextResponse.redirect(url)
    }
  } catch {
    // если Supabase недоступен — пропускаем, не крашим сайт
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/',
    '/auth',
    '/dashboard/:path*',
    '/journal/:path*',
    '/api/draws/:path*',
    '/auth/logout',
  ],
}
