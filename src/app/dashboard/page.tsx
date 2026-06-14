import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import CardSyncOnMount from '@/components/CardSyncOnMount'
import DrawWidget from '@/components/DrawWidget'
import RecentCardsWidget from '@/components/RecentCardsWidget'
import DashboardTodayCard from '@/components/DashboardTodayCard'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'
import { getDrawReading, type DrawReadingRow } from '@/lib/draw-reading'
import { getTarotCardDefinition, getTarotCardMeta } from '@/lib/tarot'
import './dashboard.css'

function formatTodayDate() {
  return new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

type PendingDraw = {
  cardId: string
  drawnAt: string
  variantIdx?: number
}

type DrawRow = {
  card_id: string
  drawn_at: string
  variant_idx?: number | null
  reading_snapshot?: unknown
}

function parsePendingDrawCookie(value: string | undefined, today: string): PendingDraw | null {
  if (!value) return null

  try {
    const draw = JSON.parse(decodeURIComponent(value)) as Partial<PendingDraw>
    if (
      typeof draw.cardId === 'string' &&
      typeof draw.drawnAt === 'string' &&
      draw.drawnAt === today &&
      getTarotCardDefinition(draw.cardId)
    ) {
      return { cardId: draw.cardId, drawnAt: draw.drawnAt, variantIdx: draw.variantIdx }
    }
  } catch {
    return null
  }

  return null
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string; shareQa?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { preview, shareQa } = await searchParams
  const isShareQa = shareQa === '1' && process.env.NODE_ENV !== 'production'
  const isShareQaDraw = isShareQa && preview === 'empty'

  const today = new Date().toISOString().split('T')[0]
  const cookieStore = await cookies()
  const pendingDraw = parsePendingDrawCookie(cookieStore.get('mora_pending_draw')?.value, today)

  const { data: todayDraw } = await supabase
    .from('card_draws')
    .select('*')
    .eq('user_id', user.id)
    .eq('drawn_at', today)
    .single()

  let recentDrawsQuery = supabase
    .from('card_draws')
    .select('card_id, drawn_at, variant_idx, reading_snapshot')
    .eq('user_id', user.id)

  if (todayDraw || pendingDraw) {
    recentDrawsQuery = recentDrawsQuery.lt('drawn_at', today)
  }

  const { data: recentDraws } = await recentDrawsQuery
    .order('drawn_at', { ascending: false })
    .limit(3)

  const firstName = user.user_metadata?.full_name?.split(' ')[0] || 'Путник'
  const avatarUrl = user.user_metadata?.avatar_url
  const isEmptyAllPreview = preview === 'empty-all'

  // preview overrides: ?preview=empty forces today's empty state, ?preview=empty-all simulates a new user
  const pendingTodayDraw = pendingDraw
    ? { card_id: pendingDraw.cardId, drawn_at: pendingDraw.drawnAt, variant_idx: pendingDraw.variantIdx ?? 0 }
    : null
  const optimisticTodayDraw: DrawRow | null = isShareQa
    ? pendingTodayDraw ?? todayDraw
    : todayDraw ?? pendingTodayDraw

  let todayReadingRow: DrawReadingRow | null
  if (preview === 'empty' || isEmptyAllPreview) {
    todayReadingRow = null
  } else if (preview === 'drawn') {
    todayReadingRow = optimisticTodayDraw ?? { card_id: 'sun', drawn_at: today, variant_idx: 0 }
  } else {
    todayReadingRow = optimisticTodayDraw
  }
  const cardMeaning = todayReadingRow ? getDrawReading(todayReadingRow) : null
  const cardId = cardMeaning?.cardId
  const cardDefinition = cardId ? getTarotCardDefinition(cardId) : null
  const cardMeta = cardId ? getTarotCardMeta(cardId) : null
  const recentDrawsForView = isEmptyAllPreview
    ? []
    : recentDraws
  const journalHref = preview ? `/journal?returnPreview=${encodeURIComponent(preview)}` : '/journal'

  return (
    <div className="db-wrap">
      <CardSyncOnMount
        serverDraw={!preview && !isShareQa && todayDraw?.card_id && todayDraw?.drawn_at
          ? {
              cardId: todayDraw.card_id,
              drawnAt: todayDraw.drawn_at,
              variantIdx: typeof todayDraw.variant_idx === 'number' ? todayDraw.variant_idx : 0,
            }
          : null}
      />

      <AuthenticatedHeader firstName={firstName} avatarUrl={avatarUrl} />

      {/* MAIN */}
      <div className="db-main">

        <h1 className="db-welcome">Добро пожаловать, {firstName}</h1>

        <div className="db-grid">

          {/* LEFT: CARD OF DAY */}
          <div className={`db-panel db-panel--card${!cardDefinition ? ' db-panel--draw' : ''}`}>
            {cardDefinition && cardMeaning && cardId ? (
              <DashboardTodayCard
                cardId={cardId}
                title={cardMeaning.title}
                titleMeta={cardMeaning.titleMeta}
                tags={cardMeaning.tags}
                tarotBrief={cardMeaning.tarotBrief}
                meaningLabel={cardMeaning.meaningLabel}
                paragraphs={cardMeaning.paragraphs}
                fullParagraphs={cardMeaning.fullParagraphs}
                shareText={cardMeaning.shareText}
                readingDate={formatTodayDate()}
                journalArcana={cardMeta?.journalArcana ?? 'Старший аркан'}
              />
            ) : (
              <DrawWidget
                date={`Сегодня ${formatTodayDate()}`}
                persistDraw={!preview || isShareQaDraw}
                shareQa={isShareQaDraw}
                returnHref={isShareQaDraw ? '/dashboard?shareQa=1' : '/dashboard'}
              />
            )}
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="db-sidebar">

            <RecentCardsWidget draws={recentDrawsForView} journalHref={journalHref} />

            <div className="db-panel db-tarot-stub">
              <span className="db-tarot-stub-label">Походы к тарологу</span>
              <p className="db-tarot-stub-text">Скоро здесь появятся ваши сеансы с тарологом</p>
            </div>

          </div>

        </div>

      </div>

      {/* ADVICE */}
      <div className="db-advice">
        <span className="db-advice-star">✦</span>
        <p className="db-advice-text">Совет дня: не бойся перемен. Иногда разрушение — это начало чего-то лучшего.</p>
        <span className="db-advice-star">✦</span>
      </div>

    </div>
  )
}
