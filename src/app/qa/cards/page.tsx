import { redirect } from 'next/navigation'
import {
  getTarotCardDailyMeaning,
  getTarotCardImageSrc,
  getTarotCardMeta,
  TAROT_CARD_LIST,
} from '@/lib/tarot'
import './qa-cards.css'

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default async function QACardsPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  const qaToken = process.env.CARD_QA_TOKEN

  if (process.env.NODE_ENV === 'production' && (!qaToken || token !== qaToken)) {
    redirect('/')
  }

  return (
    <main className="qa-cards-wrap">
      <header className="qa-cards-header">
        <a href="/" className="qa-cards-logo">
          <span className="qa-cards-logo-icon">✦</span>
          <span>MORA</span>
        </a>
        <div>
          <p className="qa-cards-kicker">QA preview</p>
          <h1 className="qa-cards-title">Карты и тексты</h1>
          <p className="qa-cards-desc">
            Служебный просмотр не вытягивает карту, не пишет в дневник и не меняет состояние пользователя.
          </p>
        </div>
      </header>

      <div className="qa-cards-list">
        {TAROT_CARD_LIST.map(card => {
          const meta = getTarotCardMeta(card.id)
          const variants = card.result?.dayVariants?.length ? card.result.dayVariants : [[card.description]]

          return (
            <section className="qa-card" key={card.id}>
              <div className="qa-card-art-wrap">
                <img
                  src={getTarotCardImageSrc(card.id)}
                  alt={card.name}
                  className="qa-card-art"
                />
              </div>

              <div className="qa-card-content">
                <div className="qa-card-topline">
                  <span className="qa-card-tag">{meta?.journalArcana ?? 'Карта'}</span>
                  <span className="qa-card-id">{card.id}</span>
                </div>
                <h2 className="qa-card-name">{card.name}</h2>
                <p className="qa-card-summary">{card.description}</p>

                <div className="qa-variants">
                  {variants.map((_, variantIdx) => {
                    const meaning = getTarotCardDailyMeaning(card.id, variantIdx)
                    if (!meaning) return null

                    return (
                      <article className="qa-variant" key={variantIdx}>
                        <div className="qa-variant-head">
                          <span className="qa-variant-label">Вариант {variantIdx + 1}</span>
                          <span className="qa-variant-meta">{meaning.titleMeta}</span>
                        </div>
                        <h3 className="qa-variant-title">{meaning.title}</h3>
                        <div className="qa-variant-text">
                          {meaning.paragraphs.map((paragraph, i) => (
                            <p key={i}>{paragraph}</p>
                          ))}
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </main>
  )
}
