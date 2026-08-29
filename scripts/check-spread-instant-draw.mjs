import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../public/ritual/app.js", import.meta.url), "utf8");
const renderer = readFileSync(new URL("../public/ritual/spread-deck-3d.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/ritual/styles.css", import.meta.url), "utf8");
const nextConfig = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8");
const drawToSlot = renderer.slice(renderer.indexOf("async drawToSlot"));
const beforeFirstFrame = drawToSlot.slice(0, drawToSlot.indexOf("const flightStartedAt"));

assert.match(app, /const card = ensurePreparedSpread\(\)\[picked\]/);
assert.match(app, /deck\.inert = true/);
assert.match(app, /stopDeckDiscoveryMotion\(\);\s+showDeckHint\(\);/);
assert.match(app, /await preloadCardTagIcons\(selectedCards\)/);
assert.match(app, /icon\.getAttribute\("src"\) !== tag\.icon/);
assert.doesNotMatch(app, /--daily-result-tag-icon/);
assert.match(nextConfig, /source: '\/ritual\/icons\/:path\*'/);
assert.match(styles, /data-step="loading"\]\) \{[\s\S]*height: 100dvh;[\s\S]*overflow: hidden;/);
assert.match(styles, /data-step="choose"\] \{\s+touch-action: none;/);
assert.match(styles, /data-step="choose"\] :is\(\.slot, \.deck-card\)[\s\S]*-webkit-tap-highlight-color: transparent;/);
assert.doesNotMatch(beforeFirstFrame, /await preloadFace/);
assert.doesNotMatch(beforeFirstFrame, /renderDeck\(\)/);
assert.match(drawToSlot, /preloadFace\(imageUrl\)\.then\(queueLoadedFace\)/);
assert.match(drawToSlot, /const responseLift/);

console.log("Spread draw starts without waiting for its face texture.");
