import { createHash } from 'node:crypto'

export const PROTOTYPE_TESTER_COOKIE = 'mora-prototype-tester'
export const PROTOTYPE_ADMIN_EMAIL = 'iliushka00@bk.ru'

export function hashPrototypeTesterToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function prototypeTesterRequest(body: Record<string, string>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return { ok: false, status: 503, data: null }

  const response = await fetch(`${url}/functions/v1/prototype-tester-session`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const data = await response.json().catch(() => null)
  return { ok: response.ok, status: response.status, data }
}
