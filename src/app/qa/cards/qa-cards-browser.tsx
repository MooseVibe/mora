'use client'

import { useMemo, useState } from 'react'
import {
  getTarotCardDailyMeaning,
  getTarotCardImageSrc,
  getTarotCardMeta,
  type TarotCardDefinition,
} from '@/lib/tarot'

const FULL_TAROT_DECK_SIZE = 78

type ArcanaFilter = 'all' | 'major' | 'minor'
type SortOrder = 'newest' | 'oldest'

type IndexedCard = TarotCardDefinition & {
  sourceIndex: number
}

function isMajorArcana(card: TarotCardDefinition) {
  return card.result?.tags?.includes('Старший аркан') ?? false
}

export function QACardsBrowser({ cards }: { cards: TarotCardDefinition[] }) {
  const [arcanaFilter, setArcanaFilter] = useState<ArcanaFilter>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')

  const stats = useMemo(() => {
    const majorCount = cards.filter(isMajorArcana).length
    const totalCount = cards.length

    return {
      majorCount,
      minorCount: totalCount - majorCount,
      remainingCount: Math.max(FULL_TAROT_DECK_SIZE - totalCount, 0),
      totalCount,
    }
  }, [cards])

  const visibleCards = useMemo(() => {
    return cards
      .map((card, sourceIndex) => ({ ...card, sourceIndex }))
      .filter(card => {
        if (arcanaFilter === 'major') return isMajorArcana(card)
        if (arcanaFilter === 'minor') return !isMajorArcana(card)
        return true
      })
      .sort((a, b) => {
        if (sortOrder === 'newest') return b.sourceIndex - a.sourceIndex
        return a.sourceIndex - b.sourceIndex
      })
  }, [arcanaFilter, cards, sortOrder])

  return (
    <>
      <section className="qa-cards-toolbar" aria-label="Статистика и фильтры колоды">
        <div className="qa-cards-stats">
          <span className="qa-stat">
            <strong>{stats.totalCount}</strong>
            <span>карт в колоде</span>
          </span>
          <span className="qa-stat">
            <strong>{stats.remainingCount}</strong>
            <span>осталось до 78</span>
          </span>
          <span className="qa-stat">
            <strong>{stats.majorCount}</strong>
            <span>старших</span>
          </span>
          <span className="qa-stat">
            <strong>{stats.minorCount}</strong>
            <span>младших</span>
          </span>
        </div>

        <div className="qa-cards-controls">
          <label className="qa-control">
            <span>Порядок</span>
            <select value={sortOrder} onChange={event => setSortOrder(event.target.value as SortOrder)}>
              <option value="newest">Сначала новые</option>
              <option value="oldest">Сначала старые</option>
            </select>
          </label>

          <label className="qa-control">
            <span>Арканы</span>
            <select value={arcanaFilter} onChange={event => setArcanaFilter(event.target.value as ArcanaFilter)}>
              <option value="all">Все карты</option>
              <option value="major">Только старшие</option>
              <option value="minor">Только младшие</option>
            </select>
          </label>
        </div>
      </section>

      <p className="qa-cards-visible">
        Показано {visibleCards.length} из {stats.totalCount}
      </p>

      <div className="qa-cards-list">
        {visibleCards.map(card => (
          <QACardPreview card={card} key={card.id} />
        ))}
      </div>
    </>
  )
}

function QACardPreview({ card }: { card: IndexedCard }) {
  const meta = getTarotCardMeta(card.id)
  const variants = card.result?.dayVariants?.length ? card.result.dayVariants : [[card.description]]

  return (
    <section className="qa-card">
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
}
