import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const app = readFileSync(new URL("../public/ritual/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../public/ritual/index.html", import.meta.url), "utf8");
const copyCode = app.slice(app.indexOf("function setSpreadLoadingCopy("), app.indexOf("async function generateReading("));
const generationCode = app.slice(app.indexOf("async function generateReading("), app.indexOf("function populateReading("));
let now = 0;
let nextId = 0;
const timers = new Map();
const context = vm.createContext({
  readingStatusPhrase: {}, readingStatusAnnouncement: {},
  window: {
    setTimeout(fn, delay) { const id = ++nextId; timers.set(id, { fn, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    MoraAnalytics: { capture() {} },
  },
  selectedCards: [{ id: "a" }, { id: "b" }, { id: "c" }],
  currentTopic: "Карьера", prototypeNextSpreadAt: 0,
  buildFallbackReading: () => ({ fallback: true }),
  populateReading() {}, saveLastSpread() {},
  preloadCardTagIcons: async () => {},
  fetch: async () => ({ ok: true, json: async () => ({ reading: {} }) }),
  shown: 0,
});
vm.runInContext(`let spreadLoadingCopyTimer; let volatileFailedSpread; ${copyCode}\n${generationCode}\nfunction showReading() { stopSpreadLoadingCopy(); shown++; }`, context);
function tick(ms) {
  const end = now + ms;
  while (true) {
    const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
    if (!next) break;
    now = next[1].at; timers.delete(next[0]); next[1].fn();
  }
  now = end;
}
function expectCopy(text) {
  assert.equal(context.readingStatusPhrase.textContent, text);
  assert.equal(context.readingStatusAnnouncement.textContent, text);
}
vm.runInContext("startSpreadLoadingCopy()", context);
expectCopy("Раскладываем");
tick(7999); expectCopy("Раскладываем");
tick(1); expectCopy("Ещё чуть-чуть");
tick(11999); expectCopy("Ещё чуть-чуть");
tick(1); expectCopy("Нужно чуть больше времени. Готовим твой расклад");
vm.runInContext("stopSpreadLoadingCopy(); startSpreadLoadingCopy()", context);
tick(8000); expectCopy("Ещё чуть-чуть");
vm.runInContext("stopSpreadLoadingCopy()", context);
tick(20000); expectCopy("Раскладываем");
assert.equal(timers.size, 0);
await vm.runInContext("generateReading()", context);
assert.equal(context.shown, 1, "Ready reading opens without advancing the clock");
assert.equal(timers.size, 0);
context.fetch = async () => { throw new Error("offline"); };
await vm.runInContext("generateReading()", context);
assert.equal(context.shown, 2, "Failure does not leave the loading state stuck");
assert.equal(timers.size, 0);
assert.doesNotMatch(app, /spreadLoadingMinMs|remainingRitual|Смотрим глубже/);
assert.match(html, /Раскладываем<\/span><span class="loading-dots"/);
assert.match(app, /function showReading\(\) \{\s+stopSpreadLoadingSpins\(\);\s+stopSpreadLoadingCopy\(\);/);
console.log("Loading copy: 0/8/20s, restart/cleanup, immediate success/failure and adjacent dots passed.");
