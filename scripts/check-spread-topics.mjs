import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, app, route, searchLoveIcon] = await Promise.all([
  readFile("public/ritual/index.html", "utf8"),
  readFile("public/ritual/app.js", "utf8"),
  readFile("src/app/api/prototypes/spread-reading/route.ts", "utf8"),
  readFile("public/ritual/icons/search-love.svg", "utf8"),
]);

const visibleTopics = [
  "Внутреннее состояние",
  "Карьера",
  "Отношения",
  "Поиск любви",
  "Финансы",
  "Выбор",
];

for (const topic of visibleTopics) {
  assert.match(html, new RegExp(`data-topic="${topic}"`));
  assert.match(app, new RegExp(`"${topic}":`));
  assert.match(route, new RegExp(`'${topic}':`));
}

assert.doesNotMatch(html, /data-topic="Работа"/);
assert.match(route, /'Работа':/);
assert.match(route, /Контекст темы: \$\{topicGuidance\[topic\]\}/g);
assert.match(searchLoveIcon, /mask id="search-love-cutout"/);
assert.doesNotMatch(searchLoveIcon, /fill="#666666"/);

console.log("Spread topic contract is consistent.");
