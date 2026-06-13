# Mora — Project Context

Read this file first in every new chat before making assumptions or asking setup questions.

## What This Is

Mora is an online tarot reader. The MVP already works; the current phase is polishing existing screens and UI, not rebuilding the product from scratch.

North Star: an AI tarot reader in chat. The daily card and journal are retention mechanics that keep the product useful until the AI reader is ready.

## Tech Snapshot

- Framework: Next.js 14 App Router
- Language: TypeScript / React
- Styling: vanilla CSS, no Tailwind or UI library
- Auth and database: Supabase
- Path alias: `@/*` -> `./src/*`
- Local dev URL: `http://localhost:3000`
- Production: `mora-vnkt.vercel.app`

## Start The App

```bash
npm run dev
```

Default dev server: `http://localhost:3000`.

If port 3000 is busy, use:

```bash
npm run dev -- -p 3001
```

Then try `3002` if needed.

## Main App Areas

- `/` -> landing and unauthenticated daily card flow via `src/components/TaroApp.tsx`
- `/auth` -> login and save-card auth flow
- `/dashboard` -> authenticated daily card dashboard
- `/journal` -> authenticated card journal
- `/qa/cards` -> service QA preview of all tarot cards, images, and prepared daily-card texts. Local URL: `http://localhost:3000/qa/cards` (or the active dev port). Production/Vercel Preview requires `CARD_QA_TOKEN`.
- `/api/draws` -> stores drawn cards in Supabase

## Important Files

- `CLAUDE.md` -> agent rules and working conventions
- `docs/project.md` -> product idea, audience, phase, north star
- `docs/architecture.md` -> stack, structure, commands, environment
- `docs/design-system.md` -> visual language, colors, animation principles
- `docs/features.md` -> current MVP, WIP, planned features
- `docs/decisions.md` -> decisions log
- `docs/card-style.md` -> tarot card art/text rules and add-card QA checklist
- `BACKLOG.md` -> release backlog for MVP-test bugs, UX debts, and pre-release fixes
- `directives/` -> task workflows for redesigns, features, and bugs
- `docs/competitors.md` -> competitor analysis and market notes

## Current Product State

Working MVP:

- Google auth and email auth
- unauthenticated daily card draw
- authenticated daily card draw, limited to once per day
- automatic save to journal
- dashboard with daily card and recent cards
- dashboard recent cards open through the full-result reader with the saved/fallback reading text
- journal with drawn card history, period filters, and visual outcome/note actions; full-result reader for journal entries is still WIP
- deck currently has 43 cards: 22 major arcana and 21 minor/court cards
- share-ready cards currently: `fool`, `magician`, `high-priestess`, `emperor`, `hierophant`, `lovers`, `chariot`, `two-of-cups`, `six-of-cups`, `page-of-cups`, `ace-of-swords`, `three-of-cups`, `four-of-swords`, `two-of-pentacles`, `six-of-pentacles`, `two-of-wands`, `four-of-wands`
- latest card addition: `four-of-swords` / «Четвёрка Мечей»; approved visual preserves the Rider-Waite-Smith resting figure, three swords above, one sword below, chapel/resting slab composition, and translates pause/recovery into Mora's darker ritual style
- latest old-card text/image update: `high-priestess` / «Жрица» in `preview/full/share`, with a regenerated canonical visual: B/J columns, pomegranate veil, scroll, lunar crown, crescent moon, and only `II` in the footer marker zone
- dashboard share icon works for today's share-ready card and uses the same Telegram-first/Web Share fallback as the fresh result screen
- recent-card reader on dashboard is already implemented via `RecentCardsWidget` + `DashboardCardReader`; do not list it as a future task

Current work phase:

- UI redesign and polish for existing screens
- dashboard and journal are the active areas
- AI tarot chat is planned later, after the product feels presentable

## Working Rules

Before edits:

1. Read this file.
2. Read the relevant detailed doc in `docs/`.
3. Inspect the actual code before changing behavior.
4. Keep changes scoped to the user's request.

Do not rewrite working mechanics during UI work. Preserve auth, card draw, save, journal, and pending-draw sync behavior unless the user explicitly asks to change them.

When the user asks for "QA preview", "страницу с картами и текстами", or wants to inspect added cards, send the `/qa/cards` link for the active environment. Locally this is usually `http://localhost:3000/qa/cards`; if the dev server is on another port, use that port.

After meaningful product, architecture, or visual decisions, update `docs/decisions.md`.

If changes have been deployed, pushed to production, or used for a production preview, they must be committed. Do not leave production behavior only in the local working tree; git history is the source of truth for the next chat.
