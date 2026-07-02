'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import DashboardTodayCard from '@/components/DashboardTodayCard'
import { getTarotCardDailyMeaning, getTarotCardMeta } from '@/lib/tarot'

function getMoonPhase(): string {
  const knownNewMoon = new Date('2024-01-11').getTime()
  const daysSince = (Date.now() - knownNewMoon) / 86400000
  const phase = ((daysSince % 29.53059) + 29.53059) % 29.53059
  if (phase < 1.85)  return 'Новолуние'
  if (phase < 7.38)  return 'Растущий серп'
  if (phase < 11.07) return 'Первая четверть'
  if (phase < 14.77) return 'Растущая луна'
  if (phase < 18.46) return 'Полнолуние'
  if (phase < 22.15) return 'Убывающая луна'
  if (phase < 25.84) return 'Последняя четверть'
  return 'Убывающий серп'
}

const DRAW_PROMPTS = [
  'Мора приготовила тебе карту. Она расскажет, чего ждать от сегодняшнего дня — предостережёт, поддержит или укажет путь. Но только пока день не закончился',
  'Каждый день приходит со своей картой. Иногда она предупреждает. Иногда поддерживает. Всегда говорит то, что нужно именно сегодня',
  'Твоя карта уже выбрана. Она знает, что ждёт тебя сегодня. Вытяни её — пока этот день ещё твой',
]

type MoraNativeWindow = Window & {
  __moraDrawAuthed?: boolean
  __moraDrawPreview?: boolean
  __moraDrawShareQa?: boolean
  __moraUseReactResult?: boolean
  __moraHandoffDiagnostics?: unknown
  __moraHandoffFinalDiagnostics?: unknown
  __moraNativeApp?: {
    init?: () => void
    cleanup?: () => void
  }
}

type FreshDraw = {
  cardId: string
  drawnAt: string
  variantIdx: number
  targetRect?: TargetRect | null
  nativeMetrics?: unknown
}

type TargetRect = {
  left: number
  top: number
  width: number
  height: number
}

const NATIVE_APP_VERSION = '20260702-17'

function isHandoffDebugEnabled() {
  try {
    return new URLSearchParams(window.location.search).get('handoffDebug') === '1'
      || window.localStorage.getItem('mora:handoffDebug') === '1'
  } catch {
    return false
  }
}

function roundMetric(value: number) {
  return Math.round(value * 1000) / 1000
}

function readPx(value: string) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function rectMetrics(rect: DOMRect) {
  return {
    left: roundMetric(rect.left),
    top: roundMetric(rect.top),
    width: roundMetric(rect.width),
    height: roundMetric(rect.height),
  }
}

function collectCardMetrics(source: string, cardSelector: string, artSelector: string, frameSelector: string) {
  const card = document.querySelector(cardSelector)
  const art = document.querySelector(artSelector)
  const frame = document.querySelector(frameSelector)
  if (!(card instanceof HTMLElement) || !(art instanceof HTMLElement) || !(frame instanceof HTMLElement)) return null

  const cardRect = card.getBoundingClientRect()
  const artRect = art.getBoundingClientRect()
  const cardStyle = getComputedStyle(card)
  const artStyle = getComputedStyle(art)
  const frameStyle = getComputedStyle(frame)
  const beforeStyle = getComputedStyle(frame, '::before')
  const scale = card.offsetWidth ? cardRect.width / card.offsetWidth : 1

  return {
    source,
    card: rectMetrics(cardRect),
    art: rectMetrics(artRect),
    visualScale: roundMetric(scale),
    visualOuterRadius: roundMetric(readPx(cardStyle.borderTopLeftRadius) * scale),
    visualArtRadius: roundMetric(readPx(artStyle.borderTopLeftRadius) * scale),
    visualArtInsetLeft: roundMetric(artRect.left - cardRect.left),
    visualArtInsetTop: roundMetric(artRect.top - cardRect.top),
    css: {
      cardRadius: cardStyle.borderTopLeftRadius,
      artRadius: artStyle.borderTopLeftRadius,
      borderWidth: frameStyle.borderTopWidth,
      innerBorderWidth: beforeStyle.borderTopWidth,
      shadow: frameStyle.boxShadow || cardStyle.boxShadow,
      transform: cardStyle.transform,
    },
  }
}

