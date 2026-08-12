import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { PROTOTYPE_ADMIN_EMAIL, prototypeAccountRequest } from '@/lib/prototype-testers'
import { TAROT_CARD_LIST, getTarotCardDefinition } from '@/lib/tarot'

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  })
}

async function authenticatedAccount() {
  const auth = await createServerClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user?.email) return null
  const { data: { session } } = await auth.auth.getSession()
  if (!session?.access_token) return null
  return { user, accessToken: session.access_token }
}

function dailyCandidate() {
  const cards = TAROT_CARD_LIST.filter((card) => card.image && card.result?.dayVariants?.length)
  const card = cards[Math.floor(Math.random() * cards.length)]
  const variantIndex = Math.floor(Math.random() * (card.result?.dayVariants?.length || 1))
  return { cardId: card.id, variantIndex }
}

function validDaily(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const daily = value as Record<string, unknown>
  const cardId = typeof daily.cardId === 'string' ? daily.cardId : ''
  const variantIndex = Number(daily.variantIndex)
  const card = getTarotCardDefinition(cardId)
  if (!card?.result?.dayVariants?.[variantIndex]) return null
  return {
    status: daily.status === 'drawn' ? 'drawn' : 'pending',
    cardId,
    variantIndex,
    drawnAt: typeof daily.drawnAt === 'string' ? daily.drawnAt : null,
    nextDailyAt: typeof daily.nextDailyAt === 'string' ? daily.nextDailyAt : null,
  }
}

export async function GET() {
  const account = await authenticatedAccount()
  if (!account) return response({ error: 'Authenticated account required' }, 401)

  const candidate = dailyCandidate()
  const result = await prototypeAccountRequest(account.accessToken, {
    action: 'account-state',
    ...candidate,
  })
  if (!result.ok) return response({ error: 'Unable to load account state' }, result.status || 502)

  const daily = validDaily(result.data?.daily)
  if (!daily) return response({ error: 'Invalid daily account state' }, 502)
  return response({
    accountId: account.user.id,
    email: account.user.email?.toLowerCase(),
    isAdmin: account.user.email?.toLowerCase() === PROTOTYPE_ADMIN_EMAIL,
    daily,
    spread: result.data?.spread ?? null,
    nextSpreadAt: result.data?.nextSpreadAt ?? null,
  })
}

export async function POST(request: NextRequest) {
  const account = await authenticatedAccount()
  if (!account) return response({ error: 'Authenticated account required' }, 401)
  const body = await request.json().catch(() => null)
  const action = body?.action
  if (!['complete-daily', 'clear-account-spread'].includes(action)) {
    return response({ error: 'Invalid account action' }, 400)
  }

  const result = await prototypeAccountRequest(account.accessToken, { action })
  if (!result.ok) return response(result.data ?? { error: 'Unable to update account state' }, result.status || 502)
  if (action === 'complete-daily') {
    const daily = validDaily({ ...result.data, status: 'drawn' })
    if (!daily) return response({ error: 'Invalid daily account state' }, 502)
    return response({ daily })
  }
  return response({ cleared: true })
}
