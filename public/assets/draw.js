'use strict';
import { STATE, transition, runSequence } from './state.js';
import { smoothStep, lerpArc } from './arc.js';

let d = null;
let activeDeck3DFlight = null;
let activeDeck3DFlightHome = null;
let activeResultRect = null;
const USE_DECK3D_DRAW_EXPERIMENT = true;
const DEBUG_DECK3D_FLIGHT_MATCH = false;
const DECK3D_FLIGHT_SCALE = 1.7;
const DECK3D_FLIGHT_TARGET_WIDTH = 320;
const DECK3D_RESULT_TARGET_WIDTH = 376;
const DECK3D_RESULT_FLIGHT_START = 720;
const DECK3D_RESULT_FLIGHT_DURATION = 680;
const REACT_RESULT_HANDOFF_BEFORE_END = 360;
const REVEAL_RESULT_FRAME = {
  radius: 20,
  artPadding: 11,
  artRadius: 9,
  shadowY: 28,
  shadowBlur: 80,
};

export function initDraw(deps) {
  d = deps;
}

function getReaderTargetWidth() {
  const viewportWidth = window.innerWidth;
  return viewportWidth < 700
    ? Math.min(viewportWidth - 56, 280)
    : Math.min(DECK3D_RESULT_TARGET_WIDTH, viewportWidth * 0.34);
}

function scaleFrameValue(value, baseWidth, targetWidth) {
  return `${(value * baseWidth / targetWidth).toFixed(3)}px`;
}

function applyRevealResultFrame(baseWidth, targetWidth = getReaderTargetWidth()) {
  d.dom.revealCard.classList.add('is-result-frame');
  d.dom.revealCard.style.setProperty('--card-radius', scaleFrameValue(REVEAL_RESULT_FRAME.radius, baseWidth, targetWidth));
  d.dom.revealCard.style.setProperty('--card-art-padding', scaleFrameValue(REVEAL_RESULT_FRAME.artPadding, baseWidth, targetWidth));
  d.dom.revealCard.style.setProperty('--card-art-radius', scaleFrameValue(REVEAL_RESULT_FRAME.artRadius, baseWidth, targetWidth));
  d.dom.revealCard.style.setProperty('--card-inner-border-inset', scaleFrameValue(REVEAL_RESULT_FRAME.artPadding, baseWidth, targetWidth));
  d.dom.revealCard.style.setProperty('--card-inner-border-radius', scaleFrameValue(REVEAL_RESULT_FRAME.artRadius, baseWidth, targetWidth));
  d.dom.revealCard.style.setProperty('--reveal-card-border-width', scaleFrameValue(1, baseWidth, targetWidth));
  d.dom.revealCard.style.setProperty(
    '--card-shadow',
    `0 ${scaleFrameValue(REVEAL_RESULT_FRAME.shadowY, baseWidth, targetWidth)} ${scaleFrameValue(REVEAL_RESULT_FRAME.shadowBlur, baseWidth, targetWidth)} rgba(0, 0, 0, 0.42)`,
  );
}

function getPendingDrawCookieMaxAge() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0);
  return Math.max(60, Math.ceil((tomorrow.getTime() - now.getTime()) / 1000));
}

function persistPendingDraw(draw) {
  localStorage.setItem('mora:pendingDraw', JSON.stringify(draw));
  document.cookie = [
    `mora_pending_draw=${encodeURIComponent(JSON.stringify(draw))}`,
    'Path=/',
    `Max-Age=${getPendingDrawCookieMaxAge()}`,
    'SameSite=Lax',
  ].join('; ');
}

function savePendingDraw() {
  try {
    const card = d.getCurrent();
    const reading = d.getCurrentReading();
    if (!card) return null;
    const draw = {
      cardId: card.id,
      variantIdx: reading?.variantIdx ?? 0,
      drawnAt: new Date().toISOString().split('T')[0],
    };
    if (window.__moraDrawPreview) return draw;
    if (d.isDebugDrawEnabled?.() && !window.__moraDrawShareQa) return draw;
    persistPendingDraw(draw);
    // если контекст дашборда — сохраняем в БД сразу
    if (window.__moraDrawAuthed) {
      fetch('/api/draws', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draw),
      }).catch(() => {});
    }
    return draw;
  } catch(_) {}
  return null;
}

