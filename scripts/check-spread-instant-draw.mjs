import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../public/ritual/app.js", import.meta.url), "utf8");
const renderer = readFileSync(new URL("../public/ritual/spread-deck-3d.js", import.meta.url), "utf8");
const drawToSlot = renderer.slice(renderer.indexOf("async drawToSlot"));
const beforeFirstFrame = drawToSlot.slice(0, drawToSlot.indexOf("const flightStartedAt"));

assert.match(app, /const card = ensurePreparedSpread\(\)\[picked\]/);
assert.doesNotMatch(beforeFirstFrame, /await preloadFace/);
assert.match(drawToSlot, /preloadFace\(imageUrl\)\.then\(applyLoadedFace\)/);

console.log("Spread draw starts without waiting for its face texture.");
