# Card Style · Mora

Production-ready art direction for generating and adding tarot cards to Mora.

## Current Deck Baseline

The production deck lives in `public/assets/cards/` and committed tarot cards use optimized WebP files:

- Main card size: `1024x1536`
- Aspect ratio: `2:3`
- Current UI card aspect: `290 / 477`, so generated art must crop safely into a tall card
- Production/committed format: WebP
- Temporary source format during generation: PNG, kept locally only until visual approval and WebP optimization
- File paths in code:
  - `assets/cards/{card-id}.webp`

Some files in the folder are not standard deck cards: `Tarolog`, `Tarolog2`, `image`, `moose`, `moose-mobile`. Do not use them as the primary style baseline for new tarot cards.

## Visual Direction

Mora cards feel like dark ritual illustrations, closer to dramatic tarot engravings than clean fantasy posters.

The image should look ancient, tactile, and slightly dangerous, but still readable in a small UI card.

## Canonical Tarot Fidelity

Mora is a stylistic reinterpretation of the original tarot deck, not a new symbolic deck from scratch.

Before generating a classic tarot card, use the canonical Rider-Waite-Smith composition as the source of truth unless the user explicitly chooses another deck reference.

For each card, identify and preserve:

- main figures;
- required objects and their count;
- placement logic;
- relationship between figures and objects;
- core background symbols.

The style may change: dark palette, ritual mood, antique gold light, engraved texture, Mora atmosphere.

The meaning-bearing composition must not change. Do not move required objects into nonsensical positions, remove key figures, change counts, or replace the scene with a loosely related archetype.

Examples:

- `six-of-swords`: a boat crossing water, a ferryman/guide in the boat, passengers in the boat, six swords standing in the boat.
- `two-of-swords`: seated blindfolded figure, two crossed swords, water/moon background.
- `eight-of-pentacles`: worker/craftsperson focused on pentacles, repeated pentacles as practice and craft.

After generation, compare the output against the canonical composition before optimizing or integrating the asset.

### Core Style

- Dark, almost black background with deep brown, green-black, charcoal, and smoky shadow.
- Warm antique gold is the main active color: rim light, symbols, halos, lightning, ornaments, small highlights.
- Painterly engraved texture: dense brushwork, cracked stone, worn metal, rough cloth, smoke, dust, sparks.
- Cinematic chiaroscuro: most of the frame stays dark, meaning is revealed through one strong light source.
- High detail, but not colorful noise. Details should support the archetype.
- Serious ritual mood, not playful, cute, pastel, futuristic, glossy, or cartoon-like.

### Composition

- Vertical 2:3 frame.
- One clear central archetype or symbol.
- Main figure/object should occupy roughly 55-75% of the card height.
- The meaning-bearing figure or object must read instantly as a distinct silhouette, even in a small dashboard thumbnail. Separate it from the scene with value contrast, rim light, negative space, or a darker/lighter background plane; do not let the main figure merge into trees, ruins, smoke, fabric, or other surrounding texture.
- Treat `ace-of-swords` as the current quality benchmark for main-scene contrast: the core symbol must be brighter, cleaner, and more legible than the surrounding ritual environment while the background stays atmospheric and subordinate.
- Keep the lower 10-14% visually dark enough for the Roman numeral or symbolic footer.
- Reserve a consistent footer-marker zone for the card rank: horizontally centered, visually placed in the lower dark band, with the marker center around 91-92% of image height and its bottom leaving roughly 5-6% image height as margin. The marker should be large enough to read as part of the deck system, not a tiny caption: target visual height about 5-6% of the full card height for Roman numerals or rank letters, and about 6-8% including a small court crown. Use `queen-of-pentacles` (`Q` with crown) and `six-of-swords` (`VI`) as the size/placement benchmark; avoid the too-small `eight-of-pentacles` marker.
- Use a centered or slightly off-center composition with strong silhouette readability.
- Background should feel like a ritual space: stone, ruins, mountains, night sky, columns, forest, cave, temple, smoke, storm, or celestial void.
- Add secondary symbols around the main subject, but keep them subordinate.
- The card should be readable at dashboard/recent-card thumbnail size.

### Characters

