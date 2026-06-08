'use client'

import React from 'react'
import { getDrawReading, type DrawReadingRow } from '@/lib/draw-reading'
import { getTarotCardImageSrc, getTarotCardMeta } from '@/lib/tarot'
import DashboardCardReader from '@/components/DashboardCardReader'
import RitualTransitionLink from '@/components/RitualTransitionLink'

function formatDate(dateStr: string): string {
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (dateStr === today) return 'сегодня'
  if (dateStr === yesterday) return 'вчера'
  const d = new Date(dateStr + 'T12:00:00')
  const base = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '')
  return d.getFullYear() !== new Date().getFullYear() ? `${base} ${d.getFullYear()}` : base
}

function CardTile({ draw, index }: { draw: DrawReadingRow; index: number }) {
  const reading = getDrawReading(draw)
  const card = getTarotCardMeta(draw.card_id)
  const sourceKey = `recent-${index}-${draw.drawn_at}-${draw.card_id}`
  if (!reading || !card) return null

  function handleTilt(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const dx = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2)
    const dy = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2)
    e.currentTarget.style.transition = 'transform 0.08s ease'
    e.currentTarget.style.transform = `perspective(600px) rotateY(${dx * 10}deg) rotateX(${-dy * 10}deg)`
  }

  function handleTiltEnd(e: React.MouseEvent<HTMLDivElement>) {
    e.currentTarget.style.transition = 'transform 0.42s cubic-bezier(0.22, 0.61, 0.36, 1)'
    e.currentTarget.style.transform = ''
  }

  return (
    <DashboardCardReader
      cardId={reading.cardId}
      title={reading.title}
      titleMeta={reading.titleMeta}
      tags={reading.tags}
      meaningLabel={reading.meaningLabel}
      paragraphs={reading.paragraphs}
      sourceKey={sourceKey}
      readingDate={formatDate(reading.drawnAt)}
      sourceFrame={{ outerRadius: 8, inset: 3.35, artRadius: 4.5 }}
    >
      {openReader => (
        <button className="rcw-card rcw-card--button" type="button" onClick={openReader} aria-label={`Открыть карту ${card.name}`}>
          <div
            className="rcw-thumb"
            data-card-reader-source={sourceKey}
            onMouseMove={handleTilt}
            onMouseLeave={handleTiltEnd}
          >
            <img
              src={getTarotCardImageSrc(reading.cardId)}
              alt={card.name}
              className="rcw-thumb-img"
            />
          </div>
          <div className="rcw-meta">
            <span className="rcw-name">{card.name}</span>
            <span className="rcw-date">{formatDate(reading.drawnAt)}</span>
          </div>
        </button>
      )}
    </DashboardCardReader>
  )
}

function EmptyTile() {
  return (
    <div className="rcw-card rcw-card--empty">
      <div className="rcw-thumb rcw-thumb--empty">
        <span className="rcw-empty-icon">✦</span>
      </div>
      <div className="rcw-meta">
        <span className="rcw-name rcw-name--dim">Ещё нет</span>
      </div>
    </div>
  )
}

interface Props {
  draws: DrawReadingRow[] | null
  journalHref?: string
}

export default function RecentCardsWidget({ draws, journalHref = '/journal' }: Props) {
  const filled = draws ?? []
  const slots = [0, 1, 2]

  return (
    <div className="db-panel rcw-widget">
      <div className="rcw-head">
        <span className="rcw-title">Дневник карт</span>
        <RitualTransitionLink href={journalHref} className="rcw-link">смотреть все →</RitualTransitionLink>
      </div>
      <div className="rcw-grid">
        {slots.map(i =>
          filled[i]
            ? <CardTile key={i} draw={filled[i]} index={i} />
            : <EmptyTile key={i} />
        )}
      </div>
      {filled.length === 0 && (
        <p className="rcw-empty-hint">Вытягивай карту каждый день — здесь появится твой путь</p>
      )}
    </div>
  )
}
