'use strict';
import { smoothStep, lerpArc } from './arc.js';
import { loadCardImage, wait } from './image-cache.js';

const APP_LOADER_INITIAL_ASSETS = ['assets/cards/moose.webp'];
const APP_LOADER_MIN_MS = 720;
const APP_LOADER_DEBUG_PARAM = 'loader';
const APP_LOADER_DEMO_PARAM = 'loaderDemo';
const APP_LOADER_SLOW_PARAM = 'loaderSlow';
const APP_LOADER_ERROR_PARAM = 'loaderError';
const APP_LOADER_SLOW_MS = 9000;
const APP_LOADER_ERROR_MS = 30000;
const APP_LOADER_CARD_WIDTH = 40;
const APP_LOADER_SHUFFLE_TIMING = {
  cardDuration: 520,
  cardOverlap: 200,
  cyclePause: 300,
  settle: 430,
};

let dom = null;
let LAYER = null;

let loaderDeck = null;
let loaderCards = [];
let loaderZOrder = [0,1,2,3];
let loaderShuffleTimers = [];
let loaderShuffleFrame = null;
let loaderShuffleRunning = false;
let loaderShuffleInCycle = false;
let loaderHidePending = false;
let appLoaderSlowTimer = null;
let appLoaderErrorTimer = null;

export function initLoader(domRef, layerRef) {
  dom = domRef;
  LAYER = layerRef;
}

function preloadInitialAppAssets() {
  return Promise.all(APP_LOADER_INITIAL_ASSETS.map(src => loadCardImage(src)));
}

function getAppLoaderParams() {
  return new URLSearchParams(window.location.search);
}

function getAppLoaderDemoDuration() {
  const value = Number.parseInt(getAppLoaderParams().get(APP_LOADER_DEMO_PARAM), 10);
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(value, 10000));
}

function setAppLoaderText(label) {
  if (!dom.appLoaderText) return;
  dom.appLoaderText.innerHTML = `<span class="app-loader-label">${label}</span><span class="app-loader-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>`;
}

function setAppLoaderState(state) {
  if (!dom.appLoader) return;

  dom.appLoader.dataset.loaderState = state;
  const isError = state === 'error';

  if (dom.appLoaderText) dom.appLoaderText.hidden = isError;
  if (dom.appLoaderErrorTitle) dom.appLoaderErrorTitle.hidden = !isError;
  if (dom.appLoaderErrorText) dom.appLoaderErrorText.hidden = !isError;
  if (dom.appLoaderReload) dom.appLoaderReload.hidden = !isError;
}

function clearAppLoaderStateTimers() {
  window.clearTimeout(appLoaderSlowTimer);
  window.clearTimeout(appLoaderErrorTimer);
  appLoaderSlowTimer = null;
  appLoaderErrorTimer = null;
}

function showAppLoaderSlowState() {
  if (!dom.appLoader || dom.appLoader.hidden || dom.appLoader.classList.contains('is-hiding')) return;
  if (dom.appLoader.dataset.loaderState === 'error') return;

  setAppLoaderState('slow');
  setAppLoaderText('Колода грузится медленно');
}

function showAppLoaderErrorState() {
  if (!dom.appLoader || dom.appLoader.hidden || dom.appLoader.classList.contains('is-hiding')) return;

  clearAppLoaderStateTimers();
  stopAppLoaderShuffle();
  setAppLoaderState('error');
}

export function scheduleAppLoaderStateTimers() {
  clearAppLoaderStateTimers();
  const params = getAppLoaderParams();

  if (params.get(APP_LOADER_SLOW_PARAM) === '1') {
    showAppLoaderSlowState();
    return;
  }
  if (params.get(APP_LOADER_ERROR_PARAM) === '1') {
    showAppLoaderErrorState();
    return;
  }

  appLoaderSlowTimer = window.setTimeout(showAppLoaderSlowState, APP_LOADER_SLOW_MS);
  appLoaderErrorTimer = window.setTimeout(showAppLoaderErrorState, APP_LOADER_ERROR_MS);
}

function getLoaderLayer(layerIndex) {
  const scale = APP_LOADER_CARD_WIDTH / 130;
  return {
    dx: LAYER[layerIndex].dx * scale,
    dy: LAYER[layerIndex].dy * scale,
    rot: LAYER[layerIndex].rot,
  };
}

function setLoaderLayer(card, layerIndex, animated = false) {
  const layer = getLoaderLayer(layerIndex);
  card.style.zIndex = layerIndex;
  card.style.transition = animated
    ? 'transform 0.28s cubic-bezier(0.22,0.61,0.36,1)'
    : '';
  card.style.transform = `translate(${layer.dx.toFixed(2)}px, ${layer.dy.toFixed(2)}px) rotate(${layer.rot.toFixed(2)}deg)`;
}

function snapLoaderDeck() {
  loaderCards.forEach((card, index) => setLoaderLayer(card, loaderZOrder.indexOf(index)));
}

function clearLoaderShuffleTimer() {
  loaderShuffleTimers.forEach(timer => window.clearTimeout(timer));
  loaderShuffleTimers = [];
  if (loaderShuffleFrame !== null) {
    cancelAnimationFrame(loaderShuffleFrame);
    loaderShuffleFrame = null;
  }
}

function setLoaderDeckLift(lifted) {
  if (!loaderDeck) return;
  loaderDeck.style.transition = 'transform 0.38s cubic-bezier(0.22,0.61,0.36,1)';
  loaderDeck.style.transform = lifted ? 'translateY(-2px) scale(1.03)' : 'translateY(0) scale(1)';
}

