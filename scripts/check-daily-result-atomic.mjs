import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [app, css, html] = await Promise.all([
  readFile(new URL("../public/ritual/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/ritual/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../public/ritual/index.html", import.meta.url), "utf8"),
]);

assert.match(app, /usesMobileDailyResult[\s\S]*!usesMobileDailyResult && !daily3DRestoreInFlight/);
assert.match(app, /populateDailyResult\(savedDailyCard\.card[\s\S]*classList\.remove\("daily-saved-pending"\)/);
assert.doesNotMatch(html, /is-visual-pending/);
assert.doesNotMatch(css, /is-visual-pending|not\(\.is-visual-ready\)/);
assert.match(css, /body\.daily-mode\.daily-result-ready:not\(\.daily-3d-error\) \.daily-result-card \{[\s\S]*opacity: 1;[\s\S]*visibility: visible;/);
assert.equal((html.match(/app\.js\?v=20260830-dailymobile1/g) || []).length, 2);
assert.match(html, /styles\.css\?v=20260830-dailymobile2/);

console.log("Mobile saved daily card stays visible without hidden 3D restore.");
