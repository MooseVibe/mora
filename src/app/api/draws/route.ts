import { createClient } from '@/lib/supabase/server'
import { createReadingSnapshot } from '@/lib/draw-reading'
import { getTarotCardDefinition } from '@/lib/tarot'
import { NextResponse } from 'next/server'

type DrawRequestBody = {
  cardId?: unknown
  drawnAt?: unknown
  variantIdx?: unknown
}

function isDrawDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function normalizeVariantIdx(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { cardId, drawnAt, variantIdx: rawVariantIdx } = await request.json() as DrawRequestBody
  if (typeof cardId !== 'string' || typeof drawnAt !== 'string' || !isDrawDate(drawnAt)) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  if (!getTarotCardDefinition(cardId)) {
    return NextResponse.json({ error: 'Unknown card' }, { status: 400 })
  }

  const variantIdx = normalizeVariantIdx(rawVariantIdx)
  const readingSnapshot = createReadingSnapshot(cardId, variantIdx)

  const { data: existing } = await supabase
    .from('card_draws')
    .select('id')
    .eq('user_id', user.id)
    .eq('drawn_at', drawnAt)
    .maybeSingle()

  if (existing) return NextResponse.json({ ok: true, skipped: true })

  const insertPayload = {
    user_id: user.id,
    card_id: cardId,
    drawn_at: drawnAt,
    variant_idx: variantIdx,
    reading_snapshot: readingSnapshot,
  }

  const { error } = await supabase
    .from('card_draws')
    .insert(insertPayload)

  if (error?.code === '42703') {
    const { error: fallbackError } = await supabase
      .from('card_draws')
      .insert({
        user_id: user.id,
        card_id: cardId,
        drawn_at: drawnAt,
        variant_idx: variantIdx,
      })

    if (fallbackError) return NextResponse.json({ error: fallbackError.message }, { status: 500 })
    return NextResponse.json({ ok: true, snapshotSkipped: true })
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