function getLoaderArcPoint(t) {
  const point = lerpArc(t);
  const scale = APP_LOADER_CARD_WIDTH / 130;
  return {
    dx: point.dx * scale,
    dy: point.dy * scale,
    rot: point.rot,
  };
}

function arcLoaderCard(card, duration, done) {
  let dropped = false;
  const t0 = performance.now();
  card.style.transition = 'none';
  card.style.zIndex = 20;

  function frame(now) {
    const raw = Math.min((now - t0) / duration, 1);
    const { dx, dy, rot } = getLoaderArcPoint(smoothStep(raw));
    card.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${rot.toFixed(2)}deg)`;

    if (!dropped && raw >= 0.78) {
      dropped = true;
      card.style.zIndex = -1;
    }

    if (raw < 1 && loaderShuffleRunning) {
      loaderShuffleFrame = requestAnimationFrame(frame);
    } else {
      loaderShuffleFrame = null;
      done();
    }
  }

  loaderShuffleFrame = requestAnimationFrame(frame);
}

function runLoaderShuffleCycle() {
  if (!loaderShuffleRunning || !dom.appLoader || dom.appLoader.hidden) return;

  const { cardDuration, cardOverlap, cyclePause, settle } = APP_LOADER_SHUFFLE_TIMING;
  const cardDelay = cardDuration - cardOverlap;
  let settled = 0;
  loaderShuffleInCycle = true;
  loaderShuffleTimers = [];

  setLoaderDeckLift(true);

  loaderCards.forEach((_, index) => {
    const timer = window.setTimeout(() => {
      if (!loaderShuffleRunning || !dom.appLoader || dom.appLoader.hidden) return;

      const topIndex = loaderZOrder[3];
      const card = loaderCards[topIndex];
      loaderZOrder = [loaderZOrder[3], loaderZOrder[0], loaderZOrder[1], loaderZOrder[2]];

      for (let layerIndex = 0; layerIndex < 3; layerIndex++) {
        setLoaderLayer(loaderCards[loaderZOrder[layerIndex + 1]], layerIndex + 1, true);
      }

      arcLoaderCard(card, cardDuration, () => {
        setLoaderLayer(card, 0, true);
        settled++;

        if (settled === loaderCards.length && loaderShuffleRunning) {
          snapLoaderDeck();
          setLoaderDeckLift(false);
          const nextTimer = window.setTimeout(() => {
            loaderShuffleInCycle = false;
            if (loaderHidePending) {
              hideAppLoaderNow();
              return;
            }
            runLoaderShuffleCycle();
          }, loaderHidePending ? settle : cyclePause);
          loaderShuffleTimers.push(nextTimer);
        }
      });
    }, index * cardDelay);
    loaderShuffleTimers.push(timer);
  });
}

export function startAppLoaderShuffle() {
  if (!dom.appLoader || loaderShuffleRunning) return;
  if (dom.appLoader.dataset.loaderState === 'error') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  loaderDeck = dom.appLoader.querySelector('.app-loader-deck');
  loaderCards = Array.from(dom.appLoader.querySelectorAll('.app-loader-card'));
  if (!loaderCards.length) return;

  loaderShuffleRunning = true;
  loaderHidePending = false;
  loaderShuffleInCycle = false;
  loaderZOrder = [0,1,2,3];
  snapLoaderDeck();
  const timer = window.setTimeout(runLoaderShuffleCycle, 220);
  loaderShuffleTimers.push(timer);
}

function stopAppLoaderShuffle() {
  loaderShuffleRunning = false;
  loaderShuffleInCycle = false;
  loaderHidePending = false;
  clearLoaderShuffleTimer();
  setLoaderDeckLift(false);
}

function hideAppLoaderNow() {
  if (!dom.appLoader || dom.appLoader.hidden || dom.appLoader.classList.contains('is-hiding')) return;

  clearAppLoaderStateTimers();
  stopAppLoaderShuffle();
  document.body.classList.add('app-is-ready');
  dom.appLoader.classList.add('is-hiding');
  const finish = () => {
    if (!dom.appLoader) return;
    dom.appLoader.hidden = true;
    document.body.classList.remove('app-is-loading');
  };

  dom.appLoader.addEventListener('transitionend', finish, { once:true });
  setTimeout(finish, 620);
}

function hideAppLoader() {
  if (!dom.appLoader || dom.appLoader.hidden || dom.appLoader.classList.contains('is-hiding')) return;

  if (loaderShuffleRunning && loaderShuffleInCycle) {
    loaderHidePending = true;
    return;
  }

  hideAppLoaderNow();
}

export function settleInitialAppLoader() {
  if (!dom.appLoader) return;
  const params = getAppLoaderParams();
  if (params.get(APP_LOADER_DEBUG_PARAM) === '1') return;
  if (params.get(APP_LOADER_SLOW_PARAM) === '1') return;
  if (params.get(APP_LOADER_ERROR_PARAM) === '1') return;
  const demoDuration = getAppLoaderDemoDuration();

  if (demoDuration !== null) {
    wait(demoDuration).then(hideAppLoader);
    return;
  }

  Promise.all([
    wait(APP_LOADER_MIN_MS),
    preloadInitialAppAssets(),
  ]).then(hideAppLoader).catch(() => {});
}

export function reloadFromAppLoader() {
  const url = new URL(window.location.href);
  const debugParams = [
    APP_LOADER_DEBUG_PARAM,
    APP_LOADER_DEMO_PARAM,
    APP_LOADER_SLOW_PARAM,
    APP_LOADER_ERROR_PARAM,
  ];
  const hadDebugParam = debugParams.some(param => url.searchParams.has(param));

  if (hadDebugParam) {
    debugParams.forEach(param => url.searchParams.delete(param));
    window.location.href = url.toString();
    return;
  }

  window.location.reload();
}
