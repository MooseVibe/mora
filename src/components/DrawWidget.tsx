'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

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

export default function DrawWidget({ date }: { date: string }) {
  const [mounted, setMounted] = useState(false)
  const [prompt, setPrompt] = useState(DRAW_PROMPTS[0])
  const [countdown, setCountdown] = useState('00:00:00')

  useEffect(() => {
    setPrompt(DRAW_PROMPTS[Math.floor(Math.random() * DRAW_PROMPTS.length)])
    setCountdown(getTimeUntilMidnight())
    setMounted(true)

    const timer = setInterval(() => setCountdown(getTimeUntilMidnight()), 1000)

    ;(window as Window & { __moraDrawAuthed?: boolean }).__moraDrawAuthed = true

    const script = document.createElement('script')
    script.type = 'module'
    script.src = '/assets/app.js'
    document.body.appendChild(script)

    return () => {
      clearInterval(timer)
      delete (window as Window & { __moraDrawAuthed?: boolean }).__moraDrawAuthed
      document.body.classList.remove('is-drawing-card')
      document.body.removeChild(script)
    }
  }, [])

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
          <div className="result-reading-tags" id="resultReadingTags" aria-label="Теги карты"></div>
          <h2 className="result-reading-title" id="resultReadingTitle"></h2>
          <div className="result-reading-kicker" id="resultReadingKicker" hidden></div>
          <div className="result-reading-sections" id="resultReadingSections"></div>
          <div className="result-reading-actions" id="resultReadingActions">
            <button className="btn result-reading-action" id="resultStreetBtn" type="button" hidden>Перевести на пацанский</button>
          </div>
          <div className="result-card-actions">
            <a href="/dashboard" className="result-card-action-btn result-card-action-btn--save">
              ✦ В кабинет
            </a>
            <button className="result-card-action-btn result-card-action-btn--share" type="button" disabled>
              ↗ Поделиться
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

  return (
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

      {/* Fixed-элементы через портал — вне db-wrap, opacity не наследуют */}
      {mounted && createPortal(fixedElements, document.body)}
    </>
  )
}
