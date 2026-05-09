'use strict';
import { STATE, transition } from './state.js';
import { loadCardImage } from './image-cache.js';

let g = null;

let mobileGalleryTiltBaseline = null;
let mobileGalleryTiltSmoothed = { x: 0, y: 0 };
let galleryIndex = 0;
let galleryTouchStartX = 0;
let galleryItems = [];
let galleryOpenTimer = null;
let galleryOpenFrame = null;
let galleryCloseTimer = null;
let galleryTiltFrame = null;
let pendingGalleryTilt = { x: 0, y: 0 };
let activeGalleryTiltCard = null;
let deckTransitionClone = null;
let deckTransitionCleanupTimer = null;
let deckTransitionGatherTimer = null;
let deckTransitionFlipTimer = null;

export function initGallery(deps) {
  g = deps;
  if (!g.dom.galleryTrack) {
    hydrateCardBackEmblems(document);
    return;
  }
  galleryItems = g.CARDS.map((card, index) => {
    const item = createGalleryCardItem(card, index);
    g.dom.galleryTrack.appendChild(item);
    return item;
  });
  hydrateCardBackEmblems(document);
}

// ─── Card back emblems ───────────────────────────────────────────────────────

function createCardBackEmblem() {
  const emblem = document.createElement('div');
  emblem.className = 'cardback-emblem';
  emblem.setAttribute('aria-hidden', 'true');
  return emblem;
}

function addCardBackEmblem(surface) {
  if (!surface) return;
  if (Array.from(surface.children).some(child => child.classList.contains('cardback-emblem'))) return;
  surface.appendChild(createCardBackEmblem());
}

export function hydrateCardBackEmblems(root = document) {
  root.querySelectorAll([
    '.scard',
    '#revealCard .rc-back',
    '.gallery-ghost-card',
    '.gallery-card-back',
    '.deck-close-card-back-side',
    '.deck-close-stack-layer',
  ].join(', ')).forEach(addCardBackEmblem);
}

// ─── Gallery layout helpers ──────────────────────────────────────────────────

function getCircularOffset(index, activeIndex) {
  const total = g.CARDS.length;
  const raw = index - activeIndex;
  if (raw > total / 2) return raw - total;
  if (raw < -total / 2) return raw + total;
  return raw;
}

function getGalleryCenterCardWidth() {
  if (window.innerWidth <= 600) {
    return Math.min(220, Math.max(160, window.innerWidth * 0.52));
  }
  return Math.min(290, Math.max(210, window.innerWidth * 0.2));
}

function measureGalleryCenterTarget() {
  const previousTransition = g.dom.galleryCardWrap.style.transition;
  g.dom.galleryCardWrap.style.transition = 'none';
  g.dom.deckGallery.classList.add('is-ready');

  const activeItem = g.dom.galleryTrack.querySelector('.gallery-card-item.is-active');
  const rect = activeItem
    ? activeItem.getBoundingClientRect()
    : { left: window.innerWidth / 2 - getGalleryCenterCardWidth() / 2, top: g.getViewportTop() + g.getViewportHeight() / 2, width: getGalleryCenterCardWidth(), height: 0 };

  const target = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    width: rect.width,
  };

  g.dom.deckGallery.classList.remove('is-ready');
  g.dom.galleryCardWrap.style.transition = previousTransition;
  return target;
}

// ─── Ghost / transition helpers ──────────────────────────────────────────────

function setGalleryGhostStartVars(progress, deckScale) {
  const ghostLayers = [
    { x:9 + 9 * progress, y:9 + 2 * progress, rot:3 + 8 * progress },
    { x:6 + 7 * progress, y:6 + 2 * progress, rot:2 + 5 * progress },
    { x:3 + 4 * progress, y:3 + 2 * progress, rot:1 + 3 * progress },
  ];

  ghostLayers.forEach((layer, index) => {
    g.dom.deckGallery.style.setProperty(`--gallery-ghost-${index}-x`, `${(layer.x * deckScale).toFixed(2)}px`);
    g.dom.deckGallery.style.setProperty(`--gallery-ghost-${index}-y`, `${(layer.y * deckScale).toFixed(2)}px`);
    g.dom.deckGallery.style.setProperty(`--gallery-ghost-${index}-rot`, `${layer.rot.toFixed(2)}deg`);
  });
}