- Characters should look mythic and grounded, not fashion/editorial.
- Wardrobe: dark robes, worn fabric, metal ornaments, ritual jewelry, armor, veils, old-world silhouettes.
- Faces can be visible, but avoid modern beauty retouching and social-media portrait lighting.
- Pose should express the card meaning immediately: stillness, choice, burden, power, release, movement.
- Avoid direct modern props unless the card concept explicitly requires a symbolic object.

### Symbols

- Use archetypal tarot symbols: moon, sun, stars, flame, cup, sword, coin, wand, scale, key, crown, veil, gate, wheel, thread, mirror, hand, mountain, water, path, animal, arch, tower, laurel.
- Symbols should be integrated into the scene, not pasted as flat icons.
- Existing card images include a Roman numeral or rank marker at the bottom. New numbered cards should include an antique-gold Roman numeral in the consistent footer-marker zone; court cards can use a compact rank marker such as `Q` with a tiny crown instead of a misleading Roman numeral. The marker is part of deck consistency, so it must not be tiny, oversized, off-center, too close to the edge, or hidden in texture.
- Do not put Russian card names on the image. Text belongs in UI, not in the artwork.
- Do not add a decorative card frame, corner ornaments, rounded border, or separate footer plaque. Existing Mora UI provides the card framing; the artwork should bleed to the edge with only natural dark vignette.

## Palette And Light

Primary palette:

- black-brown / near-black base
- charcoal gray
- aged bronze
- antique gold
- muted cream
- deep moss / dark olive as shadow color

Allowed accents:

- lunar silver for moon or water cards
- ember orange for fire, tower, transformation, conflict
- muted blood-red only when strongly justified by the archetype

Avoid:

- bright purple-blue fantasy gradients
- clean neon
- pastel tones
- saturated rainbow palettes
- flat beige/cream dominance
- glossy 3D render look

Light rules:

- One dominant symbolic light source.
- Gold light should reveal the meaning: halo, candle, lightning, portal, glowing object, reflected rim.
- Corners should remain dark or vignetted.
- Do not make the whole card evenly bright.

## Prompt Template

Use this as the base and replace bracketed parts.

```text
Dark ritual tarot card illustration for Mora, vertical 2:3 composition, [CARD NAME / ARCHETYPE], [MAIN SUBJECT AND POSE], [KEY SYMBOLS], ancient stone / smoke / night atmosphere, antique gold rim light, near-black charcoal and deep brown palette, dramatic chiaroscuro, painterly engraved texture, worn metal and cracked stone details, mystical but grounded, centered readable silhouette, ornate but restrained, antique-gold Roman numeral [NUMERAL] centered in the lower dark footer-marker zone, marker sized consistently with Mora queen-of-pentacles Q and six-of-swords VI, not tiny, marker center around 91-92% of image height with comfortable bottom margin, no card name text, no decorative frame or corner ornaments, no separate footer plaque, artwork bleeds to the edge, high detail, cinematic, solemn, old tarot deck mood
```

Example:

```text
Dark ritual tarot card illustration for Mora, vertical 2:3 composition, Ace of Cups / first emotional opening, a single ancient chalice held above dark water, thin stream of golden light pouring into the cup, moonlit mist, black stone shore, antique gold rim light, near-black charcoal and deep brown palette, dramatic chiaroscuro, painterly engraved texture, worn metal and cracked stone details, mystical but grounded, centered readable silhouette, ornate but restrained, antique-gold Roman numeral I centered in the lower dark footer-marker zone, marker sized consistently with Mora queen-of-pentacles Q and six-of-swords VI, not tiny, marker center around 91-92% of image height with comfortable bottom margin, no card name text, no decorative frame or corner ornaments, no separate footer plaque, artwork bleeds to the edge, high detail, cinematic, solemn, old tarot deck mood
```

## Negative Prompt

```text
bright colors, pastel, neon, purple blue gradient, cute, cartoon, anime, flat vector, clean minimalism, glossy 3d render, plastic skin, modern fashion photo, corporate illustration, UI icon, sticker, low detail, blurry, washed out, overexposed, symmetrical mandala only, text title, Russian text, English title, watermark, logo, frame mockup, white border, rounded card border, decorative frame, corner ornaments, separate footer plaque, poster border, cropped head, cropped hands, unreadable tiny subject, crowded scene, modern city, sci-fi, cyberpunk
```

