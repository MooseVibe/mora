'use client'

import DashboardCardReader from '@/components/DashboardCardReader'
import DashboardShareButton from '@/components/DashboardShareButton'
import DrawnCardTilt from '@/components/DrawnCardTilt'

type Props = {
  cardId: string
  title: string
  titleMeta: string
  tags: string[]
  tarotBrief: string[]
  meaningLabel: string
  paragraphs: string[]
  fullParagraphs: string[]
  shareText?: string
  readingDate: string
  journalArcana: string
}

export default function DashboardTodayCard({
  cardId,
  title,
  titleMeta,
  tags,
  tarotBrief,
  meaningLabel,
  paragraphs,
  fullParagraphs,
  shareText,
  readingDate,
  journalArcana,
}: Props) {
  return (
    <DashboardCardReader
      cardId={cardId}
      title={title}
      titleMeta={titleMeta}
      tags={tags}
      tarotBrief={tarotBrief}
      meaningLabel={meaningLabel}
      paragraphs={paragraphs}
      fullParagraphs={fullParagraphs}
      shareText={shareText}
      readingDate={readingDate}
      sourceKey="today"
    >
      {openReader => (
        <>
          <div className="db-panel-toprow">
            <span className="db-panel-date">Сегодня {readingDate}</span>
            <div className="db-panel-icons">
              <DashboardShareButton
                cardId={cardId}
                cardTitle={title}
                shareText={shareText}
              />
              <button className="db-panel-icon-btn db-panel-icon-btn--active" type="button" onClick={openReader} aria-label="Развернуть карту дня">
                <svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
                  <path d="M216 48v56a8 8 0 0 1-16 0V75.31l-58.34 58.35a8 8 0 0 1-11.32-11.32L188.69 64H160a8 8 0 0 1 0-16h56a8 8 0 0 1 8 8ZM98.34 130.34 40 188.69V160a8 8 0 0 0-16 0v56a8 8 0 0 0 8 8h56a8 8 0 0 0 0-16H59.31l58.35-58.34a8 8 0 0 0-11.32-11.32Z"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="db-card-section">
            <h2 className="db-card-section-title">Ваша карта дня</h2>

            <div className="db-card-row">
              <DrawnCardTilt cardId={cardId} cardName={title} sourceKey="today" onOpen={openReader} />

              <div className="db-card-info">
                <div className="db-card-info-top">
                  <div className="db-card-badge">{journalArcana}</div>
                  <h3 className="db-card-title">
                    <span className="db-card-title-name">{title}</span>
                    {titleMeta && (
                      <span className="db-card-title-sub"> — {titleMeta}</span>
                    )}
                  </h3>
                  <div className="db-card-descs">
                    {tarotBrief.length > 0 && (
                      <div className="db-card-tarot-brief">
                        <span>Карта в таро</span>
                        {tarotBrief.map((para, i) => (
                          <p key={i}>{para}</p>
                        ))}
                      </div>
                    )}
                    <span className="db-card-meaning-label">{meaningLabel}</span>
                    {paragraphs.map((para, i) => (
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
      )}
    </DashboardCardReader>
  )
}