function removeDeckTransitionClone() {
  window.clearTimeout(deckTransitionCleanupTimer);
  window.clearTimeout(deckTransitionGatherTimer);
  window.clearTimeout(deckTransitionFlipTimer);
  deckTransitionCleanupTimer = null;
  deckTransitionGatherTimer = null;
  deckTransitionFlipTimer = null;
  if (!deckTransitionClone) return;
  deckTransitionClone.remove();
  deckTransitionClone = null;
}

// ─── Deck transition clone (open) ────────────────────────────────────────────

function createDeckTransitionFace(card) {
  const face = document.createElement('div');
  face.className = 'deck-transition-face';

  if (g.hasCardImage(card)) {
    const img = document.createElement('img');
    img.className = 'deck-transition-face-image';
    img.alt = card.name;
    img.decoding = 'async';
    img.src = card.image;
    face.appendChild(img);
    loadCardImage(card.image).catch(() => {
      if (card.imageFallback) img.src = card.imageFallback;
    });
  } else {
    const fallback = document.createElement('div');
    fallback.className = 'deck-transition-face-fallback';
    fallback.textContent = card.symbol;
    face.appendChild(fallback);
  }

  return face;
}

function createDeckOpenFlipCard(card) {
  const inner = document.createElement('div');
  const backSide = document.createElement('div');
  const frontSide = document.createElement('div');

  inner.className = 'deck-open-card-inner';
  backSide.className = 'deck-open-card-side deck-open-card-back-side';
  frontSide.className = 'deck-open-card-side deck-open-card-front-side';
  addCardBackEmblem(backSide);

  if (g.hasCardImage(card)) {
    const img = document.createElement('img');
    img.className = 'deck-transition-face-image';
    img.alt = card.name;
    img.decoding = 'async';
    img.src = card.image;
    frontSide.appendChild(img);
    loadCardImage(card.image).catch(() => {
      if (card.imageFallback) img.src = card.imageFallback;
    });
  } else {
    const fallback = document.createElement('div');
    fallback.className = 'deck-transition-face-fallback';
    fallback.textContent = card.symbol;
    frontSide.appendChild(fallback);
  }

  inner.append(backSide, frontSide);
  return inner;
}

function createDeckTransitionClone(deckRect, topCardRect, hoverProgress, faceCard) {
  removeDeckTransitionClone();

  const clone = g.dom.deckWrap.cloneNode(true);
  clone.removeAttribute('id');
  clone.classList.add('deck-transition-clone');
  clone.dataset.state = 'idle';
  clone.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));

  clone.style.left = `${topCardRect.left + topCardRect.width / 2}px`;
  clone.style.top = `${topCardRect.top + topCardRect.height / 2}px`;
  clone.style.width = `${g.dom.deckWrap.offsetWidth}px`;
  clone.style.transition = 'none';
  clone.style.transform = `translate(-50%, -50%) scale(${(deckRect.width / g.dom.deckWrap.offsetWidth).toFixed(4)})`;

  clone.querySelectorAll('.scard').forEach(card => {
    card.style.setProperty('--deck-hover-progress', hoverProgress.toFixed(4));
  });
  clone.appendChild(createDeckOpenFlipCard(faceCard));

  document.body.appendChild(clone);
  deckTransitionClone = clone;
  return clone;
}

function animateDeckTransitionClone(clone, galleryTarget) {
  if (!clone) return;

  const zo = g.getZOrder();
  const topCard = g.dom.stackCards[zo[3]] || g.dom.stackCards[g.dom.stackCards.length - 1];
  const targetScale = galleryTarget.width / topCard.offsetWidth;
  const targetTransform = `translate(-50%, -50%) scale(${targetScale.toFixed(4)})`;
  const openBorderWidth = targetScale > 0 ? g.START_DECK_SCALE / targetScale : 1;

  clone.style.transition = [
    `left ${g.GALLERY_TIMING.fly}ms cubic-bezier(0.18, 0.84, 0.28, 1)`,
    `top ${g.GALLERY_TIMING.fly}ms cubic-bezier(0.18, 0.84, 0.28, 1)`,
    `transform ${g.GALLERY_TIMING.fly}ms cubic-bezier(0.18, 0.84, 0.28, 1)`,
    'opacity 0.18s ease',
  ].join(', ');
  clone.style.left = `${galleryTarget.x}px`;
  clone.style.top = `${galleryTarget.y}px`;
  clone.style.transform = targetTransform;
  clone.dataset.flipBaseTransform = targetTransform;
  clone.style.setProperty('--deck-open-border-width', `${openBorderWidth.toFixed(3)}px`);
  clone.classList.add('is-flying-gallery');

  window.clearTimeout(deckTransitionGatherTimer);
  deckTransitionGatherTimer = window.setTimeout(() => {
    gatherDeckTransitionClone(clone);
  }, 110);
}

