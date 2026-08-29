import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [app, css, html] = await Promise.all([
  readFile(new URL("../public/ritual/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/ritual/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../public/ritual/index.html", import.meta.url), "utf8"),
]);

assert.match(app, /imageChanged[\s\S]*classList\.remove\("is-visual-ready"\)[\s\S]*dailyResultImage\.decode/);
assert.match(app, /dailyResultImage\.src === expectedImageUrl[\s\S]*classList\.add\("is-visual-ready"\)/);
assert.match(app, /addEventListener\("load", resolve, \{ once: true \}\)/);
assert.match(app, /classList\.add\("is-visual-pending"\)[\s\S]*classList\.remove\("is-visual-ready"\)/);
assert.match(app, /classList\.remove\("is-visual-pending"\)[\s\S]*classList\.add\("is-visual-ready"\)/);
assert.match(app, /usesMobileDailyResult[\s\S]*!usesMobileDailyResult && !daily3DRestoreInFlight/);
assert.match(html, /daily-result-card is-visual-pending/);
assert.match(css, /daily-result-card:not\(\.is-visual-ready\)[\s\S]*opacity: 0;[\s\S]*visibility: hidden;/);
assert.equal((html.match(/app\.js\?v=20260829-dailyatomic3/g) || []).length, 2);

console.log("Daily result card waits for image decode before atomic reveal.");
