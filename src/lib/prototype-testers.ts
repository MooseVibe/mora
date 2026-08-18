export const PROTOTYPE_TESTER_COOKIE = 'mora-prototype-tester'
export const PROTOTYPE_ADMIN_EMAIL = 'iliushka00@bk.ru'
export const PROTOTYPE_PASSWORD_TESTER_EMAIL = 'moratest@bk.ru'

export function isUnlimitedPrototypeAccount(email: string | null | undefined) {
  const normalizedEmail = email?.toLowerCase()
  return normalizedEmail === PROTOTYPE_ADMIN_EMAIL
    || normalizedEmail === PROTOTYPE_PASSWORD_TESTER_EMAIL
}

export async function prototypeAccountRequest(accessToken: string, body: Record<string, unknown>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url || !accessToken) return { ok: false, status: 401, data: null }

  const response = await fetch(`${url}/functions/v1/prototype-tester-session`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const data = await response.json().catch(() => null)
  return { ok: response.ok, status: response.status, data }
}
