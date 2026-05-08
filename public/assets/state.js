'use strict';

// idle | shuffling | drawing | result | resetting | gallery | galleryClosing
export let STATE = 'idle';

export const TRANSITIONS = {
  idle:           ['drawing', 'shuffling', 'gallery'],
  drawing:        ['result'],
  result:         ['resetting'],
  resetting:      ['idle'],
  shuffling:      ['idle'],
  gallery:        ['galleryClosing'],
  galleryClosing: ['idle'],
};

export function transition(next) {
  if (!TRANSITIONS[STATE] || !TRANSITIONS[STATE].includes(next)) {
    console.warn(`[STATE] Invalid transition: ${STATE} → ${next}`);
    return false;
  }
  STATE = next;
  return true;
}

export function runSequence(steps, guard) {
  const timers = steps.map(([delay, fn]) =>
    setTimeout(() => {
      if (guard && !guard()) return;
      fn();
    }, delay)
  );
  return () => timers.forEach(clearTimeout);
}
