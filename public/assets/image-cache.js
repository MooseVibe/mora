'use strict';
import { TAROT_CARDS } from './cards.js';

export const IMAGE_LOAD_STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  LOADED: 'loaded',
  ERROR: 'error',
};

const imageCache = new Map();

export function getCachedImage(src) {
  return imageCache.get(src);
}

export function markImageCache(src, status, promise = null) {
  const cached = imageCache.get(src) || {};
  imageCache.set(src, {
    status,
    promise: promise || cached.promise || null,
  });
}

export function loadCardImage(src) {
  const cached = getCachedImage(src);
  if (cached && cached.status === IMAGE_LOAD_STATUS.LOADED) return Promise.resolve();
  if (cached && cached.status === IMAGE_LOAD_STATUS.LOADING && cached.promise) return cached.promise;
  if (cached && cached.status === IMAGE_LOAD_STATUS.ERROR) return Promise.reject(new Error(`Image failed: ${src}`));

  const image = new Image();
  image.decoding = 'async';
  const promise = new Promise((resolve, reject) => {
    image.onload = () => {
      const done = image.decode ? image.decode().catch(() => {}) : Promise.resolve();
      done.then(() => {
        markImageCache(src, IMAGE_LOAD_STATUS.LOADED);
        resolve();
      });
    };
    image.onerror = () => {
      markImageCache(src, IMAGE_LOAD_STATUS.ERROR);
      reject(new Error(`Image failed: ${src}`));
    };
  });

  markImageCache(src, IMAGE_LOAD_STATUS.LOADING, promise);
  image.src = src;
  return promise;
}

export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function preloadCardImages() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (connection && (connection.saveData || /2g/.test(connection.effectiveType || ''))) {
    return;
  }

  const gallery = document.getElementById('deckGallery');
  if (!gallery || gallery.hidden) {
    return;
  }

  const sources = [...new Set(TAROT_CARDS.slice(0, 3).map(card => card.image).filter(Boolean))];
  const preloadNext = index => {
    if (index >= sources.length) return;
    loadCardImage(sources[index]).catch(() => {});
    setTimeout(() => preloadNext(index + 1), 650);
  };

  const startPreload = () => preloadNext(0);
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(startPreload, { timeout: 1800 });
  } else {
    setTimeout(startPreload, 1200);
  }
}