function notifyDrawComplete(draw) {
  if (!draw) return;
  window.dispatchEvent(new CustomEvent('mora:draw-complete', {
    detail: {
      ...draw,
      targetRect: activeResultRect,
      nativeMetrics: isHandoffDebugEnabled() ? collectRevealCardMetrics() : null,
    },
  }));
}

function isHandoffDebugEnabled() {
  try {
    return new URLSearchParams(window.location.search).get('handoffDebug') === '1'
      || window.localStorage.getItem('mora:handoffDebug') === '1';
  } catch (_) {
    return false;
  }
}

function rectMetrics(rect) {
  return {
    left: roundMetric(rect.left),
    top: roundMetric(rect.top),
    width: roundMetric(rect.width),
    height: roundMetric(rect.height),
  };
}

function roundMetric(value) {
  return Math.round(value * 1000) / 1000;
}

function readPx(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getVisualScale(element, rect) {
  return element.offsetWidth ? rect.width / element.offsetWidth : 1;
}

function collectRevealCardMetrics() {
  const card = d.dom.revealCard;
  const front = d.dom.rcFront;
  const art = d.dom.rcArt;
  const cardRect = card.getBoundingClientRect();
  const artRect = art?.getBoundingClientRect();
  const cardStyle = getComputedStyle(card);
  const frontStyle = front ? getComputedStyle(front) : null;
  const artStyle = art ? getComputedStyle(art) : null;
  const beforeStyle = front ? getComputedStyle(front, '::before') : null;
  const scale = getVisualScale(card, cardRect);

  return {
    source: 'native',
    state: String(STATE),
    card: rectMetrics(cardRect),
    art: artRect ? rectMetrics(artRect) : null,
    visualScale: roundMetric(scale),
    visualOuterRadius: roundMetric(readPx(cardStyle.borderTopLeftRadius) * scale),
    visualArtRadius: artStyle ? roundMetric(readPx(artStyle.borderTopLeftRadius) * scale) : null,
    visualArtInsetLeft: artRect ? roundMetric(artRect.left - cardRect.left) : null,
    visualArtInsetTop: artRect ? roundMetric(artRect.top - cardRect.top) : null,
    css: {
      cardRadius: cardStyle.getPropertyValue('--card-radius').trim(),
      artPadding: cardStyle.getPropertyValue('--card-art-padding').trim(),
      artRadius: cardStyle.getPropertyValue('--card-art-radius').trim(),
      innerInset: cardStyle.getPropertyValue('--card-inner-border-inset').trim(),
      innerRadius: cardStyle.getPropertyValue('--card-inner-border-radius').trim(),
      borderWidth: frontStyle?.borderTopWidth ?? '',
      innerBorderWidth: beforeStyle?.borderTopWidth ?? '',
      shadow: cardStyle.boxShadow,
      transform: cardStyle.transform,
    },
  };
}

function cleanupDeck3DFlight() {
  if (!activeDeck3DFlight) return;

  activeDeck3DFlight.classList.remove(
    'is-direct-flight',
    'is-flight-fanned',
    'is-flying-center',
    'is-flight-handoff',
    'is-visible',
  );
  activeDeck3DFlight.removeAttribute('style');
  if (activeDeck3DFlightHome?.parent) {
    activeDeck3DFlightHome.parent.insertBefore(activeDeck3DFlight, activeDeck3DFlightHome.nextSibling);
  }

  activeDeck3DFlight = null;
  activeDeck3DFlightHome = null;
}

function createDeck3DFlightShell() {
  cleanupDeck3DFlight();

  const source = document.querySelector('.deck3d');
  if (!source) return null;

  const rect = source.getBoundingClientRect();
  activeDeck3DFlightHome = {
    parent: source.parentNode,
    nextSibling: source.nextSibling,
  };
  activeDeck3DFlight = source;

  document.body.appendChild(source);
  source.classList.add('is-direct-flight', 'is-flight-fanned');
  source.style.left = `${rect.left}px`;
  source.style.top = `${rect.top}px`;
  source.style.width = `${rect.width}px`;
  source.style.height = `${rect.height}px`;

  void source.offsetWidth;
  source.classList.add('is-visible');

  return source;
}

function flyDeck3DFlightToCenter() {
  if (!activeDeck3DFlight) return;

  const sourceLeft = parseFloat(activeDeck3DFlight.style.left) || activeDeck3DFlight.getBoundingClientRect().left;
  const sourceTop = parseFloat(activeDeck3DFlight.style.top) || activeDeck3DFlight.getBoundingClientRect().top;
  const baseWidth = parseFloat(activeDeck3DFlight.style.width) || activeDeck3DFlight.offsetWidth;
  const baseHeight = parseFloat(activeDeck3DFlight.style.height) || activeDeck3DFlight.offsetHeight;
  const flightScale = getDeck3DFlightScale(baseWidth);
  const headerBottom = document.querySelector('.site-header')?.getBoundingClientRect().bottom || d.getViewportTop();
  const viewportBottom = d.getViewportTop() + d.getViewportHeight();
  const scaledHeight = baseHeight * flightScale;
  const targetVisualTop = headerBottom + (viewportBottom - headerBottom - scaledHeight) / 2;
  const targetLeft = window.innerWidth / 2 - baseWidth / 2;
  const targetTop = targetVisualTop + baseHeight * (flightScale - 1);

  activeDeck3DFlight.style.setProperty('--deck3d-flight-x', `${targetLeft - sourceLeft}px`);
  activeDeck3DFlight.style.setProperty('--deck3d-flight-y', `${targetTop - sourceTop}px`);
  activeDeck3DFlight.style.setProperty('--deck3d-flight-scale', `${flightScale}`);
  activeDeck3DFlight.classList.remove('is-flight-fanned');
  activeDeck3DFlight.classList.add('is-flying-center');
}

function runDeck3DDrawExperiment() {
  createDeck3DFlightShell();
  activeResultRect = null;

  if (DEBUG_DECK3D_FLIGHT_MATCH) {
    d.dom.drawBtn.disabled = true;
    window.setTimeout(() => {
      cleanupDeck3DFlight();
      d.dom.drawBtn.disabled = false;
    }, 4000);
    return;
  }

  transition('drawing');
  document.body.classList.add('is-drawing-card');
  d.clearCardZoomState();
  d.clearStartInlineMotion();
  d.setCurrent(d.pickCard());
  d.setCurrentReading(d.createReadingDraft(d.getCurrent()));
  d.resetInterpretation();
  d.setCardFace(d.getCurrent());
  const cardFaceReady = d.waitForCardFaceImage(d.getCurrent(), 1800);
  d.renderResultContent(d.getCurrent());
  d.dom.resultCardName.textContent = d.getCurrentInterpretationName();
  d.dom.resultText.textContent = d.getCurrentInterpretationText();
  d.hideResultElsImmediately();
  d.syncCurrentShareAvailability();
  d.dom.resultOverlay.style.pointerEvents = 'none';
  d.dom.revealCard.classList.remove('is-deck3d-handoff-card');
  d.dom.revealCard.style.opacity = '0';
  d.updateUI();

  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!DEBUG_DECK3D_FLIGHT_MATCH) flyDeck3DFlightToCenter();
  }));

  window.setTimeout(async () => {
    if (STATE !== 'drawing') return;
    await cardFaceReady;
    if (STATE !== 'drawing') return;
    handoffDeck3DFlightToRevealCard();
  }, 780);
}

