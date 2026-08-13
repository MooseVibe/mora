import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { prototypeAccountRequest } from '@/lib/prototype-testers'
import { TAROT_CARD_LIST, getTarotCardDefinition } from '@/lib/tarot'

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  })
}

async function authenticatedAccount() {
  const auth = await createServerClient()
  const { data: { session } } = await auth.auth.getSession()
  return session?.access_token ?? null
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
  const auth = await createServerClient()
  const candidate = dailyCandidate()
  const { data, error } = await auth.rpc('bootstrap_own_prototype_account', {
    p_card_id: candidate.cardId,
    p_variant_index: candidate.variantIndex,
  })
  if (error?.code === '42501') return response({ error: 'Authenticated account required' }, 401)
  if (error || !data) return response({ error: 'Unable to load account state' }, 502)

  const daily = validDaily(data.daily)
  if (!daily) return response({ error: 'Invalid daily account state' }, 502)
  return response({
    accountId: data.accountId,
    email: data.email,
    isAdmin: data.isAdmin === true,
    daily,
    spread: data.spread ?? null,
    nextSpreadAt: data.nextSpreadAt ?? null,
  })
}

export async function POST(request: NextRequest) {
  const account = await authenticatedAccount()
  if (!account) return response({ error: 'Authenticated account required' }, 401)
  const body = await request.json().catch(() => null)
  const action = body?.action
  if (action === 'client-event') {
    const allowedEvents = new Set([
      'daily-state-resolved',
      'daily-3d-ready',
      'daily-deck-pointer',
      'daily-deck-click',
      'daily-restore-started',
      'daily-restore-completed',
      'daily-restore-failed',
    ])
    const event = typeof body?.event === 'string' ? body.event : ''
    if (!allowedEvents.has(event)) return response({ error: 'Invalid client event' }, 400)
    console.info('[mora-client]', {
      event,
      trace: typeof body?.trace === 'string' ? body.trace.slice(0, 64) : '',
      dailyState: ['pending', 'drawn', 'none'].includes(body?.dailyState) ? body.dailyState : 'none',
      deckReady: body?.deckReady === true,
      deckDisabled: body?.deckDisabled === true,
    })
    return response({ recorded: true })
  }
  if (!['complete-daily', 'clear-account-spread'].includes(action)) {
    return response({ error: 'Invalid account action' }, 400)
  }

  const result = await prototypeAccountRequest(account, { action })
  if (!result.ok) return response(result.data ?? { error: 'Unable to update account state' }, result.status || 502)
  if (action === 'complete-daily') {
    const daily = validDaily({ ...result.data, status: 'drawn' })
    if (!daily) return response({ error: 'Invalid daily account state' }, 502)
    return response({ daily })
  }
  return response({ cleared: true })
}
