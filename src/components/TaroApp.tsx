'use client'

import { useEffect } from 'react'

export default function TaroApp() {
  useEffect(() => {
    // загружаем app.js как ES-модуль после монтирования DOM
    const script = document.createElement('script')
    script.type = 'module'
    script.src = '/assets/app.js'
    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [])

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
        <button className="site-signin-btn" type="button">Войти</button>
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

            <div className="landing-panel landing-panel-day">
              <div className="landing-panel-day-bg" aria-hidden="true"></div>
              <div className="day-panel-deck-col">
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

              <div className="day-panel-content-col">
                <div className="day-text-block">
                  <h2 className="landing-panel-title">Карта дня</h2>
                  <p className="landing-panel-desc">Вытяни карту и узнай, что приготовил тебе день</p>
                </div>
                <button className="btn fu" data-vis="visible" id="drawBtn">Вытянуть карту</button>
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
        </section>
        <div id="resultSpacer"></div>
        <div className="result-el" id="resultCardName"></div>
        <div className="result-el" id="resultDivider"></div>
        <div className="result-el" id="resultText"></div>
        <button className="btn result-el" id="streetToggleBtn" hidden>Перевести на пацанский</button>
        <button className="btn btn-secondary result-el" id="resultAgainBtn">Вытянуть ещё раз</button>
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
    </>
  )
}
