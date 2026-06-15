'use client'

import { useMemo, useState } from 'react'
import {
  getTarotCardDailyMeaning,
  getTarotCardImageSrc,
  getTarotCardMeta,
  type TarotCardDefinition,
} from '@/lib/tarot'

const FULL_TAROT_DECK_SIZE = 78
const QA_RECENT_CARD_IDS = [
  'page-of-wands',
  'ace-of-pentacles',
  'ten-of-cups',
  'five-of-cups',
  'eight-of-cups',
  'three-of-pentacles',
  'seven-of-pentacles',
  'four-of-swords',
  'six-of-cups',
  'four-of-wands',
  'two-of-wands',
  'two-of-cups',
  'page-of-cups',
  'ace-of-swords',
  'three-of-cups',
  'two-of-pentacles',
  'six-of-pentacles',
  'four-of-cups',
  'nine-of-swords',
  'ten-of-wands',
  'seven-of-cups',
  'ace-of-wands',
  'queen-of-pentacles',
  'six-of-swords',
  'three-of-wands',
  'eight-of-pentacles',
  'two-of-swords',
  'ace-of-cups',
]

type ArcanaFilter = 'all' | 'major' | 'minor'
type SortOrder = 'newest' | 'oldest'
type TextFilter = 'all' | 'new-format' | 'needs-update'

type IndexedCard = TarotCardDefinition & {
  sourceIndex: number
}

function isMajorArcana(card: TarotCardDefinition) {
  return card.result?.tags?.includes('Старший аркан') ?? false
}

function isPreviewFullVariant(variant: unknown) {
  if (!variant || Array.isArray(variant) || typeof variant !== 'object') return false
  const candidate = variant as { preview?: unknown[]; full?: unknown[] }
  const preview = candidate.preview
  const full = candidate.full
  if (!Array.isArray(preview) || !Array.isArray(full)) return false
  return preview.length > 0 && preview.every((paragraph, index) => paragraph === full[index])
}

function hasNewTextFormat(card: TarotCardDefinition) {
  const variants = card.result?.dayVariants ?? []
  return variants.length > 0 && variants.every(isPreviewFullVariant)
}

function getQaRecencyRank(card: IndexedCard) {
  const explicitRank = QA_RECENT_CARD_IDS.indexOf(card.id)
  return explicitRank >= 0 ? explicitRank : QA_RECENT_CARD_IDS.length + cardsSourceIndexFallback(card)
}

function cardsSourceIndexFallback(card: IndexedCard) {
  return 10000 - card.sourceIndex
}

export function QACardsBrowser({ cards }: { cards: TarotCardDefinition[] }) {
  const [arcanaFilter, setArcanaFilter] = useState<ArcanaFilter>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [textFilter, setTextFilter] = useState<TextFilter>('all')

  const stats = useMemo(() => {
    const majorCount = cards.filter(isMajorArcana).length
    const newFormatCount = cards.filter(hasNewTextFormat).length
    const totalCount = cards.length

    return {
      majorCount,
      minorCount: totalCount - majorCount,
      needsTextUpdateCount: totalCount - newFormatCount,
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
      .filter(card => {
        if (textFilter === 'new-format') return hasNewTextFormat(card)
        if (textFilter === 'needs-update') return !hasNewTextFormat(card)
        return true
      })
      .sort((a, b) => {
        if (sortOrder === 'newest') return getQaRecencyRank(a) - getQaRecencyRank(b)
        return a.sourceIndex - b.sourceIndex
      })
  }, [arcanaFilter, cards, sortOrder, textFilter])

  return (
    <>
      <section className="qa-cards-toolbar" aria-label="Статистика и фильтры колоды">
        <div className="qa-cards-stats">
          <span className="qa-stat">
            <strong>{stats.totalCount}/{FULL_TAROT_DECK_SIZE}</strong>
            <span>добавлено</span>
          </span>
          <span className="qa-stat">
            <strong>{stats.majorCount}</strong>
            <span>старших</span>
          </span>
          <span className="qa-stat">
            <strong>{stats.minorCount}</strong>
            <span>младших</span>
          </span>
          <span className="qa-stat qa-stat--todo">
            <strong>{stats.needsTextUpdateCount}/{stats.totalCount}</strong>
            <span>осталось актуализировать</span>
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

          <label className="qa-control">
            <span>Тексты</span>
            <select value={textFilter} onChange={event => setTextFilter(event.target.value as TextFilter)}>
              <option value="all">Все форматы</option>
              <option value="new-format">Новый формат</option>
              <option value="needs-update">Нужны тексты</option>
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
  const newTextFormat = hasNewTextFormat(card)

  return (
    <section className={`qa-card${newTextFormat ? ' qa-card--new-text' : ' qa-card--old-text'}`}>
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
          <span className={`qa-card-text-status${newTextFormat ? ' qa-card-text-status--ready' : ' qa-card-text-status--todo'}`}>
            {newTextFormat ? 'Новый текст' : 'Старый формат'}
          </span>
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
                  <div className="qa-variant-subtitle">Preview</div>
                  {meaning.paragraphs.map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                  {meaning.fullParagraphs.join('\n') !== meaning.paragraphs.join('\n') && (
                    <details className="qa-variant-full">
                      <summary>Full text</summary>
                      {meaning.fullParagraphs.map((paragraph, i) => (
                        <p key={i}>{paragraph}</p>
                      ))}
                    </details>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