function diffCardMetrics(nativeMetrics: ReturnType<typeof collectCardMetrics>, reactMetrics: ReturnType<typeof collectCardMetrics>) {
  if (!nativeMetrics || !reactMetrics) return null
  return {
    cardLeft: roundMetric(reactMetrics.card.left - nativeMetrics.card.left),
    cardTop: roundMetric(reactMetrics.card.top - nativeMetrics.card.top),
    cardWidth: roundMetric(reactMetrics.card.width - nativeMetrics.card.width),
    cardHeight: roundMetric(reactMetrics.card.height - nativeMetrics.card.height),
    artLeft: roundMetric(reactMetrics.art.left - nativeMetrics.art.left),
    artTop: roundMetric(reactMetrics.art.top - nativeMetrics.art.top),
    artWidth: roundMetric(reactMetrics.art.width - nativeMetrics.art.width),
    artHeight: roundMetric(reactMetrics.art.height - nativeMetrics.art.height),
    outerRadius: roundMetric(reactMetrics.visualOuterRadius - nativeMetrics.visualOuterRadius),
    artRadius: roundMetric(reactMetrics.visualArtRadius - nativeMetrics.visualArtRadius),
    artInsetLeft: roundMetric(reactMetrics.visualArtInsetLeft - nativeMetrics.visualArtInsetLeft),
    artInsetTop: roundMetric(reactMetrics.visualArtInsetTop - nativeMetrics.visualArtInsetTop),
  }
}

function collectFinalHandoffDiagnostics() {
  if (!isHandoffDebugEnabled()) return

  const nativeFinal = collectCardMetrics('native-final', '#revealCard', '#rcArt', '#rcFront')
  const react = collectCardMetrics('react-at-native-final', '.db-card-reader-card', '.db-card-reader-art', '.db-card-reader-tilt')
  const diff = diffCardMetrics(nativeFinal, react)
  const diagnostics = { nativeFinal, react, diff }
  const diagnosticWindow = window as MoraNativeWindow
  diagnosticWindow.__moraHandoffFinalDiagnostics = diagnostics
  diagnosticWindow.__moraHandoffDiagnostics = {
    ...(diagnosticWindow.__moraHandoffDiagnostics && typeof diagnosticWindow.__moraHandoffDiagnostics === 'object'
      ? diagnosticWindow.__moraHandoffDiagnostics
      : {}),
    final: diagnostics,
  }

  console.groupCollapsed('[Mora handoff final diagnostics]')
  console.log('nativeFinal', nativeFinal)
  console.log('react', react)
  if (diff) console.table(diff)
  console.groupEnd()
}

function normalizeTargetRect(value: unknown): TargetRect | null {
  if (!value || typeof value !== 'object') return null
  const rect = value as Partial<TargetRect>
  if (
    typeof rect.left !== 'number' ||
    typeof rect.top !== 'number' ||
    typeof rect.width !== 'number' ||
    typeof rect.height !== 'number'
  ) {
    return null
  }
  if (![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)) return null
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  }
}

