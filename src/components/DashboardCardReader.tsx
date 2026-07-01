'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { getTarotCardImageSrc } from '@/lib/tarot'
import DashboardShareButton from '@/components/DashboardShareButton'

type Props = {
  cardId: string
  title: string
  titleMeta: string
  tags: string[]
  tarotBrief?: string[]
  meaningLabel: string
  paragraphs: string[]
  fullParagraphs?: string[]
  shareText?: string
  sourceKey: string
  readingDate?: string
  sourceFrame?: CardFrame
  targetFrame?: CardFrame
  selectedResponse?: ReaderResponse | null
  responseText?: string
  onResponseSelect?: (response: ReaderResponse) => void
  children?: (openReader: () => void) => ReactNode
}

type CardFrame = {
  outerRadius: number
  inset: number
  artRadius: number
}

type ReaderResponse = 'accept' | 'reject'

type ReaderState = {
  sourceRect: DOMRect
    target: {
      dx: number
      dy: number
      scale: number
      cardLeft: number
      cardTop: number
      cardWidth: number
      cardHeight: number
      panelLeft: number
      panelTop: number
      panelWidth: number
      panelHeight: number
    }
  frame: {
    start: CardFrame
    end: CardFrame
  }
  sourceScale: number
  phase: 'placed' | 'opening' | 'open' | 'closing' | 'handoff'
}

const CARD_ASPECT_HEIGHT = 477
const CARD_ASPECT_WIDTH = 290
const CANONICAL_CARD_FRAME: CardFrame = {
  outerRadius: 14,
  inset: 6,
  artRadius: 8,
}
const DETAIL_CARD_FRAME: CardFrame = {
  outerRadius: 20,
  inset: 11,
  artRadius: 9,
}
const OPEN_MS = 680
const CLOSE_MS = 460
const HANDOFF_MS = 90
const DASHBOARD_REVEAL_BEFORE_CLOSE_MS = 210
const MEANING_PREVIEW_MAX_HEIGHT = 130

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getResultLayout(sourceRect: DOMRect) {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const isMobile = viewportWidth < 700

  const targetWidth = isMobile
    ? Math.min(viewportWidth - 56, 280)
    : Math.min(376, viewportWidth * 0.34)
  const targetHeight = targetWidth * CARD_ASPECT_HEIGHT / CARD_ASPECT_WIDTH

  if (isMobile) {
    const targetLeft = (viewportWidth - targetWidth) / 2
    const targetTop = Math.max(24, viewportHeight * 0.08)
    const panelTop = targetTop + targetHeight + 20
    return {
      dx: targetLeft - sourceRect.left,
      dy: targetTop - sourceRect.top,
      scale: targetWidth / sourceRect.width,
      cardLeft: targetLeft,
      cardTop: targetTop,
      cardWidth: targetWidth,
      cardHeight: targetHeight,
      panelLeft: 24,
      panelTop,
      panelWidth: viewportWidth - 48,
      panelHeight: Math.max(0, viewportHeight - panelTop - 24),
    }
  }

  const gap = 85
  const preferredTextWidth = 579
  const minTextWidth = 420
  const minOuterPad = 72
  const availableTextWidth = viewportWidth - minOuterPad * 2 - gap - targetWidth
  const textWidth = clamp(availableTextWidth, minTextWidth, preferredTextWidth)
  const layoutWidth = textWidth + gap + targetWidth
  const layoutLeft = Math.max(minOuterPad, (viewportWidth - layoutWidth) / 2)
  const targetLeft = Math.max(layoutLeft, layoutLeft + textWidth + gap)
  const targetTop = (viewportHeight - targetHeight) / 2

  return {
    dx: targetLeft - sourceRect.left,
    dy: targetTop - sourceRect.top,
    scale: targetWidth / sourceRect.width,
    cardLeft: targetLeft,
    cardTop: targetTop,
    cardWidth: targetWidth,
    cardHeight: targetHeight,
    panelLeft: layoutLeft,
    panelTop: targetTop,
    panelWidth: textWidth,
    panelHeight: targetHeight,
  }
}

function resetSourceTransform(source: HTMLElement) {
  source.style.transition = 'none'
  source.style.transform = ''
  void source.offsetWidth
  source.style.transition = ''
}