function handoffDeck3DFlightToRevealCard() {
  if (!activeDeck3DFlight) return;

  const rect = activeDeck3DFlight.getBoundingClientRect();
  const baseWidth = parseFloat(activeDeck3DFlight.style.width) || activeDeck3DFlight.offsetWidth;
  const baseHeight = parseFloat(activeDeck3DFlight.style.height) || activeDeck3DFlight.offsetHeight;
  const flightScale = getActiveDeck3DFlightScale(baseWidth);
  const left = rect.left + (rect.width - baseWidth) / 2;
  const top = rect.top + rect.height - baseHeight;

  d.dom.rcInner.style.transition = 'none';
  d.dom.rcInner.style.transform = 'rotateY(0deg)';
  d.dom.revealCard.style.transition = 'none';
  d.dom.revealCard.classList.add('is-deck3d-handoff-card');
  applyRevealResultFrame(baseWidth);
  d.dom.revealCard.style.left = `${left}px`;
  d.dom.revealCard.style.top = `${top}px`;
  d.dom.revealCard.style.width = `${baseWidth}px`;
  d.dom.revealCard.style.transformOrigin = 'center bottom';
  d.dom.revealCard.style.transform = `translateY(0) scale(${flightScale})`;
  d.dom.revealCard.style.opacity = '0';

  void d.dom.revealCard.offsetWidth;

  activeDeck3DFlight.classList.add('is-flight-handoff');
  d.dom.revealCard.style.transition = 'opacity 0.2s ease';
  d.dom.revealCard.style.opacity = '1';

  window.setTimeout(() => {
    if (STATE !== 'drawing') return;
    d.dom.rcInner.style.transition = 'transform 0.58s cubic-bezier(0.2,0.72,0.22,1)';
    d.dom.rcInner.style.transform = 'rotateY(180deg)';
  }, 55);

  window.setTimeout(() => {
    if (STATE !== 'drawing') return;
    cleanupDeck3DFlight();
  }, 240);

  window.setTimeout(() => {
    if (STATE !== 'drawing') return;
    d.dom.revealCard.classList.remove('is-deck3d-handoff-card');
  }, 720);

  window.setTimeout(() => {
    if (STATE !== 'drawing') return;
    flyRevealCardToResultSide();
  }, DECK3D_RESULT_FLIGHT_START);

  window.setTimeout(() => {
    if (STATE !== 'drawing') return;
    if (window.__moraUseReactResult) return;
    d.dom.resultReadingPanel.classList.add('visible');
  }, DECK3D_RESULT_FLIGHT_START);

  window.setTimeout(() => {
    if (STATE !== 'drawing' || !window.__moraUseReactResult) return;
    transition('result');
    d.syncResultShareAvailability();
    const draw = savePendingDraw();
    notifyDrawComplete(draw);
  }, DECK3D_RESULT_FLIGHT_START + DECK3D_RESULT_FLIGHT_DURATION - REACT_RESULT_HANDOFF_BEFORE_END);

  window.setTimeout(() => {
    if (STATE !== 'drawing') return;
    transition('result');
    d.syncResultShareAvailability();
    const draw = savePendingDraw();
    notifyDrawComplete(draw);
    if (!window.__moraUseReactResult) {
      const backdrop = document.getElementById('drawBackdrop');
      if (backdrop) backdrop.style.display = 'block';
      d.dom.resultOverlay.style.pointerEvents = 'auto';
      d.updateCardZoomAvailability();
      if (d.canUseMobileTilt()) {
        d.startMobileTiltListening();
      }
    }
  }, DECK3D_RESULT_FLIGHT_START + DECK3D_RESULT_FLIGHT_DURATION + 80);
}