function gatherDeckTransitionClone(clone) {
  if (!clone || clone !== deckTransitionClone) return;

  clone.querySelectorAll('.scard').forEach(card => {
    card.style.setProperty('--layer-dx', '0px');
    card.style.setProperty('--layer-dy', '0px');
    card.style.setProperty('--layer-rot', '0deg');
    card.style.setProperty('--hover-dx', '0px');
    card.style.setProperty('--hover-dy', '0px');
    card.style.setProperty('--hover-rot', '0deg');
    card.style.setProperty('--deck-hover-progress', '0');
  });
}

function flipDeckTransitionClone(clone) {
  if (!clone || clone !== deckTransitionClone) return;
  clone.style.transition = 'opacity 0.18s ease';
  clone.classList.add('is-flipping');
}

// ─── Gallery close transition ────────────────────────────────────────────────

function flipGalleryCloseCloneBack(clone) {
  if (!clone || clone !== deckTransitionClone) return;
  clone.style.transition = 'opacity 0.18s ease';
  clone.classList.add('is-flipping-back');
}

function flyGalleryCloseCloneHome(clone) {
  if (!clone || clone !== deckTransitionClone) return;

  const zo = g.getZOrder();
  const topCard = g.dom.stackCards[zo[3]] || g.dom.stackCards[g.dom.stackCards.length - 1];
  if (!topCard) return;

  const rect = topCard.getBoundingClientRect();
  const cloneRect = clone.getBoundingClientRect();
  const targetScale = cloneRect.width > 0 ? rect.width / cloneRect.width : 1;
  const fanScaleCompensation = targetScale > 0 ? g.START_DECK_SCALE / targetScale : 1;
  const homeBorderWidth = targetScale > 0 ? g.START_DECK_SCALE / targetScale : 1;

  clone.style.transition = [
    'left 0.58s cubic-bezier(0.22,0.61,0.36,1)',
    'top 0.58s cubic-bezier(0.22,0.61,0.36,1)',
    'transform 0.58s cubic-bezier(0.22,0.61,0.36,1)',
    'opacity 0.18s ease',
  ].join(', ');
  clone.style.left = `${rect.left + rect.width / 2}px`;
  clone.style.top = `${rect.top + rect.height / 2}px`;
  clone.style.transform = `translate(-50%, -50%) scale(${targetScale.toFixed(4)})`;
  clone.style.setProperty('--home-fan-scale-comp', fanScaleCompensation.toFixed(4));
  clone.style.setProperty('--deck-close-home-border-width', `${homeBorderWidth.toFixed(3)}px`);
  clone.style.setProperty('--card-radius', `${(14 * fanScaleCompensation).toFixed(3)}px`);
  clone.style.setProperty('--card-art-padding', `${(6 * fanScaleCompensation).toFixed(3)}px`);
  clone.style.setProperty('--card-art-radius', `${(8 * fanScaleCompensation).toFixed(3)}px`);
  clone.style.setProperty('--card-inner-border-inset', `${(6 * fanScaleCompensation).toFixed(3)}px`);
  clone.style.setProperty('--card-inner-border-radius', `${(8 * fanScaleCompensation).toFixed(3)}px`);
  clone.classList.add('is-flying-home');
}

