import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile("public/ritual/app.js", "utf8");

assert.match(app, /https:\/\/t\.me\/share\/url\?url=/);
assert.match(app, /const shareBaseUrl = "https:\/\/moratarot\.com\/ritual"/);
assert.match(app, /navigator\.canShare\(\{ files: \[file\] \}\)/);
assert.match(app, /new File\(\[blob\], `mora-\$\{card\.id\}\.webp`/);
assert.match(app, /\.\.\.\(file \? \{ files: \[file\] \} : \{\}\)/);
assert.doesNotMatch(app, /navigator\.share\(\{[^}]*url:/s);
assert.match(app, /\(hover: hover\) and \(pointer: fine\)/);
assert.match(app, /error\?\.name === "AbortError"/);
assert.match(app, /variant\?\.share/);
assert.match(app, /snapshot\.cards\.length !== spreadSize/);
assert.match(app, /snapshot\.cards\.map\(\(card\) => card\.name\)/);
assert.match(app, /dailyResultShareButton\.addEventListener\("click", shareDailyResult\)/);
assert.match(app, /readingSummaryShareButton\.addEventListener\("click", shareSpreadResult\)/);

console.log("Native mobile and Telegram fallback share contract is consistent.");
