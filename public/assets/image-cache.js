'use strict';

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

export function preloadCardImage(card) {
  if (!card?.image) return Promise.resolve();
  return loadCardImage(card.image).catch(() => {
    if (card.imageFallback && card.imageFallback !== card.image) {
      return loadCardImage(card.imageFallback).catch(() => {});
    }
    return undefined;
  });
}
