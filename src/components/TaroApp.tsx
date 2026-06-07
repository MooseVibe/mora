'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getTarotCardImageSrc, getTarotCardMeta } from '@/lib/tarot'

type DrawState =
  | { status: 'checking' }
  | { status: 'empty' }
  | { status: 'drawn'; cardId: string }

type PendingDraw = {
  cardId: string
  drawnAt: string
  variantIdx?: number
}

const APP_TRANSITION_MS = 950
const APP_TRANSITION_HIDE_MS = 1050

function getPendingDrawCookieMaxAge() {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setHours(24, 0, 0, 0)
  return Math.max(60, Math.ceil((tomorrow.getTime() - now.getTime()) / 1000))
}

function setPendingDrawCookie(draw: PendingDraw) {
  document.cookie = [
    `mora_pending_draw=${encodeURIComponent(JSON.stringify(draw))}`,
    'Path=/',
    `Max-Age=${getPendingDrawCookieMaxAge()}`,
    'SameSite=Lax',
  ].join('; ')
}

function clearPendingDrawCookie() {
  document.cookie = 'mora_pending_draw=; Path=/; Max-Age=0; SameSite=Lax'
}

export default function TaroApp() {
  const [isAuthed, setIsAuthed] = useState(false)
  const [drawState, setDrawState] = useState<DrawState>({ status: 'checking' })
  const [showSaveModal, setShowSaveModal] = useState(false)
  const alreadyDrawn = drawState.status === 'drawn' ? { cardId: drawState.cardId } : null
  const isCheckingDrawState = drawState.status === 'checking'

  function showAppLoader() {
    const loader = document.getElementById('appLoader')
    if (!loader) return
    loader.removeAttribute('hidden')
    loader.classList.remove('is-hiding')
    const deck = loader.querySelector('.app-loader-deck') as HTMLElement | null
    if (deck) {
      deck.classList.remove('nav-shuffling')
      void deck.offsetWidth // reflow to restart animation
      deck.classList.add('nav-shuffling')
    }
  }

  function hideAppLoader() {
    const loader = document.getElementById('appLoader')
    if (!loader) return
    loader.classList.add('is-hiding')
    const deck = loader.querySelector('.app-loader-deck')
    if (deck) deck.classList.remove('nav-shuffling')
    setTimeout(() => loader.setAttribute('hidden', ''), 500)
  }

  function preloadImage(src: string): Promise<void> {
    return new Promise(resolve => {
      const img = new Image()
      img.onload = () => resolve()
      img.onerror = () => resolve()
      img.src = src
    })
  }

  function getAssetsToPreload(href: string): string[] {
    if (href.includes('/auth')) return ['/assets/mora-door.webp']
    if (href.includes('/dashboard')) return []
    return []
  }

  async function navigateWithTransition(href: string) {
    setShowSaveModal(false)
    showAppLoader()

    await Promise.all([
      new Promise<void>(resolve => setTimeout(resolve, APP_TRANSITION_MS)),
      ...getAssetsToPreload(href).map(preloadImage),
    ])

    window.location.href = href
  }

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return
      showAppLoader()
      setTimeout(() => hideAppLoader(), APP_TRANSITION_HIDE_MS)
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const els = document.elementsFromPoint(e.clientX, e.clientY)
      const hit = els.some(el => el.closest?.('button:not([disabled]), a[href]'))
      document.documentElement.style.cursor = hit ? 'pointer' : ''
    }
    document.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.documentElement.style.cursor = ''
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]

    let pendingDrawForToday: PendingDraw | null = null

    try {
      const raw = localStorage.getItem('mora:pendingDraw')
      if (raw) {
        const draw = JSON.parse(raw)
        if (draw?.drawnAt === today && typeof draw.cardId === 'string') {
          pendingDrawForToday = {
            cardId: draw.cardId,
            drawnAt: draw.drawnAt,
            variantIdx: typeof draw.variantIdx === 'number' ? draw.variantIdx : 0,
          }
          setPendingDrawCookie(pendingDrawForToday)
          setDrawState({ status: 'drawn', cardId: draw.cardId })
        } else {
          localStorage.removeItem('mora:pendingDraw')
          clearPendingDrawCookie()
          setDrawState({ status: 'empty' })
        }
      } else {
        clearPendingDrawCookie()
        setDrawState({ status: 'empty' })
      }
    } catch {
      localStorage.removeItem('mora:pendingDraw')
      clearPendingDrawCookie()
      setDrawState({ status: 'empty' })
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const authed = !!session
      setIsAuthed(authed)

      if (authed && pendingDrawForToday) {
        window.location.href = '/dashboard'
      }
    }).catch(() => {
      setIsAuthed(false)
    })

    // загружаем app.js как ES-модуль после монтирования DOM
    const script = document.createElement('script')
    script.type = 'module'
    script.src = '/assets/app.js'
    document.body.appendChild(script)

    return () => {
      document.body.classList.remove('is-drawing-card')
      document.body.removeChild(script)
    }
  }, [])

  function handleCardTilt(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const dx = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2)
    const dy = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2)
    e.currentTarget.style.transition = 'transform 0.08s ease'
    e.currentTarget.style.transform = `perspective(700px) rotateY(${dx * 12}deg) rotateX(${-dy * 12}deg) scale(1.03)`
  }

  function handleCardTiltEnd(e: React.MouseEvent<HTMLDivElement>) {
    e.currentTarget.style.transition = 'transform 0.42s cubic-bezier(0.22, 0.61, 0.36, 1)'
    e.currentTarget.style.transform = ''
  }

  return (
    <>
      <div className="app-loader" id="appLoader" role="status" aria-live="polite" aria-label="Грузим колоду">
        <div className="app-loader-deck" aria-hidden="true">
          <span className="app-loader-card"></span>
          <span className="app-loader-card"></span>
          <span className="app-loader-card"></span>
          <span className="app-loader-card"></span>
        </div>
        <div className="app-loader-copy">
          <div className="app-loader-text" id="appLoaderText">
            <span className="app-loader-label">Грузим колоду</span>
            <span className="app-loader-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>
          </div>
          <div className="app-loader-error-title" id="appLoaderErrorTitle" hidden>Колода не загрузилась</div>
          <div className="app-loader-error-text" id="appLoaderErrorText" hidden>Бро, похоже, у тебя что-то с интернетом. Попробуй обновить страницу или зайти попозже.</div>
          <button className="app-loader-reload" id="appLoaderReload" type="button" hidden>Обновить</button>
        </div>
      </div>

      <div className="stars-deco" id="stars"></div>

      <header className="site-header" id="siteHeader">
        <div className="site-logo">
          <span className="site-logo-icon" aria-hidden="true">✦</span>
          <span className="site-logo-text">MORA</span>
        </div>
        <button onClick={() => navigateWithTransition('/auth')} className="site-signin-btn">Войти</button>
      </header>

      <div id="stage">
        <div className="fu landing-content" data-vis="visible" id="startTitle">
          <div className="landing-hero">
            <h1 className="landing-hero-title">Ответ уже здесь</h1>
          </div>

          <div className="landing-panels">
            <div className="landing-panel landing-panel-tarot" aria-disabled="true">
              <div className="landing-panel-tarot-bg" aria-hidden="true"></div>
              <div className="landing-panel-tarot-hover-bg" aria-hidden="true"></div>
              <div className="tarot-panel-content-col">
                <div className="tarot-text-block">
                  <span className="landing-panel-badge landing-panel-badge--tarot">Скоро</span>
                  <h2 className="landing-panel-title">Мора<br />ждёт тебя</h2>
                  <p className="landing-panel-desc">Приди на сеанс — и она откроет то, что скрыто от тебя</p>
                </div>
              </div>
            </div>

            <div className={`landing-panel landing-panel-day${alreadyDrawn ? ' landing-panel-day--drawn' : ''}`}>
              <div className="landing-panel-day-bg" aria-hidden="true"></div>
              <div className="day-panel-deck-col" style={{position:'relative'}}>
                {/* карта поверх колоды когда уже вытянута */}
                {alreadyDrawn && (
                  <div
                    className="drawn-card-preview"
                    onMouseMove={handleCardTilt}
                    onMouseLeave={handleCardTiltEnd}
                  >
                    <img
                      src={getTarotCardImageSrc(alreadyDrawn.cardId)}
                      alt=""
                      className="drawn-card-art"
                    />
                  </div>
                )}
                <div style={alreadyDrawn ? {display:'none'} : undefined}>
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
                </div>{/* /deck hide wrapper */}
              </div>

              <div className={`day-panel-content-col${alreadyDrawn ? ' day-panel-content-col--drawn' : ''}`}>
                {isCheckingDrawState ? (
                  <div className="day-text-block">
                    <span className="landing-panel-badge landing-panel-badge--drawn">Смотрим карту дня</span>
                    <h2 className="landing-panel-title">Карта дня</h2>
                    <p className="landing-panel-desc">
                      Мора сверяется с сегодняшним днём.
                    </p>
                  </div>
                ) : alreadyDrawn ? (
                  <div className="day-text-block">
                    <span className="landing-panel-badge landing-panel-badge--drawn">Ваша карта дня</span>
                    <h2 className="landing-panel-title">
                      {getTarotCardMeta(alreadyDrawn.cardId)?.name ?? 'Карта'}
                    </h2>
                    <p className="landing-panel-desc">
                      Мора уже открыла тебе карту сегодня. Одна карта — один день. Вернись вечером и расскажи, сбылось ли.
                    </p>
                    <button onClick={() => setShowSaveModal(true)} className="drawn-save-btn">
                      Сохранить в дневник
                    </button>
                    <p className="drawn-today-footer">Новая карта — завтра</p>
                  </div>
                ) : (
                  <div className="day-text-block">
                    <h2 className="landing-panel-title">Карта дня</h2>
                    <p className="landing-panel-desc">Вытяни карту и узнай, что приготовил тебе день</p>
                  </div>
                )}
                <button
                  className="btn fu"
                  data-vis="visible"
                  id="drawBtn"
                  style={alreadyDrawn || isCheckingDrawState ? {display:'none'} : undefined}
                  disabled={isCheckingDrawState}
                >
                  Вытянуть карту
                </button>
              </div>
            </div>
          </div>

          <p className="landing-tagline">Таро — это инструмент самопознания и осознанности. Доверьтесь интуиции.</p>
        </div>

        <div className="fu" data-vis="visible" id="startEyebrow" hidden></div>
        <p className="fu" data-vis="visible" id="startSubtitle" hidden></p>
        <div className="fu" data-vis="visible" id="startSep" hidden></div>
        <button id="shuffleBtn" hidden aria-live="polite" aria-label="Перетасовать колоду" style={{display:'none'}}>
          <span className="shuffle-button-label shuffle-button-label-idle">Перетасовать колоду</span>
          <span className="shuffle-button-label shuffle-button-label-busy"><span className="app-loader-label">Перетасовываем</span></span>
        </button>
      </div>

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
            <a
              href={isAuthed ? '/dashboard' : undefined}
              onClick={!isAuthed ? (e) => { e.preventDefault(); navigateWithTransition('/auth?intent=save') } : undefined}
              className="result-card-action-btn result-card-action-btn--save"
            >
              ✦ Сохранить карту
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
        <button className="btn result-el" id="streetToggleBtn" hidden>Перевести на пацанский</button>
        <button className="btn btn-secondary result-el" id="resultAgainBtn" style={{display:'none'}}>Вытянуть ещё раз</button>
      </div>

      <div id="deckGallery" aria-hidden="true" hidden>
        <div className="gallery-deck-ghost" id="galleryDeckGhost">
          <div className="gallery-ghost-card gallery-ghost-card-0"></div>
          <div className="gallery-ghost-card gallery-ghost-card-1"></div>
          <div className="gallery-ghost-card gallery-ghost-card-2"></div>
          <div className="gallery-ghost-card gallery-ghost-card-3"></div>
        </div>
        <button className="gallery-close" id="galleryCloseBtn" type="button" aria-label="Закрыть просмотр колоды">×</button>
        <button className="gallery-nav gallery-nav-prev" id="galleryPrevBtn" type="button" aria-label="Предыдущая карта">‹</button>
        <button className="gallery-nav gallery-nav-next" id="galleryNextBtn" type="button" aria-label="Следующая карта">›</button>
        <div className="gallery-card-wrap" id="galleryCardWrap">
          <div className="gallery-track" id="galleryTrack"></div>
          <div className="gallery-card-title" id="galleryCardTitle"></div>
          <div className="gallery-card-counter" id="galleryCardCounter"></div>
        </div>
      </div>

      {/* Save intent modal */}
      {showSaveModal && (
        <div className="save-modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="save-modal" onClick={e => e.stopPropagation()}>
            <div className="save-modal-icon">✦</div>
            <h2 className="save-modal-title">Сохрани карту в дневник</h2>
            <p className="save-modal-desc">Войди — и Мора запомнит твою карту дня</p>
            <button onClick={() => navigateWithTransition('/auth?intent=save')} className="auth-btn save-modal-cta">
              Войти
            </button>
            <button onClick={() => setShowSaveModal(false)} className="save-modal-later">
              Позже
            </button>
          </div>
        </div>
      )}
    </>
  )
}