function flyRevealCardToResultSide() {
  const rect = d.dom.revealCard.getBoundingClientRect();
  const startScale = getRevealCardTransformScale();
  const baseWidth = parseFloat(d.dom.revealCard.style.width) || rect.width / startScale;
  const baseHeight = rect.height / startScale;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const isMobile = viewportWidth < 700;
  const targetWidth = getReaderTargetWidth();
  applyRevealResultFrame(baseWidth, targetWidth);
  const endScale = targetWidth / baseWidth;
  const visualWidth = targetWidth;
  const visualHeight = baseHeight * endScale;
  const { layoutLeft, gap, textWidth } = getResultLayoutMetrics(visualWidth);
  d.dom.resultOverlay.style.setProperty('--result-layout-left', `${layoutLeft}px`);
  d.dom.resultOverlay.style.setProperty('--result-text-width', `${textWidth}px`);

  const targetVisualLeft = isMobile
    ? (viewportWidth - visualWidth) / 2
    : layoutLeft + textWidth + gap;
  const targetVisualTop = isMobile
    ? Math.max(24, viewportHeight * 0.08)
    : (viewportHeight - visualHeight) / 2;

  // Switch transform-origin from center-bottom → center-center WITHOUT visual jump,
  // then animate to final position.
  // With center-bottom: visual_top = top + baseHeight*(1 - scale)
  // With center-center: visual_top = top - baseHeight*(scale - 1)/2
  // Setting visual_top equal: top_cc = top_cb - baseHeight*(scale-1)/2
  const currentTopCb = parseFloat(d.dom.revealCard.style.top) || 0;
  const currentScale = startScale;
  const topForCenterCenter = currentTopCb - baseHeight * (currentScale - 1) / 2;

  d.dom.revealCard.style.transition = 'none';
  d.dom.revealCard.style.transformOrigin = 'center center';
  d.dom.revealCard.style.top = `${topForCenterCenter}px`;
  void d.dom.revealCard.offsetWidth; // force reflow — commit before transition

  const targetLeft = targetVisualLeft + baseWidth * (endScale - 1) / 2;
  const targetTop  = targetVisualTop  + baseHeight * (endScale - 1) / 2;
  const targetVisualCenterY = targetVisualTop + visualHeight / 2;
  activeResultRect = {
    left: targetVisualLeft,
    top: targetVisualTop,
    width: visualWidth,
    height: visualHeight,
  };

  d.dom.revealCard.style.transition = [
    `left ${DECK3D_RESULT_FLIGHT_DURATION}ms cubic-bezier(0.18,0.82,0.22,1)`,
    `top ${DECK3D_RESULT_FLIGHT_DURATION}ms cubic-bezier(0.18,0.82,0.22,1)`,
    `transform ${DECK3D_RESULT_FLIGHT_DURATION}ms cubic-bezier(0.18,0.82,0.22,1)`,
  ].join(', ');
  d.dom.revealCard.style.left = `${targetLeft}px`;
  d.dom.revealCard.style.top = `${targetTop}px`;
  d.dom.revealCard.style.transform = `translateY(0) scale(${endScale})`;
  d.dom.resultOverlay.style.setProperty('--result-card-center-y', `${targetVisualCenterY}px`);
  // Store exact result position for zoom restore
  d.dom.resultOverlay.style.setProperty('--zoom-restore-top', `${targetTop}`);
  d.dom.resultOverlay.style.setProperty('--zoom-restore-left', `${targetLeft}`);
  d.dom.resultOverlay.style.setProperty('--zoom-restore-scale', `${endScale}`);

  // On mobile: pin reading panel right below the card
  if (isMobile) {
    const panel = d.dom.resultReadingPanel;
    if (panel) {
      const cardBottom = targetVisualTop + visualHeight;
      const overlayRect = d.dom.resultOverlay.getBoundingClientRect();
      panel.style.top = `${cardBottom - overlayRect.top + 12}px`;
      panel.style.bottom = 'auto';
      panel.style.maxHeight = `${viewportHeight - cardBottom - 28}px`;
    }
  }
}