function fadeSourceClone(source: HTMLElement) {
  const rect = source.getBoundingClientRect()
  const clone = source.cloneNode(true) as HTMLElement

  clone.removeAttribute('data-card-reader-source')
  clone.removeAttribute('data-card-reader-active')
  clone.setAttribute('aria-hidden', 'true')
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: '0',
    opacity: '1',
    pointerEvents: 'none',
    transform: 'none',
    transition: `opacity ${HANDOFF_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)`,
    zIndex: '69',
  })

  document.body.appendChild(clone)

  requestAnimationFrame(() => {
    clone.style.opacity = '0'
  })

  window.setTimeout(() => {
    clone.remove()
  }, HANDOFF_MS + 40)
}

export default function DashboardCardReader({
  cardId,
  title,
  titleMeta,
  tags,
  meaningLabel,
  paragraphs,
  fullParagraphs,
  shareText,
  sourceKey,
  readingDate,
  sourceFrame,
  targetFrame,
  selectedResponse,
  responseText: selectedResponseText,
  onResponseSelect,
  children,
}: Props) {
  const [mounted, setMounted] = useState(false)
  const [reader, setReader] = useState<ReaderState | null>(null)
  const [tiltStyle, setTiltStyle] = useState('')
  const [isFullMeaningOpen, setIsFullMeaningOpen] = useState(false)
  const [isMeaningOverflowing, setIsMeaningOverflowing] = useState(false)
  const [localResponse, setLocalResponse] = useState<ReaderResponse | null>(null)
  const meaningTextRef = useRef<HTMLDivElement | null>(null)
  const isReaderOpen = reader !== null
  const response = selectedResponse ?? localResponse
  const imageSrc = useMemo(() => getTarotCardImageSrc(cardId), [cardId])
  const fullMeaning = fullParagraphs?.length ? fullParagraphs : paragraphs
  const hasFullMeaning = fullMeaning.join('\n') !== paragraphs.join('\n')
  const shouldShowReadMore = hasFullMeaning || isMeaningOverflowing
  const responseText = selectedResponseText || (
    response === 'accept'
      ? 'Отклик сохранён. Эта карта останется в дневнике как принятая.'
      : response === 'reject'
        ? 'Отклик сохранён. Иногда карта говорит не сразу.'
        : ''
  )

  useEffect(() => {
    setMounted(true)
    return () => {
      document.body.classList.remove('is-dashboard-card-reading')
      document.body.classList.remove('is-dashboard-card-source-hidden')
      document
        .querySelectorAll('[data-card-reader-active="true"]')
        .forEach(source => source.removeAttribute('data-card-reader-active'))
    }
  }, [])

  useEffect(() => {
    const image = new Image()
    image.decoding = 'async'
    image.src = imageSrc
    if (image.decode) void image.decode().catch(() => {})
  }, [imageSrc])

  useEffect(() => {
    if (!isReaderOpen) return
    document.body.classList.add('is-dashboard-card-source-hidden')
    return () => document.body.classList.remove('is-dashboard-card-source-hidden')
  }, [isReaderOpen])

  useEffect(() => {
    if (reader?.phase !== 'open') return undefined
    const text = meaningTextRef.current
    if (!text) return undefined

    const measure = () => {
      setIsMeaningOverflowing(text.scrollHeight > MEANING_PREVIEW_MAX_HEIGHT)
    }

    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [reader?.phase, paragraphs, title])

  useEffect(() => {
    if (!reader || reader.phase === 'handoff') {
      document.body.classList.remove('is-dashboard-card-reading')
      return undefined
    }

    document.body.classList.add('is-dashboard-card-reading')
    if (reader.phase === 'closing') {
      const timer = window.setTimeout(() => {
        document.body.classList.remove('is-dashboard-card-reading')
      }, Math.max(0, CLOSE_MS - DASHBOARD_REVEAL_BEFORE_CLOSE_MS))
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [reader])

  function openReader() {
    const source = document.querySelector(`[data-card-reader-source="${sourceKey}"]`)
    if (!(source instanceof HTMLElement)) return

    resetSourceTransform(source)
    source.dataset.cardReaderActive = 'true'
    const sourceRect = source.getBoundingClientRect()
    const target = getResultLayout(sourceRect)
    setReader({
      sourceRect,
      target,
      frame: {
        start: sourceFrame ?? CANONICAL_CARD_FRAME,
        end: targetFrame ?? DETAIL_CARD_FRAME,
      },
      sourceScale: sourceRect.width / target.cardWidth,
      phase: 'placed',
    })

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setReader(current => current ? { ...current, phase: 'opening' } : current)
        window.setTimeout(() => {
          setReader(current => current ? { ...current, phase: 'open' } : current)
        }, OPEN_MS)
      })
    })
  }

  function closeReader() {
    setIsFullMeaningOpen(false)
    setIsMeaningOverflowing(false)
    setLocalResponse(null)
    setTiltStyle('')
    setReader(current => current ? { ...current, phase: 'closing' } : current)
    window.setTimeout(() => {
      setReader(current => current ? { ...current, phase: 'handoff' } : current)

      requestAnimationFrame(() => {
        const source = document.querySelector(`[data-card-reader-source="${sourceKey}"]`)
        if (source instanceof HTMLElement) {
          resetSourceTransform(source)
          fadeSourceClone(source)
          source.removeAttribute('data-card-reader-active')
        }
      })
    }, CLOSE_MS)
    window.setTimeout(() => setReader(null), CLOSE_MS + HANDOFF_MS)
  }

  function handleCardTilt(event: MouseEvent<HTMLDivElement>) {
    if (reader?.phase !== 'open') return
    const rect = event.currentTarget.getBoundingClientRect()
    const dx = (event.clientX - rect.left - rect.width / 2) / (rect.width / 2)
    const dy = (event.clientY - rect.top - rect.height / 2) / (rect.height / 2)
    setTiltStyle(`perspective(900px) rotateY(${dx * 7}deg) rotateX(${-dy * 7}deg)`)
  }

  function resetCardTilt() {
    setTiltStyle('')
  }

  function handleCardClick() {
    if (reader?.phase !== 'open') return
    closeReader()
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (reader?.phase !== 'open') return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    closeReader()
  }

  function saveResponse(nextResponse: ReaderResponse) {
    if (response) return
    if (onResponseSelect) {
      onResponseSelect(nextResponse)
    } else {
      setLocalResponse(nextResponse)
    }
  }

  const overlay = reader ? (
    <div className={`db-card-reader db-card-reader--${reader.phase}`} role="dialog" aria-modal="true" aria-label={title}>
      <section
        className="db-card-reader-panel"
        style={{
          left: `${reader.target.panelLeft}px`,
          top: `${reader.target.panelTop}px`,
          width: `${reader.target.panelWidth}px`,
          height: `${reader.target.panelHeight}px`,
        }}
      >
        <button className="db-card-reader-back" type="button" onClick={closeReader}>
          На главную
        </button>

        <div className="db-card-reader-content">
          {readingDate && <p className="db-card-reader-date">{readingDate}</p>}
          <div className="result-reading-tags" aria-label="Теги карты">
            {tags.map(tag => (
              <span className="result-reading-tag" key={tag}>{tag}</span>
            ))}
          </div>
          <h2 className="result-reading-title">
            <span className="result-reading-title-name">{title}</span>
            {titleMeta && <span className="result-reading-title-meta"> — {titleMeta}</span>}
          </h2>
          <div className="result-reading-sections">
            <section className="result-reading-section">
              <h3 className="result-reading-section-title">{meaningLabel}</h3>
              <div
                className={`result-reading-section-text${shouldShowReadMore ? ' result-reading-section-text--clamped' : ''}`}
                ref={meaningTextRef}
              >
                {paragraphs.map((paragraph, index) => (
                  <p className="result-reading-paragraph" key={index}>
                    {paragraph}
                  </p>
                ))}
              </div>
              {shouldShowReadMore && (
                <button
                  className="result-reading-inline-more"
                  type="button"
                  onClick={() => setIsFullMeaningOpen(true)}
                >
                  Читать дальше
                </button>
              )}
            </section>
          </div>
          <div className="db-card-reader-response" aria-live="polite">
            {responseText ? (
              <p className="db-card-reader-response-text">{responseText}</p>
            ) : (
              <div className="db-card-reader-response-actions">
                <button
                  className="db-card-reader-response-btn db-card-reader-response-btn--reject"
                  type="button"
                  onClick={() => saveResponse('reject')}
                >
                  <span className="db-card-reader-response-icon db-card-reader-response-icon--x" aria-hidden="true" />
                  Не принимаю
                </button>
                <button
                  className="db-card-reader-response-btn db-card-reader-response-btn--accept"
                  type="button"
                  onClick={() => saveResponse('accept')}
                >
                  <span className="db-card-reader-response-icon db-card-reader-response-icon--check" aria-hidden="true" />
                  Принимаю
                </button>
              </div>
            )}
          </div>
          {shareText && (
            <div className="result-card-actions db-card-reader-actions">
              <DashboardShareButton
                cardId={cardId}
                cardTitle={title}
                shareText={shareText}
                variant="action"
              />
            </div>
          )}
        </div>
      </section>

      {isFullMeaningOpen && (
        <div className="db-card-reader-modal" role="dialog" aria-modal="true" aria-label={meaningLabel}>
          <button
            className="db-card-reader-modal-backdrop"
            type="button"
            aria-label="Закрыть полный текст"
            onClick={() => setIsFullMeaningOpen(false)}
          />
          <section className="db-card-reader-modal-panel">
            <button
              className="db-card-reader-modal-close"
              type="button"
              aria-label="Закрыть полный текст"
              onClick={() => setIsFullMeaningOpen(false)}
            >
              ×
            </button>
            <h2 className="db-card-reader-modal-title">{meaningLabel}</h2>
            <div className="db-card-reader-modal-text">
              {fullMeaning.map((paragraph, index) => (
                <Fragment key={index}>
                  {index === paragraphs.length && (
                    <div className="result-reading-modal-separator">Продолжение</div>
                  )}
                  <p className={`result-reading-modal-paragraph ${index < paragraphs.length ? 'result-reading-modal-paragraph--preview' : 'result-reading-modal-paragraph--new'}`}>
                    {paragraph}
                  </p>
                </Fragment>
              ))}
            </div>
          </section>
        </div>
      )}

      <div
        className={`db-card-reader-card${reader.phase === 'open' ? ' db-card-reader-card--interactive' : ''}`}
        role={reader.phase === 'open' ? 'button' : undefined}
        tabIndex={reader.phase === 'open' ? 0 : undefined}
        aria-label={reader.phase === 'open' ? 'Вернуть карту назад' : undefined}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        onMouseMove={handleCardTilt}
        onMouseLeave={resetCardTilt}
        style={{
          left: `${reader.target.cardLeft}px`,
          top: `${reader.target.cardTop}px`,
          width: `${reader.target.cardWidth}px`,
          transform: reader.phase === 'closing' || reader.phase === 'handoff'
            ? `translate3d(${reader.sourceRect.left - reader.target.cardLeft}px, ${reader.sourceRect.top - reader.target.cardTop}px, 0) scale(${reader.sourceRect.width / reader.target.cardWidth})`
            : reader.phase === 'placed'
              ? `translate3d(${reader.sourceRect.left - reader.target.cardLeft}px, ${reader.sourceRect.top - reader.target.cardTop}px, 0) scale(${reader.sourceRect.width / reader.target.cardWidth})`
              : reader.phase === 'open'
                ? 'translate3d(0, 0, 0) scale(1)'
                : 'translate3d(0, 0, 0) scale(1)',
          '--db-card-reader-tilt': tiltStyle || 'perspective(900px) rotateY(0deg) rotateX(0deg)',
          '--db-card-reader-outer-radius': `${reader.frame.end.outerRadius}px`,
          '--db-card-reader-frame-inset': `${reader.frame.end.inset}px`,
          '--db-card-reader-art-radius': `${reader.frame.end.artRadius}px`,
          '--db-card-reader-source-border-width': `${1 / reader.sourceScale}px`,
          '--db-card-reader-source-inner-border-width': `${1 / reader.sourceScale}px`,
          '--db-card-reader-source-shadow-y': `${12 / reader.sourceScale}px`,
          '--db-card-reader-source-shadow-blur': `${28 / reader.sourceScale}px`,
        } as CSSProperties & Record<'--db-card-reader-tilt' | '--db-card-reader-outer-radius' | '--db-card-reader-frame-inset' | '--db-card-reader-art-radius' | '--db-card-reader-source-border-width' | '--db-card-reader-source-inner-border-width' | '--db-card-reader-source-shadow-y' | '--db-card-reader-source-shadow-blur', string>}
      >
        <div className="db-card-reader-tilt">
          <img src={imageSrc} alt={title} className="db-card-reader-art" />
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      {children ? children(openReader) : (
        <button className="db-panel-icon-btn db-panel-icon-btn--active" type="button" onClick={openReader} aria-label="Развернуть карту дня">
          <svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
            <path d="M216 48v56a8 8 0 0 1-16 0V75.31l-58.34 58.35a8 8 0 0 1-11.32-11.32L188.69 64H160a8 8 0 0 1 0-16h56a8 8 0 0 1 8 8ZM98.34 130.34 40 188.69V160a8 8 0 0 0-16 0v56a8 8 0 0 0 8 8h56a8 8 0 0 0 0-16H59.31l58.35-58.34a8 8 0 0 0-11.32-11.32Z"/>
          </svg>
        </button>
      )}
      {mounted && overlay ? createPortal(overlay, document.body) : null}
    </>
  )
}