function createGalleryCloseHandoffClone() {
  const activeCardEl = g.dom.galleryTrack.querySelector('.gallery-card-item.is-active .gallery-card');
  if (!activeCardEl) return null;

  const rect = activeCardEl.getBoundingClientRect();
  const activeCardStyle = getComputedStyle(activeCardEl);
  const clone = document.createElement('div');
  const inner = document.createElement('div');
  const frontSide = document.createElement('div');
  const backSide = document.createElement('div');
  const activeFront = activeCardEl.querySelector('.gallery-card-front');
  const frontContent = activeFront ? activeFront.cloneNode(true) : document.createElement('div');
  const backFrame = document.createElement('div');
  const stackLayers = [0, 1, 2].map(index => {
    const layer = document.createElement('div');
    layer.className = `deck-close-stack-layer deck-close-stack-layer-${index}`;
    return layer;
  });

  clone.className = 'deck-transition-clone deck-close-transition-card';
  inner.className = 'deck-close-card-inner';
  frontSide.className = 'deck-close-card-side deck-close-card-front-side';
  backSide.className = 'deck-close-card-side deck-close-card-back-side';
  frontContent.classList.add('deck-close-card-front-content');
  backFrame.className = 'deck-close-card-back-frame';
  addCardBackEmblem(backSide);
  stackLayers.forEach(addCardBackEmblem);

  clone.style.left = `${rect.left + rect.width / 2}px`;
  clone.style.top = `${rect.top + rect.height / 2}px`;
  clone.style.width = `${rect.width}px`;
  clone.style.transition = 'none';
  clone.style.transform = 'translate(-50%, -50%)';
  clone.style.opacity = '1';
  clone.dataset.flipBaseTransform = clone.style.transform;

  [
    '--card-radius',
    '--card-art-padding',
    '--card-art-radius',
    '--card-border',
    '--card-bg',
    '--card-shadow',
    '--card-inner-border-color',
  ].forEach(prop => {
    const value = activeCardStyle.getPropertyValue(prop);
    if (value) clone.style.setProperty(prop, value.trim());
  });
  const activeArtPadding = activeCardStyle.getPropertyValue('--card-art-padding').trim();
  const activeArtRadius = activeCardStyle.getPropertyValue('--card-art-radius').trim();
  if (activeArtPadding) clone.style.setProperty('--card-inner-border-inset', activeArtPadding);
  if (activeArtRadius) clone.style.setProperty('--card-inner-border-radius', activeArtRadius);

  frontSide.appendChild(frontContent);
  backSide.appendChild(backFrame);
  inner.append(frontSide, backSide);
  stackLayers.forEach(layer => clone.appendChild(layer));
  clone.appendChild(inner);

  document.body.appendChild(clone);
  deckTransitionClone = clone;
  return clone;
}

function createGalleryCloseHomeDeckClone(sourceClone) {
  const zo = g.getZOrder();
  const topCard = g.dom.stackCards[zo[3]] || g.dom.stackCards[g.dom.stackCards.length - 1];
  if (!topCard) return null;

  const rect = topCard.getBoundingClientRect();
  const homeClone = g.dom.deckWrap.cloneNode(true);
  homeClone.removeAttribute('id');
  homeClone.className = 'deck-transition-clone deck-close-home-deck-clone';
  homeClone.dataset.state = 'idle';
  homeClone.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));

  homeClone.style.left = `${rect.left + rect.width / 2}px`;
  homeClone.style.top = `${rect.top + rect.height / 2}px`;
  homeClone.style.width = `${g.dom.deckWrap.offsetWidth}px`;
  homeClone.style.transition = 'none';
  homeClone.style.transform = `translate(-50%, -50%) scale(${g.START_DECK_SCALE})`;
  homeClone.style.opacity = '1';

  const cards = Array.from(homeClone.querySelectorAll('.scard'));
  cards.forEach((card, index) => {
    const layerIndex = zo.indexOf(index);
    const p = g.LAYER[layerIndex] || g.LAYER[index] || g.LAYER[0];
    card.style.zIndex = layerIndex;
    card.style.background = p.bg;
    card.style.transition = 'transform 0.42s cubic-bezier(0.22,0.61,0.36,1), background 0.28s ease';
    card.style.setProperty('--layer-dx', '0px');
    card.style.setProperty('--layer-dy', '0px');
    card.style.setProperty('--layer-rot', '0deg');
    card.style.setProperty('--hover-dx', '0px');
    card.style.setProperty('--hover-dy', '0px');
    card.style.setProperty('--hover-rot', '0deg');
    card.style.setProperty('--deck-hover-progress', '0');
  });

  document.body.appendChild(homeClone);
  if (sourceClone) sourceClone.remove();
  deckTransitionClone = homeClone;

  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (STATE !== 'galleryClosing' || deckTransitionClone !== homeClone) return;
    const currentZo = g.getZOrder();
    cards.forEach((card, index) => {
      const layerIndex = currentZo.indexOf(index);
      const p = g.LAYER[layerIndex] || g.LAYER[index] || g.LAYER[0];
      const h = g.HOVER_LAYER[layerIndex] || g.HOVER_LAYER[index] || g.HOVER_LAYER[0];
      card.style.background = p.bg;
      card.style.setProperty('--layer-dx', `${p.dx}px`);
      card.style.setProperty('--layer-dy', `${p.dy}px`);
      card.style.setProperty('--layer-rot', `${p.rot}deg`);
      card.style.setProperty('--hover-dx', `${h.dx}px`);
      card.style.setProperty('--hover-dy', `${h.dy}px`);
      card.style.setProperty('--hover-rot', `${h.rot}deg`);
    });
  }));

  return homeClone;
}