## Technical Requirements

### Dimensions

- Generate or crop to `1024x1536`.
- Keep the exact 2:3 ratio.
- Do not add transparent padding.
- Do not add a separate card border, corner ornaments, or footer plaque into the image unless explicitly approved. The UI already frames cards.

### Formats

For each committed card keep:

- WebP production asset: `public/assets/cards/{card-id}.webp`

PNG source files can be used temporarily during generation and optimization, but do not commit them to Git unless the user explicitly asks to keep a source archive in the repository.

### Optimization

Use `cwebp` for production WebP:

```bash
cwebp -q 82 public/assets/cards/{card-id}.png -o public/assets/cards/{card-id}.webp
```

Target:

- WebP weight: ideally under `350 KB`
- Hard ceiling: `500 KB` unless the user explicitly approves a heavier image
- PNG can be larger as a temporary local source, but should be removed before commit once the WebP is accepted.

After optimization check dimensions and size:

```bash
sips -g pixelWidth -g pixelHeight public/assets/cards/{card-id}.webp
ls -lh public/assets/cards/{card-id}.webp
```

## Naming Convention

Use stable lowercase kebab-case IDs:

- `ace-of-cups`
- `two-of-swords`
- `page-of-wands`
- `mirror`
- `threshold`

Rules:

- No spaces.
- No uppercase.
- No Cyrillic in filenames.
- No temporary names like `new-card-1`, `image-final`, `draft`.
- The same ID must be used in image filenames, `public/assets/cards.js`, Supabase `card_id`, and `src/lib/tarot.ts`.

## Text Direction

The daily-card text is a core product surface, not filler copy. Until the AI tarot reader exists, hardcoded card texts must feel like intentional mini-readings, not generated placeholders or encyclopedia excerpts.

For `public/assets/cards.js`:

- `description`: one short sentence for fallback/simple UI and journal summaries.
- `result.titleMeta`: one compact phrase after the card name, usually 4-8 words.
- `result.tags`: classification only, for example `Старший аркан`, `Младший аркан`, `Мечи`, `Придворная карта`.
- `result.meaningLabel`: use `Что это значит сегодня` for the main result block.
- `result.dayVariants`: 3-4 approved variants in the new `preview/full` format.
- `preview`: 1-2 paragraphs that are useful on their own and give the user a complete daily-card meaning.
- `full`: the exact same `preview` paragraphs first, followed by 1-3 additional paragraphs. `preview` must be a strict prefix of `full`, not a separate retelling.
- `share`: one short approved share text for the exact variant. This is a separate public-facing hook, not an automatic excerpt from `preview` or `full`.
- The classic Rider-Waite-Smith meaning should be embedded into the daily interpretation, not shown as a separate "what this card means in tarot" encyclopedia block.
- Use Rider-Waite-Smith as an internal writing reference, but do not expose niche deck names in user-facing readings. Prefer plain phrases like `в классическом таро`, `в канонах таро`, or `традиционно эта карта`.
- Prefer a tarot-session bridge in `full`: briefly name what is visible on the classic card, explain what that symbol means, then translate it into the user's day. The reader should feel that Mora is looking at the card with them, not just using the card as a prompt for generic advice.
- If the visual symbol is central to the day's advice, the bridge may start in `preview` so the user can read the result while looking at the card image and immediately understand what matters in the artwork.
- Do not make the bridge formulaic. It can sound like `на карте изображено… это говорит о… для тебя сегодня это значит…`, but it should remain a living reading, not an encyclopedia entry.
- Do not force every text into three paragraphs. Use paragraph breaks only when they help reading and each paragraph adds a new thought.
- Tone: clear human advice for the day, not vague esoteric noise.
- Mora is a fictional tarot-reader character, and the text should carry her presence. It is allowed and encouraged to use phrasing like `Мора говорит`, `Мора советует`, `Мора считает`, when it feels natural.
- Do not overuse the name Mora in every paragraph. One clear Mora-presence per reading is often enough.
- The voice is wise, calm, slightly mystical, and personal. It should not sound like stock tarot copy, corporate coaching, or generic AI output.
- Avoid vague translated-sounding abstractions and spatial metaphors that create unintended meanings. Prefer plain Russian phrasing: write `где можно выдохнуть рядом со своими` instead of `где тебя встретят без лишней защиты`; write `на что уже можно опереться` instead of `место, которое тебя держит`.
- No marketing excitement, no emoji, no overpromising.

