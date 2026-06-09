import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import CardSyncOnMount from '@/components/CardSyncOnMount'
import DrawWidget from '@/components/DrawWidget'
import RecentCardsWidget from '@/components/RecentCardsWidget'
import DrawnCardTilt from '@/components/DrawnCardTilt'
import DashboardCardReader from '@/components/DashboardCardReader'
import { getTarotCardDailyMeaning, getTarotCardDefinition, getTarotCardMeta } from '@/lib/tarot'
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
  searchParams: Promise<{ preview?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { preview } = await searchParams

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
  const optimisticTodayDraw: DrawRow | null = todayDraw ?? (
    pendingDraw ? { card_id: pendingDraw.cardId, drawn_at: pendingDraw.drawnAt } : null
  )

  let cardId: string | undefined
  if (preview === 'empty' || isEmptyAllPreview) {
    cardId = undefined
  } else if (preview === 'drawn') {
    cardId = optimisticTodayDraw?.card_id ?? 'sun'
  } else {
    cardId = optimisticTodayDraw?.card_id as string | undefined
  }
  const cardDefinition = cardId ? getTarotCardDefinition(cardId) : null
  const cardMeta = cardId ? getTarotCardMeta(cardId) : null
  const variantIdx = typeof optimisticTodayDraw?.variant_idx === 'number'
    ? optimisticTodayDraw.variant_idx
    : pendingDraw && pendingDraw.cardId === cardId
      ? pendingDraw.variantIdx ?? 0
      : 0
  const cardMeaning = cardId ? getTarotCardDailyMeaning(cardId, variantIdx) : null
  const recentDrawsForView = isEmptyAllPreview
    ? []
    : recentDraws
  const journalHref = preview ? `/journal?returnPreview=${encodeURIComponent(preview)}` : '/journal'

  return (
    <div className="db-wrap">
      <CardSyncOnMount
        serverDraw={!preview && todayDraw?.card_id && todayDraw?.drawn_at
          ? { cardId: todayDraw.card_id, drawnAt: todayDraw.drawn_at }
          : null}
      />

      {/* HEADER */}
      <header className="db-header">
        <a href="/" className="db-logo">
          <span className="db-logo-icon">✦</span>
          <span className="db-logo-text">MORA</span>
        </a>
        <div className="db-header-right">
          <a href="/auth/logout" className="db-logout-link">Выйти</a>
          <div className="db-avatar-wrap">
            {avatarUrl
              ? <img src={avatarUrl} alt={firstName} className="db-avatar" />
              : <div className="db-avatar-placeholder">{firstName[0]}</div>
            }
            <span className="db-avatar-chevron">▾</span>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <div className="db-main">

        <h1 className="db-welcome">Добро пожаловать, {firstName}</h1>

        <div className="db-grid">

          {/* LEFT: CARD OF DAY */}
          <div className={`db-panel db-panel--card${!cardDefinition ? ' db-panel--draw' : ''}`}>
            {cardDefinition && cardMeaning && cardId ? (
              <>
                <div className="db-panel-toprow">
                  <span className="db-panel-date">Сегодня {formatTodayDate()}</span>
                  <div className="db-panel-icons">
                    <button className="db-panel-icon-btn" type="button" disabled aria-label="Поделиться">
                      <svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
                        <path d="M176 160a48.07 48.07 0 0 0-33.88 14.09L96.28 145.9a48.14 48.14 0 0 0 0-35.8l45.84-28.19A48 48 0 1 0 128 48a47.47 47.47 0 0 0 2.65 15.49L82.75 91.91a48 48 0 1 0 0 72.18l47.9 28.42A47.47 47.47 0 0 0 128 208a48 48 0 1 0 48-48z"/>
                      </svg>
                    </button>
                    <DashboardCardReader
                      cardId={cardId}
                      title={cardMeaning.title}
                      titleMeta={cardMeaning.titleMeta}
                      tags={cardMeaning.tags}
                      tarotBrief={cardMeaning.tarotBrief}
                      meaningLabel={cardMeaning.meaningLabel}
                      paragraphs={cardMeaning.paragraphs}
                      fullParagraphs={cardMeaning.fullParagraphs}
                      readingDate={formatTodayDate()}
                      sourceKey="today"
                    />
                  </div>
                </div>

                <div className="db-card-section">
                  <h2 className="db-card-section-title">Ваша карта дня</h2>

                  <div className="db-card-row">
                    <DrawnCardTilt cardId={cardId} cardName={cardMeaning.title} sourceKey="today" />

                    <div className="db-card-info">
                      <div className="db-card-info-top">
                        <div className="db-card-badge">{cardMeta?.journalArcana ?? 'Старший аркан'}</div>
                        <h3 className="db-card-title">
                          <span className="db-card-title-name">{cardMeaning.title}</span>
                          {cardMeaning.titleMeta && (
                            <span className="db-card-title-sub"> — {cardMeaning.titleMeta}</span>
                          )}
                        </h3>
                        <div className="db-card-descs">
                          {cardMeaning.tarotBrief.length > 0 && (
                            <div className="db-card-tarot-brief">
                              <span>Карта в таро</span>
                              {cardMeaning.tarotBrief.map((para, i) => (
                                <p key={i}>{para}</p>
                              ))}
                            </div>
                          )}
                          <span className="db-card-meaning-label">{cardMeaning.meaningLabel}</span>
                          {cardMeaning.paragraphs.map((para, i) => (
                            <p key={i} className="db-card-desc">{para}</p>
                          ))}
                        </div>
                      </div>
                      <div className="db-outcome-btns">
                        <button className="db-outcome-btn db-outcome-btn--yes" type="button">
                          <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
                            <path d="M229.66 77.66l-128 128a8 8 0 0 1-11.32 0l-56-56a8 8 0 0 1 11.32-11.32L96 188.69 218.34 66.34a8 8 0 0 1 11.32 11.32Z"/>
                          </svg>
                          Сбылось
                        </button>
                        <button className="db-outcome-btn db-outcome-btn--no" type="button">
                          <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
                            <path d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31l-66.34 66.35a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66a8 8 0 0 1 11.32-11.32L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z"/>
                          </svg>
                          Не сбылось
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <DrawWidget date={`Сегодня ${formatTodayDate()}`} persistDraw={!preview} />
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