function fanOutGalleryCloseClone(clone) {
  if (!clone || clone !== deckTransitionClone) return;
  createGalleryCloseHomeDeckClone(clone);
}

// ─── Gallery card item ───────────────────────────────────────────────────────

function createGalleryCardItem(card, index) {
  const item = document.createElement('div');
  item.className = 'gallery-card-item';
  item.dataset.index = String(index);

  const cardEl = document.createElement('div');
  cardEl.className = 'gallery-card';

  const back = document.createElement('div');
  back.className = 'gallery-card-back';
  addCardBackEmblem(back);

  const front = document.createElement('div');
  front.className = 'gallery-card-front';

  if (g.hasCardImage(card)) {
    const img = document.createElement('img');
    img.className = 'gallery-card-image';
    img.alt = card.name;
    img.decoding = 'async';
    img.src = card.image;
    front.appendChild(img);
    loadCardImage(card.image).catch(() => {
      if (card.imageFallback) img.src = card.imageFallback;
    });
  } else {
    const fallback = document.createElement('div');
    fallback.className = 'gallery-card-fallback';
    fallback.textContent = card.symbol;
    front.appendChild(fallback);
  }

  cardEl.appendChild(back);
  cardEl.appendChild(front);
  item.appendChild(cardEl);
  return item;
}

// ─── Gallery navigation ──────────────────────────────────────────────────────

