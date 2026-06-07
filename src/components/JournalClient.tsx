'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { getTarotCardImageSrc, getTarotCardJournalSummary, getTarotCardMeta } from '@/lib/tarot'
import RitualTransitionLink from '@/components/RitualTransitionLink'

type JournalPeriod = 'all' | '30' | '7'

type Draw = {
  card_id: string
  drawn_at: string
}

type Props = {
  draws: Draw[]
  initialPeriod: JournalPeriod
}

const PERIOD_OPTIONS: Array<{ value: JournalPeriod; label: string; href: string }> = [
  { value: 'all', label: 'Все время', href: '/journal' },
  { value: '30', label: '30 дней', href: '/journal?period=30' },
  { value: '7', label: '7 дней', href: '/journal?period=7' },
]

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function getPeriodStartDate(period: JournalPeriod): string | null {
  if (period === 'all') return null

  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - (Number(period) - 1))

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

export default function JournalClient({ draws, initialPeriod }: Props) {
  const [selectedPeriod, setSelectedPeriod] = useState<JournalPeriod>(initialPeriod)

  const list = useMemo(() => {
    const periodStartDate = getPeriodStartDate(selectedPeriod)
    if (!periodStartDate) return draws
    return draws.filter(draw => draw.drawn_at >= periodStartDate)
  }, [draws, selectedPeriod])

  function selectPeriod(period: JournalPeriod, href: string) {
    setSelectedPeriod(period)
    window.history.replaceState(null, '', href)
  }

  return (
    <>
      <div className="jn-sticky-subhead">
        <div className="jn-title-block">
          <RitualTransitionLink href="/dashboard" className="jn-back-link" ariaLabel="Вернуться на дашборд">‹</RitualTransitionLink>
          <h1 className="jn-page-title">Дневник карт</h1>
        </div>

        <div className="jn-filters">
          {PERIOD_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              className={`jn-period-chip${selectedPeriod === option.value ? ' jn-period-chip--active' : ''}`}
              aria-current={selectedPeriod === option.value ? 'page' : undefined}
              onClick={() => selectPeriod(option.value, option.href)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="jn-list">
        {list.length === 0 ? (
          <div className="jn-empty">
            <span className="jn-empty-icon">✦</span>
            <p className="jn-empty-text">Здесь появятся твои карты</p>
            <Link href="/" prefetch className="jn-empty-btn">Вытянуть первую карту</Link>
          </div>
        ) : (
          list.map((draw, i) => {
            const card = getTarotCardMeta(draw.card_id)
            if (!card) return null

            return (
              <div className="jn-row" key={`${draw.drawn_at}-${draw.card_id}-${i}`}>
                <div className="jn-row-img-wrap">
                  <img
                    src={getTarotCardImageSrc(draw.card_id)}
                    alt={card.name}
                    className="jn-row-img"
                  />
                  <div className="jn-row-img-caption">
                    {card.name}<br />{card.num}
                  </div>
                </div>

                <div className="jn-row-content">
                  <span className="jn-row-date">{formatDate(draw.drawn_at)}</span>
                  <h2 className="jn-row-name">{card.name}</h2>
                  <p className="jn-row-desc">{getTarotCardJournalSummary(draw.card_id)}</p>
                  <span className="jn-row-tag">{card.journalArcana}</span>
                </div>

                <div className="jn-row-actions">
                  <button className="jn-action-btn jn-action-btn--yes" type="button">
                    <span>✓</span> Сбылось
                  </button>
                  <button className="jn-action-btn jn-action-btn--no" type="button">
                    <span>✕</span> Не сбылось
                  </button>
                  <button className="jn-action-btn jn-action-btn--note" type="button">
                    <span>✎</span> Мои заметки
                  </button>
                  <span className="jn-row-arrow">›</span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {list.length > 0 && (
        <div className="jn-footer-hint">
          <span>✦</span>
          <span>Твои карты сохраняются в твоём дневнике</span>
          <span>?</span>
        </div>
      )}
    </>
  )
}
