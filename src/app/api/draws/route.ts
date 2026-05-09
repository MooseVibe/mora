import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { cardId, drawnAt } = await request.json()
  if (!cardId || !drawnAt) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('card_draws')
    .select('id')
    .eq('user_id', user.id)
    .eq('drawn_at', drawnAt)
    .maybeSingle()

  if (existing) return NextResponse.json({ ok: true, skipped: true })

  const { error } = await supabase
    .from('card_draws')
    .insert({ user_id: user.id, card_id: cardId, drawn_at: drawnAt })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
