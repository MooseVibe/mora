import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [app, css, html] = await Promise.all([
  readFile(new URL("../public/ritual/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/ritual/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../public/ritual/index.html", import.meta.url), "utf8"),
]);

assert.match(html, /class="tester-session-pending"/);
assert.match(html, /__moraAccountStateResponse = fetch/);
assert.match(html, /class="app-bootstrap"/);
assert.doesNotMatch(html, /modulepreload" href="\.\/spread-deck-3d\.js/);
assert.match(app, /window\.__moraAccountStateResponse[\s\S]*fetch\("\/api\/prototypes\/account-state"/);
assert.match(app, /revealAppWhenCriticalViewReady\(\)/);
assert.match(app, /import\("\.\/spread-deck-3d\.js\?v=20260903-spreadsharp1"\)/);
assert.match(css, /html\.app-ready \.app-bootstrap/);
assert.match(html, /class="app-content"/);
assert.match(css, /html\.app-ready \.app-content/);
assert.doesNotMatch(css, /mora-page-enter/);
assert.match(css, /@media \(max-width: 720px\) \{[\s\S]*background-attachment: scroll;/);

console.log("Ritual bootstrap reveals one stable critical view.");
