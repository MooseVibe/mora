import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../public/ritual/app.js", import.meta.url), "utf8");
const renderer = readFileSync(new URL("../public/ritual/spread-deck-3d.js", import.meta.url), "utf8");
const drawToSlot = renderer.slice(renderer.indexOf("async drawToSlot"));
const beforeFirstFrame = drawToSlot.slice(0, drawToSlot.indexOf("const flightStartedAt"));

assert.match(app, /const card = ensurePreparedSpread\(\)\[picked\]/);
assert.match(app, /deck\.inert = true/);
assert.match(app, /stopDeckDiscoveryMotion\(\);\s+showDeckHint\(\);/);
assert.match(app, /await preloadCardTagIcons\(selectedCards\)/);
assert.match(app, /if \(tag\.icon\) icon\.src = tag\.icon/);
assert.doesNotMatch(app, /--daily-result-tag-icon/);
assert.doesNotMatch(beforeFirstFrame, /await preloadFace/);
assert.doesNotMatch(beforeFirstFrame, /renderDeck\(\)/);
assert.match(drawToSlot, /preloadFace\(imageUrl\)\.then\(queueLoadedFace\)/);
assert.match(drawToSlot, /const responseLift/);

console.log("Spread draw starts without waiting for its face texture.");