function getResultLayoutMetrics(cardVisualWidth) {
  if (window.innerWidth < 700) {
    return {
      layoutLeft: 24,
      gap: 0,
      textWidth: window.innerWidth - 48,
    };
  }

  const gap = 85;
  const preferredTextWidth = 579;
  const minTextWidth = 420;
  const minOuterPad = 72;
  const availableTextWidth = window.innerWidth - minOuterPad * 2 - gap - cardVisualWidth;
  const textWidth = clamp(availableTextWidth, minTextWidth, preferredTextWidth);
  const layoutWidth = textWidth + gap + cardVisualWidth;
  const layoutLeft = Math.max(minOuterPad, (window.innerWidth - layoutWidth) / 2);

  return {
    layoutLeft,
    gap,
    textWidth,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getDeck3DFlightScale(baseWidth) {
  if (!baseWidth) return DECK3D_FLIGHT_SCALE;
  return Math.min(DECK3D_FLIGHT_SCALE, DECK3D_FLIGHT_TARGET_WIDTH / baseWidth);
}

function getActiveDeck3DFlightScale(baseWidth) {
  if (!activeDeck3DFlight) return getDeck3DFlightScale(baseWidth);
  const cssScale = parseFloat(activeDeck3DFlight.style.getPropertyValue('--deck3d-flight-scale'));
  return Number.isFinite(cssScale) && cssScale > 0 ? cssScale : getDeck3DFlightScale(baseWidth);
}

function getRevealCardTransformScale() {
  const match = String(d.dom.revealCard.style.transform || '').match(/scale\(([^)]+)\)/);
  const scale = match ? Number.parseFloat(match[1]) : NaN;
  return Number.isFinite(scale) && scale > 0 ? scale : DECK3D_FLIGHT_SCALE;
}

export function arcCard(el, dur, done) {
  let dropped = false;
  const t0 = performance.now();
  el.style.transition = 'none';
  el.style.zIndex = 20;
  (function frame(now){
    const raw = Math.min((now-t0)/dur, 1);
    const {dx,dy,rot} = lerpArc(smoothStep(raw));
    el.style.transform =
      `translate(calc(-50% + ${dx.toFixed(2)}px), calc(-50% + ${dy.toFixed(2)}px)) rotate(${rot.toFixed(2)}deg)`;
    if (!dropped && raw >= 0.78) { dropped=true; el.style.zIndex=-1; }
    raw < 1 ? requestAnimationFrame(frame) : done();
  })(t0);
}

export async function shuffleDeck() {
  if (STATE !== 'idle') return;

  await d.settleDeckToIdlePose();
  if (STATE !== 'idle') return;

  transition('shuffling');
  d.updateUI();

  d.dom.deckWrap.style.transition = [
    'transform 0.38s cubic-bezier(0.22,0.61,0.36,1)',
    'scale 0.38s cubic-bezier(0.22,0.61,0.36,1)',
    'translate 0.38s cubic-bezier(0.22,0.61,0.36,1)',
  ].join(', ');
  d.dom.deckWrap.style.scale = String(d.START_DECK_SCALE);
  d.dom.deckWrap.style.translate = '0px 0px';
  d.dom.deckWrap.style.transform  = 'scale(1.035) translateY(-6px)';

  const DUR = d.SHUFFLE_TIMING.cardDuration;
  const OVL = d.SHUFFLE_TIMING.overlap;
  const offsets = [0, DUR-OVL, (DUR-OVL)*2, (DUR-OVL)*3];
  let settled = 0;

  offsets.forEach(offset => {
    setTimeout(() => {
      let zo = d.getZOrder();
      const topIdx = zo[3];
      const card   = d.dom.stackCards[topIdx];

      zo = [zo[3], zo[0], zo[1], zo[2]];
      d.setZOrder(zo);

      for (let li = 0; li < 3; li++) d.setLayer(d.dom.stackCards[zo[li+1]], li+1, true);

      arcCard(card, DUR, () => {
        d.setLayer(card, 0, true);
        settled++;

        if (settled === 4) {
          d.setShuffleButtonBusy(false);

          d.snapDeck();

          requestAnimationFrame(() => {
            d.dom.deckWrap.style.transition = 'transform 0.52s cubic-bezier(0.22,0.61,0.36,1)';
            d.dom.deckWrap.style.transform  = 'scale(1) translateY(0px)';

            d.dom.deckWrap.addEventListener('transitionend', function onDone() {
              d.dom.deckWrap.removeEventListener('transitionend', onDone);
              d.dom.deckWrap.style.transition = '';
              d.dom.deckWrap.style.transform  = '';
              d.clearDeckInlineMotion();
              d.fanOutDeckFromStack(); // восстанавливает hover-позиции и снимает inline --deck-hover-progress
              transition('idle');
              d.updateUI();
            }, { once: true });
          });
        }
      });
    }, offset);
  });
}

export async function startDrawing() {
  if (STATE !== 'idle') return;
  activeResultRect = null;

  await d.prepareMobileTilt();
  if (STATE !== 'idle') return;

  if (USE_DECK3D_DRAW_EXPERIMENT) {
    runDeck3DDrawExperiment();
    return;
  }

  createDeck3DFlightShell();
  d.freezeDeckIdleMotion();

  transition('drawing');
  d.clearCardZoomState();
  d.clearStartInlineMotion();
  d.updateUI();

  d.setCurrent(d.pickCard());
  d.setCurrentReading(d.createReadingDraft(d.getCurrent()));
  d.resetInterpretation();

  d.setCardFace(d.getCurrent());
  const cardFaceReady = d.waitForCardFaceImage(d.getCurrent(), 1800);
  d.renderResultContent(d.getCurrent());

  d.dom.resultCardName.textContent = d.getCurrentInterpretationName();
  d.dom.resultText.textContent     = d.getCurrentInterpretationText();

  d.dom.rcInner.style.transition = 'none';
  d.dom.rcInner.style.transform  = 'rotateY(0deg)';
  d.dom.revealCard.style.transition = 'none';
  d.dom.revealCard.style.opacity    = '0';

  d.hideResultElsImmediately();
  d.syncCurrentShareAvailability();
  d.dom.resultOverlay.style.pointerEvents = 'none';

  runSequence([
    [d.DRAW_TIMING.deckLift, () => {
      flyDeck3DFlightToCenter();

      d.gatherDeckToStack(true);
      d.dom.deckWrap.style.transition = [
        'transform 0.55s cubic-bezier(0.22,0.61,0.36,1)',
        'scale 0.55s cubic-bezier(0.22,0.61,0.36,1)',
        'translate 0.55s cubic-bezier(0.22,0.61,0.36,1)',
      ].join(', ');
      d.dom.deckWrap.style.scale = String(d.START_DECK_SCALE);
      d.dom.deckWrap.style.translate = '0px 0px';
      d.dom.deckWrap.style.transform  = 'scale(1.04) translateY(-14px)';
    }],
    [d.DRAW_TIMING.revealFromDeck, () => {
      const wr = d.dom.deckWrap.getBoundingClientRect();
      d.dom.revealCard.style.left      = (wr.left + wr.width/2 - d.getRevealCardHalfWidth()) + 'px';
      d.dom.revealCard.style.top       = (wr.top  + wr.height/2 - d.getRevealCardHalfHeight()) + 'px';
      d.dom.revealCard.style.transform = 'translateY(10px) scale(0.92)';
      d.dom.revealCard.style.opacity   = '0';
      d.dom.revealCard.style.transition = 'none';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        d.dom.revealCard.style.transition = 'transform 0.62s cubic-bezier(0.22,0.61,0.36,1), opacity 0.4s ease';
        d.dom.revealCard.style.opacity    = '1';
        d.dom.revealCard.style.transform  = `translateY(-50px) scale(${d.START_DECK_SCALE})`;
      }));
    }],
    [d.DRAW_TIMING.moveToCenter, () => {
      d.dom.deckWrap.style.transition = [
        'transform 0.5s cubic-bezier(0.4,0,1,1)',
        'opacity 0.45s ease',
        'scale 0.5s cubic-bezier(0.4,0,1,1)',
        'translate 0.5s cubic-bezier(0.4,0,1,1)',
      ].join(', ');
      d.dom.deckWrap.style.scale = String(d.START_DECK_SCALE);
      d.dom.deckWrap.style.translate = '0px 0px';
      d.dom.deckWrap.style.transform  = 'scale(0.92) translateY(28px)';
      d.dom.deckWrap.style.opacity    = '0';

      const tTop  = d.getViewportTop() + d.getViewportHeight() / 2 - 140 + d.getDrawViewportNudge();
      const tLeft = window.innerWidth/2  - d.getRevealCardHalfWidth();
      d.dom.revealCard.style.transition = [
        'top 0.6s cubic-bezier(0.22,0.61,0.36,1)',
        'left 0.6s cubic-bezier(0.22,0.61,0.36,1)',
        'transform 0.6s cubic-bezier(0.22,0.61,0.36,1)',
      ].join(', ');
      d.dom.revealCard.style.top       = tTop  + 'px';
      d.dom.revealCard.style.left      = tLeft + 'px';
      d.dom.revealCard.style.transform = `translateY(0) scale(${d.START_DECK_SCALE})`;
    }],
    [d.DRAW_TIMING.settle, () => {
      d.dom.revealCard.style.transition = 'transform 0.3s ease';
      d.dom.revealCard.style.transform  = `scale(${d.START_DECK_SCALE})`;
    }],
    [d.DRAW_TIMING.flip, () => {
      d.dom.rcInner.style.transition = 'transform 0.75s cubic-bezier(0.22,0.61,0.36,1)';
      d.dom.rcInner.style.transform  = 'rotateY(180deg)';
    }],
    [d.DRAW_TIMING.liftResultCard, () => {
      const finalTop = d.getResultCardTop();
      d.dom.revealCard.style.transition = 'top 0.55s cubic-bezier(0.22,0.61,0.36,1)';
      d.dom.revealCard.style.top        = finalTop + 'px';
    }],
    ...d.RESULT_REVEAL_STEPS.map(({ id, step }) => [
      d.DRAW_TIMING.showResult + step * d.DRAW_TIMING.resultStagger,
      () => {
        if (window.__moraUseReactResult) return;
        const el = d.byId(id);
        el.style.transition = 'opacity 0.55s cubic-bezier(0.22,0.61,0.36,1), transform 0.55s cubic-bezier(0.22,0.61,0.36,1)';
        el.classList.add('visible');
      },
    ]),
    [d.DRAW_TIMING.finish, () => {
      cleanupDeck3DFlight();
      transition('result');
      d.syncResultShareAvailability();
      const draw = savePendingDraw();
      notifyDrawComplete(draw);
      if (!window.__moraUseReactResult) {
        d.dom.resultOverlay.style.pointerEvents = 'auto';
        d.updateCardZoomAvailability();
        if (d.canUseMobileTilt()) {
          d.startMobileTiltListening();
        }
      }
    }],
  ], () => STATE === 'drawing');
}

