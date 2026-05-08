'use strict';

export function smoothStep(t) { return t*t*t*(t*(t*6-15)+10); }

export const ARC = [
  [0.00,  0,  0,   0],
  [0.15,  0,-30,  -3],
  [0.35,-95,-22, -22],
  [0.55,-28,-42, -10],
  [0.70, 54,-12,  13],
  [0.83, 12, 10,   6],
  [1.00,  9,  9,   3], // конечная точка совпадает с LAYER[0]
];

export function lerpArc(t) {
  let i = 0;
  while (i < ARC.length-2 && ARC[i+1][0] <= t) i++;
  const [t0,x0,y0,r0] = ARC[i], [t1,x1,y1,r1] = ARC[i+1];
  const s = t1-t0 ? (t-t0)/(t1-t0) : 1;
  return { dx:x0+(x1-x0)*s, dy:y0+(y1-y0)*s, rot:r0+(r1-r0)*s };
}