The result screen layout is:

1. date, quiet and visually separate;
2. classification tags;
3. card title + `titleMeta`;
4. one main text block: `Что это значит сегодня`;
5. inline `Читать дальше` only when `full` has more text than `preview`;
6. actions.

Do not show a separate `Карта в таро` block on the main result screen. If a classic tarot meaning is useful, weave it into the daily-card interpretation.

Every new or rewritten `dayVariants` text must be manually approved by the author before the card is considered ready. The agent proposes 3-4 variants, the author reads them, rejects or edits weak variants, and only approved variants are integrated. Share texts require the same explicit visual/manual approval as `preview/full`: do not integrate `share` just because the main reading was approved.

Good Mora-style text:

```text
Сегодня не нужно решать всё сразу.
Выбери один честный шаг и сделай его спокойно.
Остальное станет яснее после движения.
```

Avoid:

```text
Вселенная открывает портал невероятных вибраций и зовёт тебя сиять.
```

### Daily Variety

The draw flow stores a `variantIdx` for the drawn card and uses local `mora:variantHistory` to avoid showing the same `dayVariants` text twice in a row for the same card on the same device. React screens read card texts through `src/lib/tarot.ts`, which adapts the single card source in `public/assets/cards.js`.

When adding new cards:

- Add 3-4 approved `dayVariants`.
- Prefer the object format `{ preview: string[], full: string[] }`.
- Ensure every `preview` is a strict prefix of its `full`.
- Make variants meaningfully different by daily scenario, not only by wording.
- Add matching `streetVariants` only if the street-mode interaction is still part of the card result UI.
- Preserve the saved variant: once a draw is created, dashboard/journal should show the same `variantIdx`, not recalculate a fresh text on every render.
- Add an explicitly author-approved `share` string to every new or rewritten `dayVariants` object. Share text is used when the user shares a freshly drawn card and must match the same `variantIdx`.
- Keep share unavailable for legacy variants without approved `share`: the UI may show the share icon disabled, but must not auto-generate production share copy from old text.
- Do not add separate text tables in React screens. Dashboard, journal, recent cards, and QA previews should use helpers from `src/lib/tarot.ts`.

## Code Integration Checklist

Before a new card is considered ready:

- [ ] WebP exists at `public/assets/cards/{card-id}.webp`.
- [ ] WebP is optimized and under target weight.
- [ ] Temporary PNG source is removed from Git/worktree before commit unless explicitly approved.
- [ ] Image is `1024x1536` or another approved 2:3 size.
- [ ] The artwork has no card title text, watermark, logo, or UI border.
- [ ] The artwork has no decorative frame, corner ornaments, or separate footer plaque.
- [ ] `public/assets/cards.js` includes the full card object.
- [ ] `src/lib/tarot.ts` derives metadata, daily meanings, journal summary, and image paths from `cards.js`.
- [ ] No separate dashboard/journal/recent-card text table was added.
- [ ] `/qa/cards` shows the card image, summary, and all prepared `dayVariants`.
- [ ] Each `dayVariants` entry uses `preview/full` unless there is an explicit compatibility reason.
- [ ] Each `preview` is a strict prefix of its `full`.
- [ ] Each new or rewritten `dayVariants` entry includes an author-approved `share` text.
- [ ] Author has manually approved every `share` text separately from `preview/full`.
- [ ] Author has manually approved every text variant.
- [ ] Text variants fit the landing result panel, dashboard daily-card block, journal rows, and recent-card tiles.
- [ ] Landing draw result checked on mobile `375px`.
- [ ] Landing draw result checked on desktop `1440px`.
- [ ] Dashboard daily-card block checked on mobile `375px` and desktop `1440px`.
- [ ] Journal list checked on mobile `375px` and desktop `1440px`.
- [ ] Recent cards checked with 0, 1, 2, and 3 cards.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.

## What Must Not Change

- Do not break Google auth.
- Do not break pending guest draw save after login.
- Do not break one-card-per-day logic.
- Do not change existing card IDs.
- Do not commit temporary PNG sources unless explicitly approved.
- Do not deploy without separate user approval.