export function setGalleryCard(index) {
  resetGalleryTilt();
  const total = g.CARDS.length;
  galleryIndex = (index + total) % total;
  const activeCard = g.CARDS[galleryIndex];

  g.dom.galleryCardTitle.textContent = activeCard.name;
  g.dom.galleryCardCounter.textContent = `${String(galleryIndex + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;

  galleryItems.forEach((item, itemIndex) => {
    const offset = getCircularOffset(itemIndex, galleryIndex);
    const boundedOffset = Math.max(-3, Math.min(3, offset));

    item.dataset.offset = String(boundedOffset);
    item.classList.toggle('is-visible', Math.abs(offset) <= 2);
    item.classList.toggle('is-active', offset === 0);
    item.classList.toggle('is-side', Math.abs(offset) === 1);
    item.classList.toggle('is-far', Math.abs(offset) === 2);
  });
}

export function showNextGalleryCard() {
  if (STATE !== 'gallery') return;
  setGalleryCard(galleryIndex + 1);
}

export function showPrevGalleryCard() {
  if (STATE !== 'gallery') return;
  setGalleryCard(galleryIndex - 1);
}

// ─── Gallery tilt ────────────────────────────────────────────────────────────

export function resetGalleryTilt() {
  if (galleryTiltFrame) {
    cancelAnimationFrame(galleryTiltFrame);
    galleryTiltFrame = null;
  }

  if (activeGalleryTiltCard) {
    activeGalleryTiltCard.classList.remove('is-tilting');
    activeGalleryTiltCard.style.setProperty('--gallery-tilt-x', '0deg');
    activeGalleryTiltCard.style.setProperty('--gallery-tilt-y', '0deg');
    activeGalleryTiltCard.style.transform = '';
  }

  activeGalleryTiltCard = null;
  pendingGalleryTilt = { x: 0, y: 0 };
  mobileGalleryTiltBaseline = null;
  mobileGalleryTiltSmoothed = { x: 0, y: 0 };
}

export function canUseMobileGalleryTilt() {
  return g.canPrepareMobileTilt()
    && STATE === 'gallery'
    && g.dom.deckGallery.classList.contains('is-ready')
    && g.getMobileTiltEnabled();
}

export function handleMobileGalleryOrientation(event) {
  const card = getActiveGalleryCard();
  if (!card) return;

  if (activeGalleryTiltCard && activeGalleryTiltCard !== card) {
    resetGalleryTilt();
  }

  if (!mobileGalleryTiltBaseline) {
    mobileGalleryTiltBaseline = { beta: event.beta, gamma: event.gamma };
  }

  const maxTilt = 7.2;
  const deadZone = 0.7;
  const betaDelta = event.beta - mobileGalleryTiltBaseline.beta;
  const gammaDelta = event.gamma - mobileGalleryTiltBaseline.gamma;
  const rawX = Math.abs(betaDelta) < deadZone ? 0 : g.clampTilt(-betaDelta * 0.52, -maxTilt, maxTilt);
  const rawY = Math.abs(gammaDelta) < deadZone ? 0 : g.clampTilt(gammaDelta * 0.64, -maxTilt, maxTilt);

  mobileGalleryTiltSmoothed = {
    x: mobileGalleryTiltSmoothed.x + (rawX - mobileGalleryTiltSmoothed.x) * 0.24,
    y: mobileGalleryTiltSmoothed.y + (rawY - mobileGalleryTiltSmoothed.y) * 0.24,
  };

  activeGalleryTiltCard = card;
  pendingGalleryTilt = mobileGalleryTiltSmoothed;
  activeGalleryTiltCard.classList.add('is-tilting');
  scheduleGalleryTiltApply();
}

function canTiltGalleryCard(event) {
  return STATE === 'gallery'
    && event.pointerType !== 'touch'
    && g.dom.deckGallery.classList.contains('is-ready');
}

function applyGalleryTilt() {
  galleryTiltFrame = null;
  if (!activeGalleryTiltCard) return;

  const tiltX = `${pendingGalleryTilt.x.toFixed(2)}deg`;
  const tiltY = `${pendingGalleryTilt.y.toFixed(2)}deg`;
  activeGalleryTiltCard.style.setProperty('--gallery-tilt-x', tiltX);
  activeGalleryTiltCard.style.setProperty('--gallery-tilt-y', tiltY);
  activeGalleryTiltCard.style.transform = `perspective(760px) rotateX(${tiltX}) rotateY(${tiltY})`;
}

function scheduleGalleryTiltApply() {
  if (galleryTiltFrame !== null) {
    cancelAnimationFrame(galleryTiltFrame);
  }
  const frame = requestAnimationFrame(applyGalleryTilt);
  galleryTiltFrame = frame;
  window.setTimeout(() => {
    if (galleryTiltFrame !== frame) return;
    cancelAnimationFrame(frame);
    applyGalleryTilt();
  }, 32);
}

function getActiveGalleryCard() {
  const activeItem = g.dom.galleryTrack.querySelector('.gallery-card-item.is-active');
  return activeItem ? activeItem.querySelector('.gallery-card') : null;
}

export function handleGalleryTiltMove(event) {
  if (!canTiltGalleryCard(event)) return;

  const activeItem = event.target.closest('.gallery-card-item.is-active');
  if (!activeItem || !g.dom.galleryTrack.contains(activeItem)) {
    resetGalleryTilt();
    return;
  }

  const card = activeItem.querySelector('.gallery-card');
  if (!card) return;

  const rect = card.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
  const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
  const maxTilt = 6;

  if (activeGalleryTiltCard && activeGalleryTiltCard !== card) {
    resetGalleryTilt();
  }

  activeGalleryTiltCard = card;
  pendingGalleryTilt = {
    x: -y * maxTilt,
    y: x * maxTilt,
  };

  activeGalleryTiltCard.classList.add('is-tilting');
  scheduleGalleryTiltApply();
}

// ─── Gallery open ────────────────────────────────────────────────────────────

export async function openDeckGallery() {
  if (STATE !== 'idle') return;

  await g.prepareMobileTilt();
  if (STATE !== 'idle') return;

  transition('gallery');
  g.clearStartInlineMotion();
  window.clearTimeout(galleryOpenTimer);
  window.clearTimeout(galleryCloseTimer);
  window.clearTimeout(deckTransitionCleanupTimer);
  window.clearTimeout(deckTransitionGatherTimer);
  galleryCloseTimer = null;
  deckTransitionCleanupTimer = null;
  deckTransitionGatherTimer = null;
  if (galleryOpenFrame) {
    cancelAnimationFrame(galleryOpenFrame);
    galleryOpenFrame = null;
  }

  const zo = g.getZOrder();
  const deckRect = g.dom.deckWrap.getBoundingClientRect();
  const topCard = g.dom.stackCards[zo[3]] || g.dom.stackCards[g.dom.stackCards.length - 1];
  const topCardRect = topCard.getBoundingClientRect();
  const deckScale = deckRect.width / g.dom.deckWrap.offsetWidth;
  const deckHoverProgress = g.getDeckHoverProgress();
  const faceCard = g.CARDS[galleryIndex] || g.CARDS[0];
  const transitionClone = createDeckTransitionClone(deckRect, topCardRect, deckHoverProgress, faceCard);
  g.dom.deckGallery.style.setProperty('--gallery-deck-left', `${topCardRect.left + topCardRect.width / 2}px`);
  g.dom.deckGallery.style.setProperty('--gallery-deck-top', `${topCardRect.top + topCardRect.height / 2}px`);
  g.dom.deckGallery.style.setProperty('--gallery-ghost-start-width', `${topCardRect.width}px`);
  setGalleryGhostStartVars(deckHoverProgress, deckScale);
  g.dom.deckGallery.hidden = false;
  g.dom.deckGallery.setAttribute('aria-hidden', 'false');
  g.dom.deckGallery.classList.remove('is-ready', 'is-opening', 'is-primed', 'is-spread-primed', 'is-spreading', 'is-handoff-complete');
  setGalleryCard(galleryIndex);
  const galleryTarget = measureGalleryCenterTarget();
  g.dom.deckGallery.style.setProperty('--gallery-card-target-left', `${galleryTarget.x}px`);
  g.dom.deckGallery.style.setProperty('--gallery-card-target-top', `${galleryTarget.y}px`);
  g.dom.deckGallery.style.setProperty('--gallery-ghost-target-width', `${galleryTarget.width}px`);
  g.dom.startEls.forEach(el => g.setVis(el, false));
  g.hideResultElsImmediately();
  g.dom.resultOverlay.style.pointerEvents = 'none';

  void transitionClone.offsetWidth;
  g.dom.deckWrap.classList.add('is-gallery-source');

  galleryOpenFrame = requestAnimationFrame(() => requestAnimationFrame(() => {
    galleryOpenFrame = null;
    if (STATE !== 'gallery') return;
    g.dom.deckWrap.dataset.state = 'gallery';
    animateDeckTransitionClone(transitionClone, galleryTarget);
  }));

  deckTransitionFlipTimer = window.setTimeout(() => {
    if (STATE !== 'gallery') return;
    flipDeckTransitionClone(transitionClone);
  }, g.GALLERY_TIMING.flipStart);

  galleryOpenTimer = window.setTimeout(() => {
    galleryOpenTimer = null;
    if (STATE !== 'gallery') return;
    g.dom.deckGallery.classList.remove('is-opening');
    g.dom.deckGallery.classList.add('is-open', 'is-spreading', 'is-spread-primed');

    let spreadReadyApplied = false;
    const applySpreadReady = () => {
      if (spreadReadyApplied || STATE !== 'gallery') return;
      spreadReadyApplied = true;
      if (STATE !== 'gallery') return;
      g.dom.deckGallery.classList.remove('is-spread-primed');
      g.dom.deckGallery.classList.add('is-ready');
      if (canUseMobileGalleryTilt()) {
        g.startMobileTiltListening();
      }
      if (deckTransitionClone) {
        deckTransitionClone.style.transition = 'opacity 0.42s cubic-bezier(0.22,0.61,0.36,1)';
        deckTransitionClone.style.opacity = '0';
      }
    };

    requestAnimationFrame(() => requestAnimationFrame(applySpreadReady));
    window.setTimeout(applySpreadReady, 80);
  }, g.GALLERY_TIMING.spreadStart);

  deckTransitionCleanupTimer = window.setTimeout(() => {
    if (STATE !== 'gallery') return;
    g.dom.deckGallery.classList.remove('is-spreading');
    if (deckTransitionClone) {
      deckTransitionClone.style.transition = 'opacity 0.18s ease';
      deckTransitionClone.style.opacity = '0';
    }
    removeDeckTransitionClone();
  }, g.GALLERY_TIMING.reveal);
}

// ─── Gallery close ───────────────────────────────────────────────────────────

export function closeDeckGallery() {
  if (STATE !== 'gallery') return;

  transition('galleryClosing');
  g.stopMobileTiltListening();
  resetGalleryTilt();
  window.clearTimeout(galleryOpenTimer);
  window.clearTimeout(galleryCloseTimer);
  window.clearTimeout(deckTransitionCleanupTimer);
  window.clearTimeout(deckTransitionGatherTimer);
  window.clearTimeout(deckTransitionFlipTimer);
  galleryOpenTimer = null;
  galleryCloseTimer = null;
  deckTransitionCleanupTimer = null;
  deckTransitionGatherTimer = null;
  deckTransitionFlipTimer = null;
  if (galleryOpenFrame) {
    cancelAnimationFrame(galleryOpenFrame);
    galleryOpenFrame = null;
  }
  removeDeckTransitionClone();
  g.dom.deckGallery.classList.remove('is-ready', 'is-opening', 'is-primed', 'is-spread-primed', 'is-spreading', 'is-closing', 'is-handoff-complete');
  g.dom.deckGallery.classList.add('is-open', 'is-closing');
  g.dom.deckGallery.setAttribute('aria-hidden', 'true');

  deckTransitionGatherTimer = window.setTimeout(() => {
    if (STATE !== 'galleryClosing') return;
    const handoffClone = createGalleryCloseHandoffClone();
    if (!handoffClone) return;
    void handoffClone.offsetWidth;
    g.dom.deckGallery.classList.add('is-handoff-complete');
  }, g.GALLERY_TIMING.closeHandoff);

  deckTransitionFlipTimer = window.setTimeout(() => {
    if (STATE !== 'galleryClosing') return;
    requestAnimationFrame(() => {
      if (STATE !== 'galleryClosing') return;
      flipGalleryCloseCloneBack(deckTransitionClone);
    });
  }, g.GALLERY_TIMING.closeFlipStart);

  deckTransitionCleanupTimer = window.setTimeout(() => {
    if (STATE !== 'galleryClosing') return;
    flyGalleryCloseCloneHome(deckTransitionClone);
  }, g.GALLERY_TIMING.closeFlyStart);

  galleryOpenTimer = window.setTimeout(() => {
    if (STATE !== 'galleryClosing') return;
    fanOutGalleryCloseClone(deckTransitionClone);
  }, g.GALLERY_TIMING.closeFanStart);

  window.setTimeout(() => {
    if (STATE !== 'galleryClosing') return;
    g.dom.startEls.forEach(el => g.setVis(el, true));
  }, g.GALLERY_TIMING.closeShowStart);

  galleryCloseTimer = window.setTimeout(() => {
    galleryCloseTimer = null;
    if (STATE !== 'galleryClosing') return;
    transition('idle');
    if (deckTransitionClone) {
      removeDeckTransitionClone();
    }
    g.dom.deckGallery.classList.remove('is-open', 'is-closing', 'is-handoff-complete');
    g.dom.deckWrap.classList.remove('is-gallery-source');
    g.dom.deckWrap.dataset.state = 'idle';
    g.dom.deckWrap.style.transition = 'none';
    g.dom.deckWrap.style.opacity = '1';
    g.dom.deckWrap.style.pointerEvents = '';
    g.dom.deckGallery.hidden = true;
    g.updateUI();
    window.setTimeout(() => {
      g.dom.deckWrap.style.transition = '';
      g.dom.deckWrap.style.opacity = '';
    }, 340);
  }, g.GALLERY_TIMING.close);
}

// ─── Gallery event handlers ──────────────────────────────────────────────────

export function handleGalleryKeydown(event) {
  if (STATE !== 'gallery') return;

  if (event.key === 'Escape') {
    closeDeckGallery();
  } else if (event.key === 'ArrowRight') {
    showNextGalleryCard();
  } else if (event.key === 'ArrowLeft') {
    showPrevGalleryCard();
  } else {
    return;
  }

  event.preventDefault();
}

export function handleGalleryTouchStart(event) {
  if (STATE !== 'gallery' || !event.touches.length) return;
  galleryTouchStartX = event.touches[0].clientX;
}

export function handleGalleryTouchEnd(event) {
  if (STATE !== 'gallery' || !galleryTouchStartX) return;
  const endX = event.changedTouches && event.changedTouches.length
    ? event.changedTouches[0].clientX
    : galleryTouchStartX;
  const delta = endX - galleryTouchStartX;
  galleryTouchStartX = 0;

  if (Math.abs(delta) < 48) return;
  if (delta < 0) {
    showNextGalleryCard();
  } else {
    showPrevGalleryCard();
  }
}

export function handleGalleryBackdropClick(event) {
  if (STATE !== 'gallery' || event.target !== g.dom.deckGallery) return;
  closeDeckGallery();
}

export function handleGalleryCardClick(event) {
  if (STATE !== 'gallery') return;
  const item = event.target.closest('.gallery-card-item.is-visible');
  if (!item || !g.dom.galleryTrack.contains(item)) return;

  const nextIndex = Number(item.dataset.index);
  if (!Number.isFinite(nextIndex) || nextIndex === galleryIndex) return;
  setGalleryCard(nextIndex);
}
