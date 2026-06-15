'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { getDrawReading, type DrawReadingRow } from '@/lib/draw-reading'
import { getTarotCardImageSrc, getTarotCardMeta } from '@/lib/tarot'
import DashboardCardReader from '@/components/DashboardCardReader'
import RitualTransitionLink from '@/components/RitualTransitionLink'

type JournalPeriod = 'all' | '30' | '7'
type ReturnPreview = 'empty' | 'empty-all' | 'drawn'

type Props = {
  draws: DrawReadingRow[]
  initialPeriod: JournalPeriod
  dashboardHref: string
  returnPreview: ReturnPreview | null
}

const PERIOD_OPTIONS: Array<{ value: JournalPeriod; label: string }> = [
  { value: 'all', label: 'Все время' },
  { value: '30', label: '30 дней' },
  { value: '7', label: '7 дней' },
]

const PAGE_SIZE_OPTIONS = [8, 10, 20]

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

function getPeriodHref(period: JournalPeriod, returnPreview: ReturnPreview | null) {
  const params = new URLSearchParams()
  if (period !== 'all') params.set('period', period)
  if (returnPreview) params.set('returnPreview', returnPreview)
  const query = params.toString()
  return query ? `/journal?${query}` : '/journal'
}

function getTodayKey() {
  return new Date().toISOString().split('T')[0]
}

export default function JournalClient({ draws, initialPeriod, dashboardHref, returnPreview }: Props) {
  const [selectedPeriod, setSelectedPeriod] = useState<JournalPeriod>(initialPeriod)
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const today = getTodayKey()

  const list = useMemo(() => {
    const periodStartDate = getPeriodStartDate(selectedPeriod)
    if (!periodStartDate) return draws
    return draws.filter(draw => draw.drawn_at >= periodStartDate)
  }, [draws, selectedPeriod])

  function selectPeriod(period: JournalPeriod, href: string) {
    setSelectedPeriod(period)
    setPage(1)
    window.history.replaceState(null, '', href)
  }

  const pageCount = Math.ceil(list.length / pageSize)
  const pageItems = list.slice((page - 1) * pageSize, page * pageSize)

  function selectPageSize(value: number) {
    setPageSize(value)
    setPage(1)
  }

  return (
    <>
      <div className="jn-sticky-subhead">
        <div className="jn-back-row">
          <RitualTransitionLink href={dashboardHref} className="jn-back-link" ariaLabel="Вернуться на главную">
            <span className="jn-back-icon" aria-hidden="true" />
            <span>На главную</span>
          </RitualTransitionLink>
        </div>

        <div className="jn-title-row">
          <h1 className="jn-page-title">Дневник карт</h1>
          <div className="jn-filters" aria-label="Период дневника">
            {PERIOD_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                className={`jn-period-chip${selectedPeriod === option.value ? ' jn-period-chip--active' : ''}`}
                aria-pressed={selectedPeriod === option.value}
                onClick={() => selectPeriod(option.value, getPeriodHref(option.value, returnPreview))}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="jn-table-shell">
        {list.length === 0 ? (
          <div className="jn-empty">
            <span className="jn-empty-icon">✦</span>
            <p className="jn-empty-text">
              {draws.length === 0 ? 'Здесь появятся твои карты' : 'За этот период карт нет'}
            </p>
            {draws.length === 0 ? (
              <Link href={dashboardHref} prefetch className="jn-empty-btn">Вытянуть первую карту</Link>
            ) : (
              <button
                type="button"
                className="jn-empty-btn"
                onClick={() => selectPeriod('all', getPeriodHref('all', returnPreview))}
              >
                Смотреть все время
              </button>
            )}
          </div>
        ) : (
          <div className="jn-table" role="table" aria-label="Дневник вытянутых карт">
            <div className="jn-table-head" role="row">
              <span role="columnheader">Карта</span>
              <span role="columnheader">Дата</span>
              <span role="columnheader">Тег</span>
              <span role="columnheader">Отклик</span>
            </div>
            <div className="jn-table-body">
              {pageItems.map((draw, i) => {
                const card = getTarotCardMeta(draw.card_id)
                const reading = getDrawReading(draw)
                if (!card || !reading) return null

                const sourceKey = `journal-${page}-${i}-${draw.drawn_at}-${draw.card_id}`

                return (
                  <DashboardCardReader
                    key={`${draw.drawn_at}-${draw.card_id}-${i}`}
                    cardId={reading.cardId}
                    title={reading.title}
                    titleMeta={reading.titleMeta}
                    tags={reading.tags}
                    tarotBrief={reading.tarotBrief}
                    meaningLabel={reading.meaningLabel}
                    paragraphs={reading.paragraphs}
                    fullParagraphs={reading.fullParagraphs}
                    shareText={draw.drawn_at === today ? reading.shareText : undefined}
                    sourceKey={sourceKey}
                    readingDate={formatDate(reading.drawnAt)}
                    sourceFrame={{ outerRadius: 2, inset: 1, artRadius: 1 }}
                    targetFrame={{ outerRadius: 14, inset: 6, artRadius: 8 }}
                  >
                    {openReader => (
                      <div
                        className="jn-row jn-row--button"
                        role="row"
                        tabIndex={0}
                        aria-label={`Открыть карту ${card.name}`}
                        onClick={openReader}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') return
                          event.preventDefault()
                          openReader()
                        }}
                      >
                        <div className="jn-card-cell" role="cell">
                          <div className="jn-card-open">
                            <img
                              src={getTarotCardImageSrc(draw.card_id)}
                              alt={card.name}
                              className="jn-row-img"
                              data-card-reader-source={sourceKey}
                            />
                            <span className="jn-card-copy">
                              <span className="jn-row-name">{card.name}</span>
                              <span className="jn-row-desc">{reading.titleMeta}</span>
                            </span>
                          </div>
                        </div>
                        <time className="jn-row-date" dateTime={draw.drawn_at} role="cell">{formatDate(draw.drawn_at)}</time>
                        <div className="jn-tags-cell" role="cell">
                          {card.journalArcana.split(' / ').map(tag => (
                            <span className="jn-row-tag" key={tag}>{tag}</span>
                          ))}
                        </div>
                        <div className="jn-outcome-cell" role="cell" aria-label="Отклик пока не отмечен">
                          <span className="jn-outcome-btn" aria-hidden="true">✓</span>
                          <span className="jn-outcome-btn" aria-hidden="true">✕</span>
                        </div>
                      </div>
                    )}
                  </DashboardCardReader>
                )
              })}
            </div>
          </div>
        )}
      </main>

      {list.length > 0 && (
        <div className="jn-table-footer">
          <div className="jn-page-size">
            <span>Показывать</span>
            <div className="jn-page-size-options" aria-label="Количество карт на странице">
              {PAGE_SIZE_OPTIONS.map(option => (
                <button
                  key={option}
                  type="button"
                  className={`jn-page-size-btn${pageSize === option ? ' jn-page-size-btn--active' : ''}`}
                  aria-pressed={pageSize === option}
                  onClick={() => selectPageSize(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {pageCount > 1 && (
            <div className="jn-pagination" aria-label="Страницы дневника">
              <button
                type="button"
                className="jn-pagination-btn"
                disabled={page === 1}
                onClick={() => setPage(current => Math.max(1, current - 1))}
              >
                ‹
              </button>
              <span className="jn-pagination-state">{page} / {pageCount}</span>
              <button
                type="button"
                className="jn-pagination-btn"
                disabled={page === pageCount}
                onClick={() => setPage(current => Math.min(pageCount, current + 1))}
              >
                ›
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