export function resetScene() {
  if (STATE !== 'result') return;
  cleanupDeck3DFlight();
  document.body.classList.remove('is-drawing-card');
  transition('resetting');
  d.clearCardZoomState();
  d.dom.resultOverlay.classList.add('is-returning-to-deck');
  d.dom.streetToggleBtn.classList.remove('is-label-out','is-label-in');
  d.dom.streetToggleBtn.disabled = true;
  d.dom.resultAgainBtn.disabled = true;

  d.dom.resultOverlay.style.pointerEvents = 'none';
  d.dom.resultEls.forEach(el => {
    el.style.transition = 'opacity 0.42s cubic-bezier(0.22,0.61,0.36,1), transform 0.42s cubic-bezier(0.22,0.61,0.36,1)';
    el.classList.remove('visible');
  });

  d.dom.startEls.forEach(el => {
    el.style.transition = 'none';
    el.style.opacity    = '';
    el.style.transform  = '';
    el.dataset.vis      = 'hidden';
    void el.offsetWidth;
  });

  runSequence([
    [d.RESET_TIMING.flipBack, () => {
      d.dom.rcInner.style.transition = 'transform 0.55s cubic-bezier(0.22,0.61,0.36,1)';
      d.dom.rcInner.style.transform = 'rotateY(0deg)';
    }],
    [d.RESET_TIMING.resultFade, () => {
      d.dom.deckWrap.style.transition = 'none';
      d.initDeck();
      d.gatherDeckToStack(false);
      d.dom.deckWrap.style.transform = '';
      d.clearDeckInlineMotion();
      d.dom.deckWrap.style.opacity = '0';
      void d.dom.deckWrap.offsetWidth;
    }],
    [d.RESET_TIMING.flyToDeck, () => {
      const wr = d.dom.deckWrap.getBoundingClientRect();
      d.dom.revealCard.style.transition = [
        'top 0.62s cubic-bezier(0.22,0.61,0.36,1)',
        'left 0.62s cubic-bezier(0.22,0.61,0.36,1)',
        'transform 0.62s cubic-bezier(0.22,0.61,0.36,1)',
      ].join(', ');
      d.dom.revealCard.style.top = (wr.top + wr.height / 2 - d.getRevealCardHalfHeight()) + 'px';
      d.dom.revealCard.style.left = (wr.left + wr.width / 2 - d.getRevealCardHalfWidth()) + 'px';
      d.dom.revealCard.style.transform = `translateY(0) scale(${d.RETURN_DECK_CARD_SCALE})`;
    }],
    [d.RESET_TIMING.crossfadeDeck, () => {
      d.dom.revealCard.style.transition = [
        'transform 0.64s cubic-bezier(0.22,0.61,0.36,1)',
        'opacity 0.64s ease',
      ].join(', ');
      d.dom.revealCard.style.transform = `translateY(0) scale(${d.RETURN_DECK_MERGE_SCALE})`;
      d.dom.revealCard.style.opacity = '0';

      d.dom.deckWrap.style.transition = 'opacity 0.64s ease';
      d.dom.deckWrap.style.opacity = '1';
      d.dom.deckWrap.style.transform = '';
      window.setTimeout(() => {
        if (STATE !== 'resetting') return;
        d.fanOutDeckFromStack();
      }, 260);
    }],
    [d.RESET_TIMING.showStart, () => {
      d.resetInterpretation();

      d.dom.startEls.forEach((el, i) => {
        setTimeout(() => {
          if (STATE !== 'resetting') return;
          el.style.transition = '';
          el.dataset.vis      = 'visible';
        }, i * d.RESET_TIMING.startStagger);
      });

      const lastStagger = (d.dom.startEls.length - 1) * d.RESET_TIMING.startStagger;
      setTimeout(() => {
        if (STATE !== 'resetting') return;
        d.dom.deckWrap.style.transition = '';
        d.dom.deckWrap.style.opacity    = '';
        d.dom.deckWrap.style.transform  = '';
        d.clearDeckInlineMotion();
        d.dom.revealCard.style.transition = '';
        d.dom.revealCard.style.transform = '';
        d.dom.revealCard.style.opacity   = '';
        d.dom.resultOverlay.classList.remove('is-returning-to-deck');
        transition('idle');
        d.updateUI();
      }, 520 + lastStagger);
    }],
  ], () => STATE === 'resetting');
}
