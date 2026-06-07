'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { getTarotCardImageSrc } from '@/lib/tarot'

type Props = {
  cardId: string
  title: string
  titleMeta: string
  tags: string[]
  meaningLabel: string
  paragraphs: string[]
  sourceKey: string
}

type ReaderState = {
  sourceRect: DOMRect
  target: {
    dx: number
    dy: number
    scale: number
    panelLeft: number
    panelTop: number
    panelWidth: number
  }
  phase: 'placed' | 'opening' | 'open' | 'closing'
}

const CARD_ASPECT_HEIGHT = 477
const CARD_ASPECT_WIDTH = 290
const OPEN_MS = 680
const CLOSE_MS = 460
const DASHBOARD_REVEAL_BEFORE_CLOSE_MS = 210

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
      panelLeft: 24,
      panelTop,
      panelWidth: viewportWidth - 48,
    }
  }

  const gap = 120
  const preferredTextWidth = 520
  const minTextWidth = 380
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
    panelLeft: layoutLeft,
    panelTop: viewportHeight / 2,
    panelWidth: textWidth,
  }
}

export default function DashboardCardReader({
  cardId,
  title,
  titleMeta,
  tags,
  meaningLabel,
  paragraphs,
  sourceKey,
}: Props) {
  const [mounted, setMounted] = useState(false)
  const [reader, setReader] = useState<ReaderState | null>(null)
  const [tiltStyle, setTiltStyle] = useState('')
  const isReaderOpen = reader !== null
  const imageSrc = useMemo(() => getTarotCardImageSrc(cardId), [cardId])

  useEffect(() => {
    setMounted(true)
    return () => {
      document.body.classList.remove('is-dashboard-card-reading')
      document.body.classList.remove('is-dashboard-card-source-hidden')
    }
  }, [])

  useEffect(() => {
    if (!isReaderOpen) return
    document.body.classList.add('is-dashboard-card-source-hidden')
    return () => document.body.classList.remove('is-dashboard-card-source-hidden')
  }, [isReaderOpen])

  useEffect(() => {
    if (!reader) return
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

    const sourceRect = source.getBoundingClientRect()
    const target = getResultLayout(sourceRect)
    setReader({ sourceRect, target, phase: 'placed' })

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
    setTiltStyle('')
    setReader(current => current ? { ...current, phase: 'closing' } : current)
    window.setTimeout(() => setReader(null), CLOSE_MS + 80)
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

  const overlay = reader ? (
    <div className={`db-card-reader db-card-reader--${reader.phase}`} role="dialog" aria-modal="true" aria-label={title}>
      <button
        className="db-card-reader-back"
        type="button"
        onClick={closeReader}
        style={{ '--db-card-reader-panel-left': `${reader.target.panelLeft}px` } as CSSProperties}
      >
        Назад
      </button>

      <section
        className="db-card-reader-panel"
        style={{
          left: `${reader.target.panelLeft}px`,
          top: `${reader.target.panelTop}px`,
          width: `${reader.target.panelWidth}px`,
        }}
      >
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
            <div className="result-reading-section-text">
              {paragraphs.map((paragraph, index) => (
                <p className="result-reading-paragraph" key={index}>{paragraph}</p>
              ))}
            </div>
          </section>
        </div>
      </section>

      <div
        className={`db-card-reader-card${reader.phase === 'open' ? ' db-card-reader-card--interactive' : ''}`}
        onMouseMove={handleCardTilt}
        onMouseLeave={resetCardTilt}
        style={{
          left: `${reader.sourceRect.left}px`,
          top: `${reader.sourceRect.top}px`,
          width: `${reader.sourceRect.width}px`,
          transform: reader.phase === 'closing'
            ? 'translate3d(0, 0, 0) scale(1)'
            : reader.phase === 'placed'
              ? 'translate3d(0, 0, 0) scale(1)'
              : `translate3d(${reader.target.dx}px, ${reader.target.dy}px, 0) scale(${reader.target.scale})`,
          '--db-card-reader-tilt': tiltStyle || 'perspective(900px) rotateY(0deg) rotateX(0deg)',
        } as CSSProperties & Record<'--db-card-reader-tilt', string>}
      >
        <div className="db-card-reader-tilt">
          <img src={imageSrc} alt={title} className="db-card-reader-art" />
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      <button className="db-panel-icon-btn db-panel-icon-btn--active" type="button" onClick={openReader} aria-label="Развернуть карту дня">
        <svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
          <path d="M216 48v56a8 8 0 0 1-16 0V75.31l-58.34 58.35a8 8 0 0 1-11.32-11.32L188.69 64H160a8 8 0 0 1 0-16h56a8 8 0 0 1 8 8ZM98.34 130.34 40 188.69V160a8 8 0 0 0-16 0v56a8 8 0 0 0 8 8h56a8 8 0 0 0 0-16H59.31l58.35-58.34a8 8 0 0 0-11.32-11.32Z"/>
        </svg>
      </button>
      {mounted && overlay ? createPortal(overlay, document.body) : null}
    </>
  )
}