function getTimeUntilMidnight(): string {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  const diff = midnight.getTime() - now.getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function DrawWidget({
  date,
  persistDraw = true,
  shareQa = false,
  returnHref = '/dashboard',
}: {
  date: string
  persistDraw?: boolean
  shareQa?: boolean
  returnHref?: string
}) {
  const [mounted, setMounted] = useState(false)
  const [prompt, setPrompt] = useState(DRAW_PROMPTS[0])
  const [countdown, setCountdown] = useState('00:00:00')
  const [freshDraw, setFreshDraw] = useState<FreshDraw | null>(null)
  const [keepNativeLayer, setKeepNativeLayer] = useState(false)

  useEffect(() => {
    setPrompt(DRAW_PROMPTS[Math.floor(Math.random() * DRAW_PROMPTS.length)])
    setCountdown(getTimeUntilMidnight())
    setMounted(true)

    const timer = setInterval(() => setCountdown(getTimeUntilMidnight()), 1000)

    return () => {
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!mounted) return

    const nativeWindow = window as MoraNativeWindow
    nativeWindow.__moraDrawAuthed = true
    nativeWindow.__moraDrawPreview = !persistDraw
    nativeWindow.__moraDrawShareQa = shareQa
    nativeWindow.__moraUseReactResult = true
    const timers = new Set<number>()

    function setManagedTimeout(callback: () => void, delay: number) {
      const timer = window.setTimeout(() => {
        timers.delete(timer)
        callback()
      }, delay)
      timers.add(timer)
    }

    function handleDrawComplete(event: Event) {
      const detail = (event as CustomEvent<Partial<FreshDraw>>).detail
      if (!detail || typeof detail.cardId !== 'string' || typeof detail.drawnAt !== 'string') return

      setKeepNativeLayer(true)
      setFreshDraw({
        cardId: detail.cardId,
        drawnAt: detail.drawnAt,
        variantIdx: typeof detail.variantIdx === 'number' ? detail.variantIdx : 0,
        targetRect: normalizeTargetRect(detail.targetRect),
        nativeMetrics: detail.nativeMetrics,
      })

      setManagedTimeout(() => {
        collectFinalHandoffDiagnostics()
      }, 380)

      setManagedTimeout(() => {
        nativeWindow.__moraNativeApp?.cleanup?.()
        document.body.classList.remove('is-drawing-card')
        setKeepNativeLayer(false)
      }, 700)
    }

    window.addEventListener('mora:draw-complete', handleDrawComplete)

    let script: HTMLScriptElement | null = null

    if (nativeWindow.__moraNativeApp?.init) {
      nativeWindow.__moraNativeApp.init()
    } else {
      const nextScript = document.createElement('script')
      nextScript.type = 'module'
      nextScript.src = `/assets/app.js?v=${NATIVE_APP_VERSION}`
      document.body.appendChild(nextScript)
      script = nextScript
    }

    return () => {
      nativeWindow.__moraNativeApp?.cleanup?.()
      delete nativeWindow.__moraDrawAuthed
      delete nativeWindow.__moraDrawPreview
      delete nativeWindow.__moraDrawShareQa
      delete nativeWindow.__moraUseReactResult
      window.removeEventListener('mora:draw-complete', handleDrawComplete)
      timers.forEach(timer => window.clearTimeout(timer))
      timers.clear()
      document.body.classList.remove('is-drawing-card')
      if (script?.parentNode) script.parentNode.removeChild(script)
    }
  }, [mounted, persistDraw, shareQa])

  const fixedElements = (
    <>
      {/* Скрытые элементы нужны app.js */}
      <button id="shuffleBtn"      hidden style={{display:'none'}} aria-hidden="true" />
      <button id="streetToggleBtn" hidden style={{display:'none'}} aria-hidden="true" />
      <button id="resultAgainBtn"  hidden style={{display:'none'}} aria-hidden="true" />

      {/* revealCard — портал в body, чтобы opacity db-wrap его не скрывал */}
      <div id="revealCard">
        <div className="rc-tilt" id="rcTilt">
          <div className="rc-inner" id="rcInner">
            <div className="rc-back">
              <span className="rc-back-mark" style={{top:'18px',left:'18px'}}>✦</span>
              <span className="rc-back-mark" style={{bottom:'18px',right:'18px'}}>✦</span>
            </div>
            <div className="rc-front" id="rcFront">
              <span className="rc-corner rc-corner-tl">✦</span>
              <span className="rc-corner rc-corner-tr">✦</span>
              <span className="rc-corner rc-corner-bl">✦</span>
              <span className="rc-corner rc-corner-br">✦</span>
              <div className="rc-front-glow"></div>
              <img className="rc-art" id="rcArt" alt="" hidden />
              <div className="rc-symbol" id="rcSymbol">☽</div>
              <div className="rc-num" id="rcNum">XVIII</div>
            </div>
          </div>
        </div>
      </div>

      {/* resultOverlay — тоже портал, независим от db-wrap */}
      <div id="resultOverlay">
        <section className="result-el result-reading-panel" id="resultReadingPanel" aria-live="polite">
          <div className="result-reading-kicker" id="resultReadingKicker"></div>
          <div className="result-reading-tags" id="resultReadingTags" aria-label="Теги карты"></div>
          <h2 className="result-reading-title" id="resultReadingTitle"></h2>
          <div className="result-reading-sections" id="resultReadingSections"></div>
          <div className="result-reading-actions" id="resultReadingActions">
            <button className="btn result-reading-action" id="resultStreetBtn" type="button" hidden>Перевести на пацанский</button>
          </div>
          <div className="result-card-actions">
            <a href={returnHref} className="result-card-action-btn result-card-action-btn--save" id="resultSaveLink">
              ✦ В кабинет
            </a>
            <button className="result-card-action-btn result-card-action-btn--share" id="resultShareBtn" type="button" disabled>
              Поделиться
            </button>
          </div>
        </section>
        <div id="resultSpacer"></div>
        <div className="result-el" id="resultCardName"></div>
        <div className="result-el" id="resultDivider"></div>
        <div className="result-el" id="resultText"></div>
      </div>
    </>
  )

  const freshMeaning = freshDraw ? getTarotCardDailyMeaning(freshDraw.cardId, freshDraw.variantIdx) : null
  const freshMeta = freshDraw ? getTarotCardMeta(freshDraw.cardId) : null

  return (
    <>
      {freshDraw && freshMeaning ? (
        <DashboardTodayCard
          cardId={freshDraw.cardId}
          title={freshMeaning.title}
          titleMeta={freshMeaning.titleMeta}
          tags={freshMeaning.tags}
          tarotBrief={freshMeaning.tarotBrief}
          meaningLabel={freshMeaning.meaningLabel}
          paragraphs={freshMeaning.paragraphs}
          fullParagraphs={freshMeaning.fullParagraphs}
          shareText={freshMeaning.shareText}
          readingDate={date.replace(/^Сегодня\s+/, '')}
          journalArcana={freshMeta?.journalArcana ?? 'Старший аркан'}
          autoOpenKey={`${freshDraw.drawnAt}:${freshDraw.cardId}:${freshDraw.variantIdx}`}
          autoOpenMode="handoff"
          autoOpenTargetRect={freshDraw.targetRect}
          autoOpenNativeMetrics={freshDraw.nativeMetrics}
        />
      ) : (
        <>
          {/* Двухколоночный лейаут внутри db-wrap */}
          <div className="dw-toprow">
            <span className="db-panel-date">{date}</span>
            <span className="dw-moon-caption">☽ {getMoonPhase()}</span>
          </div>

          <div className="dw-panel">

            <div className="day-panel-deck-col dw-deck-col">
              <div className="deck3d" aria-hidden="true">
                <div className="deck3d-stack">
                  <div className="deck3d-card deck3d-card--layer deck3d-card--layer-3"><div className="deck3d-card-inner"></div></div>
                  <div className="deck3d-card deck3d-card--layer deck3d-card--layer-4"><div className="deck3d-card-inner"></div></div>
                  <div className="deck3d-card deck3d-card--layer deck3d-card--layer-5"><div className="deck3d-card-inner"></div></div>
                  <div className="deck3d-card deck3d-card--layer deck3d-card--layer-6"><div className="deck3d-card-inner"></div></div>
                  <div className="deck3d-card deck3d-card--layer deck3d-card--layer-7"><div className="deck3d-card-inner"></div></div>
                  <div className="deck3d-card deck3d-card--top"><div className="deck3d-card-inner"></div></div>
                </div>
              </div>
              <div className="day-panel-deck-object">
                <div id="deckWrap">
                  <div className="scard" id="sc0"><span className="card-mark" style={{top:'18px',left:'18px'}}>◆</span><span className="card-mark" style={{bottom:'18px',right:'18px'}}>◆</span></div>
                  <div className="scard" id="sc1"><span className="card-mark" style={{top:'18px',left:'18px'}}>✕</span><span className="card-mark" style={{bottom:'18px',right:'18px'}}>✕</span></div>
                  <div className="scard" id="sc2"><span className="card-mark" style={{top:'18px',left:'18px'}}>○</span><span className="card-mark" style={{bottom:'18px',right:'18px'}}>○</span></div>
                  <div className="scard" id="sc3"><span className="card-mark" style={{top:'18px',left:'18px'}}>✦</span><span className="card-mark" style={{bottom:'18px',right:'18px'}}>✦</span></div>
                </div>
              </div>
            </div>

            <div className="dw-text-col">
              <span className="dw-timer-badge">До полуночи · <span className="dw-timer-time">{countdown}</span></span>
              <h2 className="dw-title">Твоя карта дня готова</h2>
              <p className="dw-desc">{prompt}</p>
              <button className="btn dw-draw-btn" data-vis="visible" id="drawBtn">
                Вытянуть карту
              </button>
            </div>

          </div>
        </>
      )}

      {/* Fixed-элементы через портал — вне db-wrap, opacity не наследуют */}
      {mounted && (!freshDraw || keepNativeLayer) && createPortal(fixedElements, document.body)}
    </>
  )
}
