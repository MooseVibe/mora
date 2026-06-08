'use strict';
import { TAROT_CARDS } from './cards.js';
import { STATE, transition, resetState, runSequence } from './state.js';
import { IMAGE_LOAD_STATUS, getCachedImage, loadCardImage, wait, preloadCardImages } from './image-cache.js';
import { smoothStep, lerpArc } from './arc.js';
import { initLoader, scheduleAppLoaderStateTimers, startAppLoaderShuffle, settleInitialAppLoader, reloadFromAppLoader } from './loader.js';
import { initDraw, arcCard, shuffleDeck, startDrawing, resetScene } from './draw.js';
import {
  initGallery, hydrateCardBackEmblems,
  openDeckGallery, closeDeckGallery,
  showNextGalleryCard, showPrevGalleryCard,
  handleGalleryKeydown, handleGalleryTouchStart, handleGalleryTouchEnd,
  handleGalleryBackdropClick, handleGalleryCardClick,
  handleGalleryTiltMove, resetGalleryTilt,
  canUseMobileGalleryTilt, handleMobileGalleryOrientation,
} from './gallery.js';

(function() {

// ═══════════════════════════════════════
// DOM
// ═══════════════════════════════════════
const START_FU_IDS = ['startTitle','drawBtn']; // shuffleBtn убран с UI
const RESULT_EL_IDS = ['resultReadingPanel','resultCardName','resultText','resultAgainBtn'];
const RESULT_REVEAL_STEPS = [
  { id:'resultCardName', step:0 },
  { id:'resultText', step:1 },
  { id:'resultAgainBtn', step:2 },
];
const SHUFFLE_TIMING = {
  cardDuration: 520,
  overlap: 200,
};
const DRAW_TIMING = {
  deckLift: 300,
  revealFromDeck: 480,
  moveToCenter: 1020,
  settle: 1540,
  flip: 1620,
  liftResultCard: 2320,
  showResult: 2460,
  resultStagger: 130,
  finish: 3100,
};
const RESET_TIMING = {
  resultFade: 420,
  flipBack: 460,
  flyToDeck: 980,
  crossfadeDeck: 1600,
  showStart: 1840,
  startStagger: 55,
};
const INTERPRETATION_TIMING = {
  swapText: 430,
  finish: 980,
};
const GALLERY_TIMING = {
  fly: 940,
  flipStart: 900,
  flip: 620,
  spreadStart: 1500,
  reveal: 2360,
  switch: 160,
  closeHandoff: 360,
  closeFlipStart: 560,
  closeFlyStart: 1040,
  closeFanStart: 1580,
  closeShowStart: 1200,
  close: 2220,
};
const PARTICLE_TEXT = {
  sampleStep: 4,
  maxParticles: 1200,
};
const START_DECK_SCALE = 1.18;
const REVEAL_CARD_WIDTH = 150;
const CARD_ASPECT_WIDTH = 290;
const CARD_ASPECT_HEIGHT = 477;
const FORCE_CARD_ID = null; // set a card id, e.g. 'fool', to force a test draw
const CARD_ZOOM_MAX_SCALE = 2.2;
const RETURN_DECK_CARD_SCALE = 1.08;
const RETURN_DECK_MERGE_SCALE = 1.0;
const DAILY_DATE_DEBUG_PARAM = 'dailyDate';
const VARIANT_HISTORY_KEY = 'mora:variantHistory';

function byId(id) {
  return document.getElementById(id);
}

let cleanupFns = [];

function addManagedListener(target, type, handler, options) {
  if (!target) return;
  target.addEventListener(type, handler, options);
  cleanupFns.push(() => target.removeEventListener(type, handler, options));
}

function getVisualViewport() {
  return window.visualViewport || null;
}

function getViewportHeight() {
  const viewport = getVisualViewport();
  return viewport ? viewport.height : window.innerHeight;
}

function getViewportTop() {
  const viewport = getVisualViewport();
  return viewport ? viewport.offsetTop : 0;
}

function getResultViewportNudge() {
  return window.matchMedia('(max-width: 600px)').matches ? 42 : 0;
}

function getCenteredViewportNudge() {
  return 0;
}

function getDrawViewportNudge() {
  return window.matchMedia('(max-width: 600px)').matches ? 18 : 0;
}

function getRevealCardHeight() {
  return REVEAL_CARD_WIDTH * CARD_ASPECT_HEIGHT / CARD_ASPECT_WIDTH;
}

function getRevealCardHalfWidth() {
  return REVEAL_CARD_WIDTH / 2;
}

function getRevealCardHalfHeight() {
  return getRevealCardHeight() / 2;
}

function getCurrentRevealCardWidth() {
  return parseFloat(dom.revealCard.style.width) || REVEAL_CARD_WIDTH;
}

function getCurrentRevealCardHeight() {
  return getCurrentRevealCardWidth() * CARD_ASPECT_HEIGHT / CARD_ASPECT_WIDTH;
}

function getTransformScale(transform) {
  const match = String(transform || '').match(/scale\(([^)]+)\)/);
  return match ? Number.parseFloat(match[1]) || 1 : 1;
}

function getRevealCardBaseSize() {
  const rect = dom.revealCard.getBoundingClientRect();
  const scale = getTransformScale(dom.revealCard.style.transform);
  const width = rect.width && scale ? rect.width / scale : getCurrentRevealCardWidth();
  const height = rect.height && scale ? rect.height / scale : getCurrentRevealCardHeight();
  return { width, height };
}

function updateViewportVars() {
  const viewport = getVisualViewport();
  const height = viewport ? viewport.height : window.innerHeight;
  const offsetTop = viewport ? viewport.offsetTop : 0;

  document.documentElement.style.setProperty('--app-height', `${height}px`);
  document.documentElement.style.setProperty('--app-offset-top', `${offsetTop}px`);
}

let dom = null;

function collectDom() {
  return {
    appLoader: byId('appLoader'),
    appLoaderText: byId('appLoaderText'),
    appLoaderErrorTitle: byId('appLoaderErrorTitle'),
    appLoaderErrorText: byId('appLoaderErrorText'),
    appLoaderReload: byId('appLoaderReload'),
    siteHeader: byId('siteHeader'),
    stars: byId('stars'),
    deckWrap: byId('deckWrap'),
    revealCard: byId('revealCard'),
    rcInner: byId('rcInner'),
    rcFront: byId('rcFront'),
    rcTilt: byId('rcTilt'),
    rcArt: byId('rcArt'),
    rcSymbol: byId('rcSymbol'),
    rcNum: byId('rcNum'),
    resultOverlay: byId('resultOverlay'),
    resultReadingPanel: byId('resultReadingPanel'),
    resultReadingKicker: byId('resultReadingKicker'),
    resultReadingTitle: byId('resultReadingTitle'),
    resultReadingTags: byId('resultReadingTags'),
    resultReadingSections: byId('resultReadingSections'),
    resultReadingActions: byId('resultReadingActions'),
    resultStreetBtn: byId('resultStreetBtn'),
    resultCardName: byId('resultCardName'),
    resultText: byId('resultText'),
    streetToggleBtn: byId('streetToggleBtn'),
    drawBtn: byId('drawBtn'),
    shuffleBtn: byId('shuffleBtn'),
    resultAgainBtn: byId('resultAgainBtn'),
    deckGallery: byId('deckGallery'),
    galleryDeckGhost: byId('galleryDeckGhost'),
    galleryCardWrap: byId('galleryCardWrap'),
    galleryTrack: byId('galleryTrack'),
    galleryCardTitle: byId('galleryCardTitle'),
    galleryCardCounter: byId('galleryCardCounter'),
    galleryCloseBtn: byId('galleryCloseBtn'),
    galleryPrevBtn: byId('galleryPrevBtn'),
    galleryNextBtn: byId('galleryNextBtn'),
    startEls: START_FU_IDS.map(byId).filter(Boolean),
    resultEls: RESULT_EL_IDS.map(byId).filter(Boolean),
    stackCards: [0,1,2,3].map(i => byId('sc'+i)).filter(Boolean),
  };
}

// ═══════════════════════════════════════
// STARS
// ═══════════════════════════════════════
function initStars() {
  for (let i = 0; i < 42; i++) {
    const s = document.createElement('div');
    s.className = 'star-dot';
    s.style.left = Math.random() * 100 + '%';
    s.style.top  = Math.random() * 100 + '%';
    s.style.setProperty('--dur',   (2.5 + Math.random() * 4) + 's');
    s.style.setProperty('--delay', (Math.random() * 5) + 's');
    s.style.setProperty('--op',    (0.24 + Math.random() * 0.42).toFixed(2));
    s.style.setProperty('--star-size', (1.6 + Math.random() * 1.4).toFixed(2) + 'px');
    if (dom.stars) dom.stars.appendChild(s);
  }
}

// ═══════════════════════════════════════
// ДАННЫЕ КАРТ
// ═══════════════════════════════════════
const CARDS = TAROT_CARDS;
const REQUIRED_CARD_FIELDS = [
  'id',
  'name',
  'archetype',
  'character',
  'description',
  'streetName',
  'streetText',
  'visualHint',
  'num',
  'symbol',
];
let current = null;
const READING_MODE = Object.freeze({
  DAILY: 'daily',
  QUESTION: 'question',
});
const READING_TYPE = Object.freeze({
  ONE_CARD: 'one-card',
  THREE_CARD: 'three-card',
});
const INTERPRETATION_STYLE = Object.freeze({
  DEFAULT: 'default',
  STREET: 'street',
});
let currentReading = null;
let readingMode = READING_MODE.DAILY;
let readingType = READING_TYPE.ONE_CARD;
let interpretationStyle = INTERPRETATION_STYLE.DEFAULT;
let interpretationMode = 'poetic';
let isCardZoomed = false;
let resultPanelStreet = false;
let tiltFrame = null;
let cardZoomFrame = null;
let pendingTilt = { x: 0, y: 0 };
let mobileTiltEnabled = false;
let mobileTiltSupported = true;
let mobileTiltBaseline = null;
let mobileTiltSmoothed = { x: 0, y: 0 };
let mobileTiltListening = false;
let deckActionSettlePromise = null;

function validateCards(cards) {
  const errors = [];
  const seenIds = new Set();

  cards.forEach((card, index) => {
    const label = card && card.id ? card.id : `index ${index}`;

    REQUIRED_CARD_FIELDS.forEach(field => {
      if (!card || typeof card[field] !== 'string' || card[field].trim() === '') {
        errors.push(`${label}: missing ${field}`);
      }
    });

    if (card && typeof card.id === 'string') {
      if (seenIds.has(card.id)) {
        errors.push(`${card.id}: duplicate id`);
      }
      seenIds.add(card.id);
    }

    ['image', 'imageFallback'].forEach(field => {
      if (card && card[field] !== undefined && (typeof card[field] !== 'string' || card[field].trim() === '')) {
        errors.push(`${label}: invalid ${field}`);
      }
    });
  });

  if (errors.length) {
    throw new Error(`Invalid TAROT_CARDS:\n${errors.join('\n')}`);
  }
}

validateCards(CARDS);

function pickCard() {
  if (FORCE_CARD_ID) {
    const forcedCard = CARDS.find(card => card.id === FORCE_CARD_ID);
    if (!forcedCard) {
      throw new Error(`FORCE_CARD_ID not found: ${FORCE_CARD_ID}`);
    }
    return forcedCard;
  }

  const pool = current ? CARDS.filter(c => c !== current) : CARDS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getPoeticText(card) {
  return card.description || card.text;
}

function getDailyDateDebugValue() {
  if (typeof window === 'undefined' || !window.location) return '';
  const value = new URLSearchParams(window.location.search).get(DAILY_DATE_DEBUG_PARAM);
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : '';
}

function getDailySeedDate(date = new Date()) {
  const debugDate = getDailyDateDebugValue();
  if (debugDate) return debugDate;

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getCardDayVariantCount(card) {
  const variants = card?.result?.dayVariants;
  return Array.isArray(variants) && variants.length ? variants.length : 3;
}

function readVariantHistory() {
  try {
    const raw = localStorage.getItem(VARIANT_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function writeVariantHistory(history) {
  try {
    localStorage.setItem(VARIANT_HISTORY_KEY, JSON.stringify(history));
  } catch (_) {}
}

function chooseDailyVariantIndex(card) {
  const variantCount = getCardDayVariantCount(card);
  if (variantCount <= 1) return 0;

  const history = readVariantHistory();
  const cardHistory = Array.isArray(history[card.id])
    ? history[card.id].filter(idx => Number.isInteger(idx) && idx >= 0 && idx < variantCount)
    : [];
  const lastVariantIdx = cardHistory[0];
  const candidates = Array.from({ length: variantCount }, (_, idx) => idx)
    .filter(idx => idx !== lastVariantIdx);

  const scored = candidates.map(idx => ({
    idx,
    recency: cardHistory.indexOf(idx),
  }));
  const bestScore = Math.max(...scored.map(item => item.recency === -1 ? 999 : item.recency));
  const best = scored
    .filter(item => (item.recency === -1 ? 999 : item.recency) === bestScore)
    .map(item => item.idx);
  const chosen = best[Math.floor(Math.random() * best.length)];

  history[card.id] = [chosen, ...cardHistory.filter(idx => idx !== chosen)].slice(0, variantCount);
  writeVariantHistory(history);

  return chosen;
}

function pickDailyVariant(card, dateKey = getDailySeedDate()) {
  const variants = card && card.daily && Array.isArray(card.daily.variants)
    ? card.daily.variants
    : [];
  if (!variants.length) return null;

  return variants[hashString(`${dateKey}:${card.id}`) % variants.length];
}

function getInterpretation({ mode, cards, style }) {
  const card = cards && cards[0];
  if (!card) {
    return {
      title: '',
      text: '',
      meaning: '',
      advice: '',
      ifToday: '',
    };
  }

  const isStreet = style === INTERPRETATION_STYLE.STREET;
  const isDaily = mode === READING_MODE.DAILY;
  const dailyContent = isDaily && card.daily ? card.daily : null;
  const dailyVariant = isDaily ? pickDailyVariant(card) : null;
  const fallbackText = isStreet ? card.streetText : getPoeticText(card);
  const variantMeaning = dailyVariant
    ? (isStreet ? dailyVariant.streetMeaning : dailyVariant.meaning)
    : '';
  const variantAdvice = dailyVariant
    ? (isStreet ? dailyVariant.streetAdvice : dailyVariant.advice)
    : '';
  const variantIfToday = dailyVariant
    ? (isStreet ? dailyVariant.streetIfToday : dailyVariant.ifToday)
    : '';
  const text = variantMeaning || (dailyContent && dailyContent.meaning) || fallbackText;

  return {
    title: isStreet ? card.streetName : card.name,
    text,
    meaning: text,
    advice: variantAdvice || (dailyContent && dailyContent.advice) || '',
    ifToday: variantIfToday || (dailyContent && dailyContent.ifToday) || '',
    variant: dailyVariant || null,
  };
}

function getResultContent(card) {
  if (card && card.result) {
    const content = { ...card.result };
    const idx = (currentReading && currentReading.variantIdx !== undefined)
      ? currentReading.variantIdx
      : hashString(`${getDailySeedDate()}:${card.id}`) % 3;
    if (Array.isArray(content.dayVariants) && content.dayVariants.length) {
      content.dayMeaning = content.dayVariants[idx % content.dayVariants.length];
    }
    if (Array.isArray(content.streetVariants) && content.streetVariants.length) {
      content.streetMeaning = content.streetVariants[idx % content.streetVariants.length];
    }
    return content;
  }

  const cleanArchetype = (card.archetype || '')
    .split('/')
    .map(part => part.trim())
    .filter(Boolean)
    .join(', ');

  return {
    label:'Карта дня',
    title:card.name,
    titleMeta:cleanArchetype,
    tags:['Старший аркан'],
    meaningLabel:'Смысл карты дня',
    dayMeaning:[
      `Сегодня эта карта просит заметить тему “${cleanArchetype || card.name.toLowerCase()}” в конкретном деле.`,
      'Выбери один разговор, задачу или решение, где можно применить этот смысл уже сегодня.',
      'Карта не предсказывает спектакль на весь день, она подсвечивает действие, которое лучше не откладывать.',
    ],
  };
}

function renderResultContent(card) {
  const content = getResultContent(card);
  dom.resultReadingKicker.textContent = content.label || 'Смысл карты';
  dom.resultReadingTitle.textContent = '';
  const titleName = document.createElement('span');
  titleName.className = 'result-reading-title-name';
  titleName.textContent = content.title || card.name;
  dom.resultReadingTitle.appendChild(titleName);
  if (content.titleMeta) {
    const titleMeta = document.createElement('span');
    titleMeta.className = 'result-reading-title-meta';
    titleMeta.textContent = ` — ${content.titleMeta}`;
    dom.resultReadingTitle.appendChild(titleMeta);
  }
  renderResultTags(content.tags || ['Старший аркан']);
  dom.resultReadingSections.innerHTML = '';

  const item = document.createElement('section');
  item.className = 'result-reading-section result-reading-section--meaning';

  const title = document.createElement('h3');
  title.className = 'result-reading-section-title';
  title.textContent = content.meaningLabel || 'Смысл карты дня';

  const textWrap = document.createElement('div');
  textWrap.className = 'result-reading-section-text';
  const meaningParagraphs = normalizeMeaningParagraphs(content.dayMeaning || content.meaning || content.lead || card.description || '');
  meaningParagraphs.forEach(paragraph => {
    const p = document.createElement('p');
    p.className = 'result-reading-paragraph';
    p.textContent = paragraph;
    textWrap.appendChild(p);
  });

  item.append(title, textWrap);
  dom.resultReadingSections.appendChild(item);
}

function toggleResultPanelStreet() {
  if (STATE !== 'result' || !current) return;

  const content = getResultContent(current);
  resultPanelStreet = !resultPanelStreet;

  const paragraphs = normalizeMeaningParagraphs(
    resultPanelStreet
      ? (content.streetMeaning || content.dayMeaning)
      : content.dayMeaning
  );

  const textEl = dom.resultReadingSections.querySelector('.result-reading-section-text');
  if (!textEl) return;

  textEl.style.transition = 'opacity 0.18s ease';
  textEl.style.opacity = '0';
  dom.resultStreetBtn.textContent = resultPanelStreet ? 'Вернуть красиво' : 'Перевести на пацанский';

  setTimeout(() => {
    textEl.innerHTML = '';
    paragraphs.forEach((paragraph, index) => {
      if (index > 0) textEl.appendChild(document.createElement('br'));
      if (index > 0) textEl.appendChild(document.createElement('br'));
      textEl.appendChild(document.createTextNode(paragraph));
    });
    textEl.style.opacity = '1';
  }, 190);
}

function renderResultTags(tags) {
  dom.resultReadingTags.innerHTML = '';
  tags.map(tag => String(tag).trim()).filter(Boolean).forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'result-reading-tag';
    chip.textContent = tag;
    dom.resultReadingTags.appendChild(chip);
  });
}

function normalizeMeaningParagraphs(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean);
  }

  return String(value)
    .split(/\n{2,}/)
    .map(item => item.trim())
    .filter(Boolean);
}

function hasCardImage(card) {
  return Boolean(card && typeof card.image === 'string' && card.image.trim() !== '');
}

function setCardImageState(state) {
  dom.rcFront.classList.toggle('is-card-image-loading', state === IMAGE_LOAD_STATUS.LOADING);
  dom.rcFront.classList.toggle('is-card-image-ready', state === IMAGE_LOAD_STATUS.LOADED);
  dom.rcFront.classList.toggle('is-card-image-error', state === IMAGE_LOAD_STATUS.ERROR);
}

function showCardImageFallback(card) {
  dom.rcFront.classList.remove('has-card-image');
  setCardImageState(IMAGE_LOAD_STATUS.ERROR);
  dom.rcArt.removeAttribute('src');
  dom.rcArt.alt = '';
  dom.rcArt.hidden = true;
  dom.rcSymbol.textContent = card.symbol;
  dom.rcNum.textContent = card.num;
}

function loadCardFaceImage(card, src, fallbackSrc = '') {
  dom.rcArt.src = src;
  dom.rcArt.alt = card.name;
  dom.rcArt.decoding = 'async';
  dom.rcArt.hidden = false;

  const cached = getCachedImage(src);
  if (cached && cached.status === IMAGE_LOAD_STATUS.LOADED) {
    setCardImageState(IMAGE_LOAD_STATUS.LOADED);
    return;
  }

  setCardImageState(IMAGE_LOAD_STATUS.LOADING);
  loadCardImage(src)
    .then(() => {
      if (current === card && dom.rcArt.getAttribute('src') === src) {
        setCardImageState(IMAGE_LOAD_STATUS.LOADED);
      }
    })
    .catch(() => {
      if (current !== card || dom.rcArt.getAttribute('src') !== src) return;
      if (fallbackSrc && fallbackSrc !== src) {
        loadCardFaceImage(card, fallbackSrc);
        return;
      }
      showCardImageFallback(card);
    });
}

function setCardFace(card) {
  const hasImage = hasCardImage(card);
  dom.rcFront.classList.toggle('has-card-image', hasImage);
  setCardImageState(IMAGE_LOAD_STATUS.IDLE);

  if (hasImage) {
    loadCardFaceImage(card, card.image, card.imageFallback);
  } else {
    dom.rcArt.removeAttribute('src');
    dom.rcArt.alt = '';
    dom.rcArt.hidden = true;
  }

  dom.rcSymbol.textContent = card.symbol;
  dom.rcNum.textContent = card.num;
}

function getDeckHoverProgress() {
  const topCard = dom.stackCards[zOrder[3]] || dom.stackCards[dom.stackCards.length - 1];
  if (!topCard) return 0;

  const progress = Number.parseFloat(getComputedStyle(topCard).getPropertyValue('--deck-hover-progress'));
  return Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
}

function freezeDeckIdleMotion() {
  if (STATE !== 'idle') return;

  const deckStyle = getComputedStyle(dom.deckWrap);
  const scale = deckStyle.scale && deckStyle.scale !== 'none'
    ? deckStyle.scale
    : String(START_DECK_SCALE);
  const translate = deckStyle.translate && deckStyle.translate !== 'none'
    ? deckStyle.translate
    : '0px 0px';
  const hoverProgress = getDeckHoverProgress();

  dom.deckWrap.style.scale = scale;
  dom.deckWrap.style.translate = translate;
  dom.stackCards.forEach(card => {
    card.style.setProperty('--deck-hover-progress', hoverProgress.toFixed(4));
  });
}

function clearDeckInlineMotion() {
  dom.deckWrap.classList.remove('is-action-settling');
  dom.deckWrap.style.pointerEvents = '';
  dom.deckWrap.style.scale = '';
  dom.deckWrap.style.translate = '';
}

function settleDeckToIdlePose() {
  if (STATE !== 'idle') return Promise.resolve();
  if (deckActionSettlePromise) return deckActionSettlePromise;

  freezeDeckIdleMotion();
  dom.deckWrap.classList.add('is-action-settling');
  dom.deckWrap.style.pointerEvents = 'none';
  dom.drawBtn.disabled = true;
  if (dom.shuffleBtn) dom.shuffleBtn.disabled = true;

  void dom.deckWrap.offsetWidth;

  dom.deckWrap.style.transition = [
    'scale 0.28s cubic-bezier(0.22,0.61,0.36,1)',
    'translate 0.28s cubic-bezier(0.22,0.61,0.36,1)',
  ].join(', ');
  dom.deckWrap.style.scale = String(START_DECK_SCALE);
  dom.deckWrap.style.translate = '0px 0px';

  dom.stackCards.forEach(card => {
    card.style.transition = [
      '--deck-hover-progress 0.28s cubic-bezier(0.22,0.61,0.36,1)',
      'transform 0.28s cubic-bezier(0.22,0.61,0.36,1)',
      'background 0.28s ease',
    ].join(', ');
    card.style.setProperty('--deck-hover-progress', '0');
  });

  deckActionSettlePromise = new Promise(resolve => {
    window.setTimeout(() => {
      deckActionSettlePromise = null;
      if (STATE === 'idle') {
        dom.deckWrap.classList.remove('is-action-settling');
        dom.deckWrap.style.pointerEvents = '';
        dom.deckWrap.style.transition = '';
        dom.drawBtn.disabled = false;
        if (dom.shuffleBtn) dom.shuffleBtn.disabled = false;
      }
      resolve();
    }, 300);
  });

  return deckActionSettlePromise;
}

function getResultCardTop() {
  return getViewportTop() + getViewportHeight() / 2 - 308 + getResultViewportNudge();
}

function getCenteredCardLeft() {
  const viewport = getVisualViewport();
  const viewportLeft = viewport ? viewport.offsetLeft : 0;
  const viewportWidth = viewport ? viewport.width : window.innerWidth;
  return viewportLeft + viewportWidth / 2 - getCurrentRevealCardWidth() / 2;
}

function getZoomViewportTop() {
  const viewportTop = getViewportTop();
  const headerBottom = dom.siteHeader?.getBoundingClientRect().bottom || viewportTop;
  return Math.max(viewportTop, headerBottom);
}

function getCenteredCardTop() {
  const zoomTop = getZoomViewportTop();
  const viewportBottom = getViewportTop() + getViewportHeight();
  return zoomTop + (viewportBottom - zoomTop) / 2 - getCurrentRevealCardHeight() / 2 + getCenteredViewportNudge();
}

function getCardZoomScale() {
  const { width: cardW, height: cardH } = getRevealCardBaseSize();
  const viewport = getVisualViewport();
  const viewportWidth = viewport ? viewport.width : window.innerWidth;
  const widthScale = (viewportWidth - 48) / cardW;
  const heightScale = (getViewportTop() + getViewportHeight() - getZoomViewportTop() - 48) / cardH;
  return Math.max(START_DECK_SCALE, Math.min(CARD_ZOOM_MAX_SCALE, widthScale, heightScale));
}

function getZoomedCardPose() {
  const viewport = getVisualViewport();
  const viewportLeft = viewport ? viewport.offsetLeft : 0;
  const viewportWidth = viewport ? viewport.width : window.innerWidth;
  const workTop = getZoomViewportTop();
  const workBottom = getViewportTop() + getViewportHeight();
  const { width: baseW, height: baseH } = getRevealCardBaseSize();
  const scale = getCardZoomScale();
  const visualW = baseW * scale;
  const visualH = baseH * scale;
  const visualLeft = viewportLeft + (viewportWidth - visualW) / 2;
  const visualTop = workTop + (workBottom - workTop - visualH) / 2;

  return {
    top: `${visualTop + baseH * (scale - 1) / 2}px`,
    left: `${visualLeft + baseW * (scale - 1) / 2}px`,
    transform: `scale(${scale.toFixed(3)})`,
  };
}

function getInlineRevealCardPose() {
  return {
    top: dom.revealCard.style.top || `${dom.revealCard.getBoundingClientRect().top}px`,
    left: dom.revealCard.style.left || `${dom.revealCard.getBoundingClientRect().left}px`,
    transform: dom.revealCard.style.transform || 'scale(1)',
  };
}

function createRevealCardFlightClone(pose, baseSize) {
  const clone = dom.revealCard.cloneNode(true);
  clone.setAttribute('aria-hidden', 'true');
  clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
  clone.classList.add('reveal-card-flight-clone');
  clone.classList.remove('is-zoomable');
  clone.style.cssText = [
    'position:fixed',
    `left:${pose.left}`,
    `top:${pose.top}`,
    `width:${baseSize.width}px`,
    `height:${baseSize.height}px`,
    'aspect-ratio:var(--card-aspect)',
    'opacity:1',
    'visibility:visible',
    'pointer-events:none',
    `transform:${pose.transform}`,
    'transform-origin:center center',
    'transition:none',
    'z-index:75',
    'perspective:900px',
    `border-radius:${getComputedStyle(dom.revealCard).borderRadius}`,
  ].join(';');
  document.body.appendChild(clone);
  return clone;
}

function setRevealCardPose(pose) {
  dom.revealCard.style.top = pose.top;
  dom.revealCard.style.left = pose.left;
  dom.revealCard.style.transform = pose.transform;
}

function finishRevealCardCloneAnimation(clone, onDone) {
  clone.remove();
  dom.revealCard.style.visibility = '';
  onDone();
}

function animateRevealCardClone(firstPose, targetPose, baseSize, onDone) {
  const clone = createRevealCardFlightClone(firstPose, baseSize);
  void clone.offsetWidth;

  requestAnimationFrame(() => {
    dom.revealCard.style.visibility = 'hidden';

    const animation = clone.animate([
      {
        left:firstPose.left,
        top:firstPose.top,
        transform:firstPose.transform,
      },
      {
        left:targetPose.left,
        top:targetPose.top,
        transform:targetPose.transform,
      },
    ], {
      duration:820,
      easing:'cubic-bezier(0.19, 1, 0.22, 1)',
      fill:'forwards',
    });

    animation.onfinish = () => finishRevealCardCloneAnimation(clone, onDone);
    animation.oncancel = () => finishRevealCardCloneAnimation(clone, onDone);
  });
}

function updateCardZoomAvailability() {
  const canInteractWithResultCard = STATE === 'result' && hasCardImage(current);
  dom.revealCard.classList.toggle('is-zoomable', canInteractWithResultCard && isMobileTiltDevice());
  dom.revealCard.style.pointerEvents = canInteractWithResultCard ? 'auto' : 'none';
}

function isMobileTiltDevice() {
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

function canPrepareMobileTilt() {
  return isMobileTiltDevice()
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    && 'DeviceOrientationEvent' in window
    && mobileTiltSupported;
}

function canUseMobileTilt() {
  return canPrepareMobileTilt()
    && STATE === 'result'
    && hasCardImage(current)
    && mobileTiltEnabled;
}


function resetCardTilt(immediate = false) {
  if (tiltFrame !== null) {
    cancelAnimationFrame(tiltFrame);
    tiltFrame = null;
  }
  pendingTilt = { x: 0, y: 0 };
  mobileTiltBaseline = null;
  mobileTiltSmoothed = { x: 0, y: 0 };
  dom.rcTilt.classList.remove('is-tilting');
  if (immediate) {
    dom.rcTilt.style.transition = 'none';
  }
  dom.rcTilt.style.setProperty('--tilt-x', '0deg');
  dom.rcTilt.style.setProperty('--tilt-y', '0deg');
  dom.rcTilt.style.transform = '';
  if (immediate) {
    void dom.rcTilt.offsetWidth;
    dom.rcTilt.style.transition = '';
  }
}

function clearCardZoomState() {
  isCardZoomed = false;
  resetCardTilt();
  dom.resultOverlay.classList.remove('is-card-zoomed');
  dom.revealCard.classList.remove('is-zoomed');
  dom.revealCard.classList.remove('is-zoomable');
  dom.revealCard.style.pointerEvents = 'none';
}

function setCardZoom(zoomed, animated = true) {
  if (zoomed && !hasCardImage(current)) return;

  if (cardZoomFrame !== null) {
    cancelAnimationFrame(cardZoomFrame);
    cardZoomFrame = null;
  }

  const firstPose = getInlineRevealCardPose();
  const firstBaseSize = getRevealCardBaseSize();
  dom.revealCard.style.transition = 'none';
  dom.revealCard.style.transformOrigin = 'center center';

  isCardZoomed = zoomed;
  dom.resultOverlay.classList.toggle('is-card-zoomed', zoomed);
  dom.revealCard.classList.toggle('is-zoomed', zoomed);
  dom.revealCard.style.pointerEvents = 'auto';

  let targetTop;
  let targetLeft;
  let targetTransform;
  if (zoomed) {
    const zoomPose = getZoomedCardPose();
    targetTop = zoomPose.top;
    targetLeft = zoomPose.left;
    targetTransform = zoomPose.transform;
  } else {
    // Restore exact result position — origin stays center center, no jump
    const restoreTop   = dom.resultOverlay.style.getPropertyValue('--zoom-restore-top');
    const restoreLeft  = dom.resultOverlay.style.getPropertyValue('--zoom-restore-left');
    const restoreScale = dom.resultOverlay.style.getPropertyValue('--zoom-restore-scale');
    if (restoreTop) {
      targetTop = `${restoreTop}px`;
      targetLeft = `${restoreLeft}px`;
      targetTransform = `translateY(0) scale(${restoreScale})`;
    } else {
      targetTop = `${getResultCardTop()}px`;
      targetLeft = `${getCenteredCardLeft()}px`;
      targetTransform = `scale(${START_DECK_SCALE})`;
    }
  }

  const targetPose = {
    top: targetTop,
    left: targetLeft,
    transform: targetTransform,
  };

  if (animated && firstBaseSize.width > 0 && firstBaseSize.height > 0) {
    animateRevealCardClone(firstPose, targetPose, firstBaseSize, () => {
      cardZoomFrame = null;
    });
    setRevealCardPose(targetPose);
    resetCardTilt(true);
  } else {
    setRevealCardPose(targetPose);
    resetCardTilt(true);
    dom.revealCard.style.visibility = '';
    cardZoomFrame = null;
  }

  mobileTiltBaseline = null;
}

function toggleCardZoom() {
  if (STATE !== 'result' || !hasCardImage(current)) return;
  if (dom.streetToggleBtn.disabled || dom.resultAgainBtn.disabled) return;
  setCardZoom(!isCardZoomed);
}

function canTiltCard() {
  return STATE === 'result'
    && hasCardImage(current)
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

function clampTilt(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function applyCardTilt() {
  tiltFrame = null;
  const tiltX = `${pendingTilt.x.toFixed(2)}deg`;
  const tiltY = `${pendingTilt.y.toFixed(2)}deg`;
  dom.rcTilt.style.setProperty('--tilt-x', tiltX);
  dom.rcTilt.style.setProperty('--tilt-y', tiltY);
  dom.rcTilt.style.transform = `perspective(700px) rotateX(${tiltX}) rotateY(${tiltY})`;
}

function scheduleCardTiltApply() {
  if (tiltFrame !== null) {
    cancelAnimationFrame(tiltFrame);
  }
  const frame = requestAnimationFrame(applyCardTilt);
  tiltFrame = frame;
  window.setTimeout(() => {
    if (tiltFrame !== frame) return;
    cancelAnimationFrame(frame);
    applyCardTilt();
  }, 32);
}

function handleCardTiltMove(event) {
  if (!canTiltCard()) return;

  const rect = dom.revealCard.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
  const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
  const maxTilt = isCardZoomed ? 5.8 : 8.2;

  pendingTilt = {
    x: -y * maxTilt,
    y: x * maxTilt,
  };

  dom.rcTilt.classList.add('is-tilting');
  scheduleCardTiltApply();
}

function handleCardTiltLeave() {
  if (canUseMobileTilt()) return;
  resetCardTilt();
}

function handleMobileOrientation(event) {
  if (event.beta == null || event.gamma == null) return;

  if (canUseMobileGalleryTilt()) {
    handleMobileGalleryOrientation(event);
    return;
  }

  if (!canUseMobileTilt()) return;

  if (!mobileTiltBaseline) {
    mobileTiltBaseline = { beta: event.beta, gamma: event.gamma };
  }

  const maxTilt = isCardZoomed ? 6.5 : 8.6;
  const deadZone = 0.65;
  const betaDelta = event.beta - mobileTiltBaseline.beta;
  const gammaDelta = event.gamma - mobileTiltBaseline.gamma;
  const rawX = Math.abs(betaDelta) < deadZone ? 0 : clampTilt(-betaDelta * 0.62, -maxTilt, maxTilt);
  const rawY = Math.abs(gammaDelta) < deadZone ? 0 : clampTilt(gammaDelta * 0.74, -maxTilt, maxTilt);

  mobileTiltSmoothed = {
    x: mobileTiltSmoothed.x + (rawX - mobileTiltSmoothed.x) * 0.26,
    y: mobileTiltSmoothed.y + (rawY - mobileTiltSmoothed.y) * 0.26,
  };
  pendingTilt = mobileTiltSmoothed;

  dom.rcTilt.classList.add('is-tilting');
  scheduleCardTiltApply();
}

function startMobileTiltListening() {
  if (mobileTiltListening) return;
  window.addEventListener('deviceorientation', handleMobileOrientation, { passive: true });
  mobileTiltListening = true;
}

function stopMobileTiltListening() {
  if (!mobileTiltListening) return;
  window.removeEventListener('deviceorientation', handleMobileOrientation);
  mobileTiltListening = false;
}

async function prepareMobileTilt() {
  if (!canPrepareMobileTilt() || mobileTiltEnabled) return;

  try {
    const orientationEvent = window.DeviceOrientationEvent;
    if (orientationEvent && typeof orientationEvent.requestPermission === 'function') {
      const permission = await orientationEvent.requestPermission();
      if (permission !== 'granted') {
        mobileTiltSupported = false;
        return;
      }
    }

    mobileTiltEnabled = true;
    mobileTiltBaseline = null;
    mobileTiltSmoothed = { x: 0, y: 0 };
    if (canUseMobileTilt()) {
      startMobileTiltListening();
    }
  } catch {
    mobileTiltSupported = false;
  }
}

function closeCardZoomFromBackdrop(event) {
  if (STATE !== 'result' || !isCardZoomed) return;
  if (event.target.closest('#revealCard')) return;
  setCardZoom(false);
}

// Показать/скрыть fade-unit через data-vis
// Inline transition/opacity не трогаем — CSS управляет через data-vis
function setVis(el, visible) {
  if (!el) return;
  el.dataset.vis = visible ? 'visible' : 'hidden';
}

function hideResultElsImmediately() {
  resultPanelStreet = false;
  if (dom.resultStreetBtn) {
    dom.resultStreetBtn.textContent = 'Перевести на пацанский';
  }
  dom.resultEls.forEach(el => {
    el.style.transition = 'none';
    el.classList.remove('visible');
    void el.offsetWidth;
    el.style.transition = '';
  });
  // Reset mobile panel inline positioning
  dom.resultReadingPanel.style.top = '';
  dom.resultReadingPanel.style.bottom = '';
  dom.resultReadingPanel.style.maxHeight = '';
  // Clear zoom restore state
  dom.resultOverlay.style.removeProperty('--zoom-restore-top');
  dom.resultOverlay.style.removeProperty('--zoom-restore-left');
  dom.resultOverlay.style.removeProperty('--zoom-restore-scale');
  dom.resultText.classList.remove('is-transmuting');
  dom.streetToggleBtn.disabled = false;
}

function clearStartInlineMotion() {
  dom.startEls.forEach(el => {
    el.style.transition = '';
    el.style.opacity    = '';
    el.style.transform  = '';
  });
}

function syncInterpretationStyleFromMode() {
  interpretationStyle = interpretationMode === 'street'
    ? INTERPRETATION_STYLE.STREET
    : INTERPRETATION_STYLE.DEFAULT;

  if (currentReading) {
    currentReading.style = interpretationStyle;
    currentReading.interpretation = getInterpretation(currentReading);
  }
}

function createReadingDraft(card) {
  const reading = {
    mode: readingMode,
    spread: readingType,
    question: null,
    style: interpretationStyle,
    cards: [card],
    variantIdx: chooseDailyVariantIndex(card),
  };

  return {
    ...reading,
    interpretation: getInterpretation(reading),
  };
}

function resetInterpretation() {
  interpretationMode = 'poetic';
  syncInterpretationStyleFromMode();
  dom.streetToggleBtn.textContent = 'Перевести на пацанский';
  dom.streetToggleBtn.classList.remove('is-label-out','is-label-in');
  dom.streetToggleBtn.disabled = false;
  dom.resultAgainBtn.disabled = false;
  dom.resultOverlay.dataset.mode = 'poetic';
  dom.resultCardName.classList.remove('is-transmuting');
  dom.resultCardName.classList.remove('is-materializing');
  dom.resultText.classList.remove('is-transmuting');
  dom.resultText.classList.remove('is-materializing');
  dom.resultText.style.opacity = '';
  dom.resultText.style.transition = '';

  if (current) {
    dom.resultCardName.textContent = getCurrentInterpretationName();
    dom.resultText.textContent = getCurrentInterpretationText();
  }
}

function getCurrentInterpretationName() {
  if (currentReading && currentReading.interpretation) {
    return currentReading.interpretation.title;
  }

  return interpretationMode === 'street' ? current.streetName : current.name;
}

function getCurrentInterpretationText() {
  if (currentReading && currentReading.interpretation) {
    return currentReading.interpretation.text;
  }

  return interpretationMode === 'street' ? current.streetText : getPoeticText(current);
}

function updateResultMode() {
  dom.resultOverlay.dataset.mode = interpretationMode;
}

function swapStreetToggleLabel(label) {
  const btn = dom.streetToggleBtn;
  if (btn.textContent === label) return;

  btn.classList.remove('is-label-in');
  btn.classList.add('is-label-out');

  setTimeout(() => {
    btn.textContent = label;
    btn.classList.remove('is-label-out');
    btn.classList.add('is-label-in');
  }, 120);

  setTimeout(() => {
    btn.classList.remove('is-label-in');
  }, 300);
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function measureCanvasText(ctx, text, letterSpacing) {
  const chars = Array.from(text);
  if (!chars.length) return 0;
  const baseWidth = chars.reduce((sum, char) => sum + ctx.measureText(char).width, 0);
  return baseWidth + letterSpacing * Math.max(0, chars.length - 1);
}

function drawCanvasText(ctx, text, centerX, y, letterSpacing) {
  const chars = Array.from(text);
  const width = measureCanvasText(ctx, text, letterSpacing);
  let x = centerX - width / 2;

  chars.forEach(char => {
    ctx.fillText(char, x, y);
    x += ctx.measureText(char).width + letterSpacing;
  });
}

function wrapCanvasText(ctx, text, maxWidth, letterSpacing) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';

  words.forEach(word => {
    const next = line ? line + ' ' + word : word;
    if (line && measureCanvasText(ctx, next, letterSpacing) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });

  if (line) lines.push(line);
  return lines;
}

function createParticleText(text, metrics) {
  const dpr = metrics.dpr;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(metrics.width * dpr);
  canvas.height = Math.ceil(metrics.height * dpr);

  const ctx = canvas.getContext('2d', { willReadFrequently:true });
  ctx.scale(dpr, dpr);
  ctx.font = metrics.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = metrics.color;

  const lines = wrapCanvasText(ctx, text, metrics.textWidth, metrics.letterSpacing);
  const textHeight = lines.length * metrics.lineHeight;
  const startY = Math.max(0, (metrics.height - textHeight) / 2);

  lines.forEach((line, i) => {
    drawCanvasText(ctx, line, metrics.width / 2, startY + i * metrics.lineHeight, metrics.letterSpacing);
  });

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const particles = [];
  const step = PARTICLE_TEXT.sampleStep * dpr;

  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      const alpha = image[(Math.floor(y) * canvas.width + Math.floor(x)) * 4 + 3];
      if (alpha < 40) continue;
      particles.push({
        x:x / dpr,
        y:y / dpr,
        vx:(Math.random() - 0.45) * 120,
        vy:(Math.random() - 0.5) * 72,
        size:0.85 + Math.random() * 1.35,
        delay:Math.random() * 0.16,
      });
    }
  }

  if (particles.length <= PARTICLE_TEXT.maxParticles) return particles;
  const skip = particles.length / PARTICLE_TEXT.maxParticles;
  return particles.filter((_, i) => Math.floor(i % skip) === 0).slice(0, PARTICLE_TEXT.maxParticles);
}

function playTextParticleTransition(el, nextText, onSwap, onDone, options = {}) {
  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const fromText = el.textContent;
  const font = [style.fontStyle, style.fontWeight, style.fontSize, style.fontFamily].join(' ');
  const letterSpacing = Number.parseFloat(style.letterSpacing) || 0;
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  measureCtx.font = font;
  const targetWidth = options.expandWidth
    ? Math.max(
      rect.width,
      measureCanvasText(measureCtx, fromText, letterSpacing),
      measureCanvasText(measureCtx, nextText, letterSpacing)
    )
    : rect.width;
  const canvasPadding = options.canvasPadding ?? 80;
  const canvasWidth = targetWidth + canvasPadding * 2;
  const canvasHeight = rect.height;
  const metrics = {
    width:canvasWidth,
    textWidth:targetWidth,
    height:canvasHeight,
    lineHeight:parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.8,
    letterSpacing,
    color:style.color,
    font,
    dpr,
  };

  const oldParticles = createParticleText(fromText, metrics);
  const newParticles = createParticleText(nextText, metrics).map(p => ({
    ...p,
    sx:p.x + (Math.random() - 0.5) * 150,
    sy:p.y + (Math.random() - 0.5) * 92,
  }));

  const canvas = document.createElement('canvas');
  canvas.className = 'particle-text-canvas';
  canvas.style.left = (rect.left + rect.width / 2 - canvasWidth / 2) + 'px';
  canvas.style.top = rect.top + 'px';
  canvas.style.width = canvasWidth + 'px';
  canvas.style.height = canvasHeight + 'px';
  canvas.width = Math.ceil(canvasWidth * dpr);
  canvas.height = Math.ceil(canvasHeight * dpr);
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  el.style.transition = 'none';
  el.classList.add('is-transmuting');
  el.style.opacity = '0';

  let swapped = false;
  let revealedText = false;
  const start = performance.now();
  const duration = INTERPRETATION_TIMING.finish;

  function drawParticle(p, x, y, alpha, color) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }

  function frame(now) {
    const t = clamp01((now - start) / duration);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(201,169,110,0.5)';

    oldParticles.forEach(p => {
      const local = clamp01((t - p.delay) / 0.55);
      const e = easeOutCubic(local);
      const alpha = Math.max(0, 1 - local * 1.25);
      drawParticle(p, p.x + p.vx * e, p.y + p.vy * e, alpha, 'rgba(201,169,110,0.88)');
    });

    newParticles.forEach(p => {
      const local = clamp01((t - 0.34 - p.delay * 0.5) / 0.58);
      const e = easeInOutCubic(local);
      const fadeOut = clamp01((t - 0.76) / 0.24);
      const alpha = local * (1 - fadeOut);
      drawParticle(
        p,
        p.sx + (p.x - p.sx) * e,
        p.sy + (p.y - p.sy) * e,
        alpha,
        'rgba(240,230,211,0.82)'
      );
    });

    if (!swapped && now - start >= INTERPRETATION_TIMING.swapText) {
      swapped = true;
      onSwap();
    }

    if (!revealedText && t >= 0.76) {
      revealedText = true;
      el.classList.remove('is-transmuting');
      el.style.transition = '';
      el.style.opacity = '';
      el.classList.remove('is-materializing');
      void el.offsetWidth;
      el.classList.add('is-materializing');
    }

    if (t < 1) {
      requestAnimationFrame(frame);
      return;
    }

    canvas.style.transition = 'opacity 0.12s ease';
    canvas.style.opacity = '0';
    setTimeout(() => {
      canvas.remove();
      el.style.opacity = '';
      el.classList.remove('is-materializing');
      onDone();
    }, 120);
  }

  requestAnimationFrame(frame);
}

function toggleInterpretation() {
  if (STATE !== 'result' || !current || dom.streetToggleBtn.disabled) return;

  interpretationMode = interpretationMode === 'poetic' ? 'street' : 'poetic';
  syncInterpretationStyleFromMode();
  const nextName = getCurrentInterpretationName();
  const nextText = getCurrentInterpretationText();
  dom.streetToggleBtn.disabled = true;
  dom.resultAgainBtn.disabled = true;
  dom.resultCardName.classList.remove('is-transmuting');
  dom.resultCardName.classList.remove('is-materializing');
  dom.resultText.classList.remove('is-transmuting');
  dom.resultText.classList.remove('is-materializing');

  let finishedTransitions = 0;
  function finishToggle() {
    finishedTransitions++;
    if (finishedTransitions < 2) return;
    dom.streetToggleBtn.disabled = false;
    dom.resultAgainBtn.disabled = false;
  }

  playTextParticleTransition(dom.resultCardName, nextName, () => {
    dom.resultCardName.textContent = nextName;
  }, finishToggle, { expandWidth:true, canvasPadding:120 });

  playTextParticleTransition(dom.resultText, nextText, () => {
    dom.resultText.textContent = nextText;
    updateResultMode();
    swapStreetToggleLabel(interpretationMode === 'street'
      ? 'Вернуть красиво'
      : 'Перевести на пацанский');
  }, finishToggle);
}

// Главная функция обновления UI на основе state
function updateUI() {
  const isIdle      = STATE === 'idle';
  const isShuffling = STATE === 'shuffling';
  const isResult    = STATE === 'result';

  dom.deckWrap.dataset.state = STATE;

  // Стартовый UI: виден в idle И во время shuffle (колода анимируется, UI остаётся)
  const startVisible = isIdle || isShuffling;
  dom.startEls.forEach(el => setVis(el, startVisible));

  // Кнопки: не интерактивны во время анимации (через pointer-events в data-vis)
  // При shuffle отдельно блокируем кнопки, но не скрываем
  if (isShuffling) {
    dom.drawBtn.disabled    = true;
    if (dom.shuffleBtn) dom.shuffleBtn.disabled = true;
    setShuffleButtonBusy(true);
  } else if (isIdle) {
    dom.drawBtn.disabled    = false;
    if (dom.shuffleBtn) dom.shuffleBtn.disabled = false;
    setShuffleButtonBusy(false);
  }

  // Оверлей результата: pointer-events только в result
  dom.resultOverlay.style.pointerEvents = isResult ? 'auto' : 'none';
  if ((isResult || STATE === 'gallery') && mobileTiltEnabled) {
    startMobileTiltListening();
  } else if (!isResult && STATE !== 'gallery') {
    stopMobileTiltListening();
    resetCardTilt();
    resetGalleryTilt();
  }

  // Все result-el: если НЕ result — мгновенно убрать .visible
  if (!isResult) {
    hideResultElsImmediately();
  }
}

function setShuffleButtonBusy(isBusy) {
  if (!dom.shuffleBtn) return;
  dom.shuffleBtn.classList.toggle('is-shuffling', isBusy);
  dom.shuffleBtn.setAttribute('aria-label', isBusy ? 'Перетасовываем' : 'Перетасовать колоду');
}

function handleRevealCardClick() {
  if (STATE === 'result' && hasCardImage(current) && isMobileTiltDevice()) toggleCardZoom();
}

// ═══════════════════════════════════════
// КОЛОДА — слои карт
// ═══════════════════════════════════════
const LAYER = [
  { dx:9, dy:9, rot:3, bg:'var(--card-surface-layer-0)' }, // 0 — самая нижняя
  { dx:6, dy:6, rot:2, bg:'var(--card-surface-layer-1)' }, // 1
  { dx:3, dy:3, rot:1, bg:'var(--card-surface-layer-2)' }, // 2
  { dx:0, dy:0, rot:0, bg:'var(--card-surface-layer-3)' }, // 3 — верхняя
];
const HOVER_LAYER = [
  { dx:18, dy:11, rot:11 }, // нижняя карта раскрывается сильнее всего
  { dx:13, dy:8,  rot:7  },
  { dx:7,  dy:5,  rot:4  },
  { dx:0,  dy:0,  rot:0  }, // верхняя карта держит центр колоды
];
let zOrder = [0,1,2,3]; // zOrder[i] = индекс sc* на слое i

function setLayer(el, li, animated) {
  const p = LAYER[li];
  const h = HOVER_LAYER[li];
  el.style.zIndex     = li;
  el.style.background = p.bg;
  el.style.setProperty('--layer-dx', `${p.dx}px`);
  el.style.setProperty('--layer-dy', `${p.dy}px`);
  el.style.setProperty('--layer-rot', `${p.rot}deg`);
  el.style.setProperty('--hover-dx', `${h.dx}px`);
  el.style.setProperty('--hover-dy', `${h.dy}px`);
  el.style.setProperty('--hover-rot', `${h.rot}deg`);
  el.style.transition = animated
    ? 'transform 0.28s cubic-bezier(0.22,0.61,0.36,1), background 0.28s ease'
    : '';
  el.style.transform =
    'translate(calc(-50% + var(--layer-dx) + ((var(--hover-dx) - var(--layer-dx)) * var(--deck-hover-progress, 0))), calc(-50% + var(--layer-dy) + ((var(--hover-dy) - var(--layer-dy)) * var(--deck-hover-progress, 0)))) rotate(calc(var(--layer-rot) + ((var(--hover-rot) - var(--layer-rot)) * var(--deck-hover-progress, 0))))';
}

function initDeck() {
  zOrder = [0,1,2,3];
  dom.stackCards.forEach((el,i) => setLayer(el, i, false));
}

// Восстановить карты по текущему zOrder без сброса порядка
function snapDeck() {
  dom.stackCards.forEach((el,i) => setLayer(el, zOrder.indexOf(i), false));
}

function gatherDeckToStack(animated = true) {
  dom.stackCards.forEach(el => {
    el.style.transition = animated
      ? 'transform 0.42s cubic-bezier(0.16,1,0.3,1), background 0.28s ease'
      : '';
    el.style.setProperty('--layer-dx', '0px');
    el.style.setProperty('--layer-dy', '0px');
    el.style.setProperty('--layer-rot', '0deg');
    el.style.setProperty('--hover-dx', '0px');
    el.style.setProperty('--hover-dy', '0px');
    el.style.setProperty('--hover-rot', '0deg');
    el.style.setProperty('--deck-hover-progress', '0');
  });
}

function fanOutDeckFromStack() {
  dom.stackCards.forEach((el, i) => {
    const p = LAYER[zOrder.indexOf(i)];
    const h = HOVER_LAYER[zOrder.indexOf(i)];
    el.style.transition = 'transform 0.58s cubic-bezier(0.16,1,0.3,1), background 0.28s ease';
    el.style.background = p.bg;
    el.style.setProperty('--layer-dx', `${p.dx}px`);
    el.style.setProperty('--layer-dy', `${p.dy}px`);
    el.style.setProperty('--layer-rot', `${p.rot}deg`);
    el.style.setProperty('--hover-dx', `${h.dx}px`);
    el.style.setProperty('--hover-dy', `${h.dy}px`);
    el.style.setProperty('--hover-rot', `${h.rot}deg`);
    el.style.removeProperty('--deck-hover-progress');
  });
}

function bindEvents() {
  addManagedListener(dom.appLoaderReload, 'click', reloadFromAppLoader);
  // dom.deckWrap.addEventListener('click', openDeckGallery); // gallery временно отключена
  addManagedListener(dom.drawBtn, 'click', startDrawing);
  addManagedListener(dom.shuffleBtn, 'click', shuffleDeck);
  addManagedListener(dom.streetToggleBtn, 'click', toggleInterpretation);
  addManagedListener(dom.resultOverlay, 'click', closeCardZoomFromBackdrop);
  addManagedListener(dom.revealCard, 'click', handleRevealCardClick);
  addManagedListener(dom.revealCard, 'pointermove', handleCardTiltMove);
  addManagedListener(dom.revealCard, 'pointerleave', handleCardTiltLeave);
  addManagedListener(dom.resultAgainBtn, 'click', resetScene);
  addManagedListener(dom.resultStreetBtn, 'click', toggleResultPanelStreet);
  addManagedListener(dom.galleryCloseBtn, 'click', closeDeckGallery);
  addManagedListener(dom.galleryPrevBtn, 'click', showPrevGalleryCard);
  addManagedListener(dom.galleryNextBtn, 'click', showNextGalleryCard);
  addManagedListener(dom.deckGallery, 'click', handleGalleryBackdropClick);
  addManagedListener(dom.galleryTrack, 'click', handleGalleryCardClick);
  addManagedListener(dom.galleryTrack, 'pointermove', handleGalleryTiltMove);
  addManagedListener(dom.galleryTrack, 'pointerleave', resetGalleryTilt);
  addManagedListener(dom.deckGallery, 'touchstart', handleGalleryTouchStart, { passive:true });
  addManagedListener(dom.deckGallery, 'touchend', handleGalleryTouchEnd);
  addManagedListener(window, 'keydown', handleGalleryKeydown);
  addManagedListener(window, 'resize', updateViewportVars);

  const viewport = getVisualViewport();
  if (viewport) {
    addManagedListener(viewport, 'resize', updateViewportVars);
    addManagedListener(viewport, 'scroll', updateViewportVars);
  }
}

function cleanupApp() {
  cleanupFns.forEach(cleanup => cleanup());
  cleanupFns = [];
  stopMobileTiltListening();
  document.body.classList.remove('is-drawing-card');
  resetState('idle');
  current = null;
  currentReading = null;
  readingMode = READING_MODE.DAILY;
  readingType = READING_TYPE.ONE_CARD;
  interpretationStyle = INTERPRETATION_STYLE.DEFAULT;
  interpretationMode = 'poetic';
  isCardZoomed = false;
  resultPanelStreet = false;
  if (dom?.stars) dom.stars.replaceChildren();
  if (dom?.galleryTrack) dom.galleryTrack.replaceChildren();
}

function initApp() {
  cleanupApp();
  dom = collectDom();
  if (!dom.deckWrap || !dom.drawBtn || !dom.revealCard || !dom.resultOverlay) return false;
  initDraw(drawDeps);
  initGallery(galleryDeps);
  initLoader(dom, LAYER);
  updateViewportVars();
  initStars();
  initDeck();
  bindEvents();
  updateUI();
  scheduleAppLoaderStateTimers();
  startAppLoaderShuffle();
  settleInitialAppLoader();
  preloadCardImages();
  return true;
}

const drawDeps = {
  get dom() { return dom; },
  START_DECK_SCALE,
  SHUFFLE_TIMING,
  DRAW_TIMING,
  RESET_TIMING,
  RETURN_DECK_CARD_SCALE,
  RETURN_DECK_MERGE_SCALE,
  RESULT_REVEAL_STEPS,
  getCurrent: () => current,
  setCurrent: v => { current = v; },
  getCurrentReading: () => currentReading,
  setCurrentReading: v => { currentReading = v; },
  getZOrder: () => zOrder,
  setZOrder: v => { zOrder = v; },
  getRevealCardHalfWidth,
  getRevealCardHalfHeight,
  getViewportTop,
  getViewportHeight,
  getDrawViewportNudge,
  getResultCardTop,
  updateUI,
  setShuffleButtonBusy,
  hideResultElsImmediately,
  clearStartInlineMotion,
  byId,
  setLayer,
  gatherDeckToStack,
  fanOutDeckFromStack,
  initDeck,
  snapDeck,
  clearDeckInlineMotion,
  settleDeckToIdlePose,
  freezeDeckIdleMotion,
  pickCard,
  createReadingDraft,
  resetInterpretation,
  setCardFace,
  getCurrentInterpretationName,
  getCurrentInterpretationText,
  renderResultContent,
  updateCardZoomAvailability,
  clearCardZoomState,
  prepareMobileTilt,
  canUseMobileTilt,
  startMobileTiltListening,
};
const galleryDeps = {
  get dom() { return dom; },
  CARDS,
  GALLERY_TIMING,
  START_DECK_SCALE,
  LAYER,
  HOVER_LAYER,
  getZOrder: () => zOrder,
  getViewportTop,
  getViewportHeight,
  getDeckHoverProgress,
  hasCardImage,
  setVis,
  clearStartInlineMotion,
  hideResultElsImmediately,
  updateUI,
  prepareMobileTilt,
  canPrepareMobileTilt,
  getMobileTiltEnabled: () => mobileTiltEnabled,
  startMobileTiltListening,
  stopMobileTiltListening,
  clampTilt,
};
// ── Инициализация: убедиться что всё в правильном состоянии ──
window.__moraNativeApp = {
  init: initApp,
  cleanup: cleanupApp,
};
initApp();

})();
