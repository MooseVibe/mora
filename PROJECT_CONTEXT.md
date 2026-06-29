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
- `docs/banned-phrases.md` -> живой словарь плохих фраз, которые нельзя использовать в текстах Mora
- `docs/auth-email.md` -> настройка email OTP, Supabase templates, Custom SMTP и rate limits
- `docs/feedback.md` -> inbox and processing log for MVP user feedback from chats/screenshots
- `BACKLOG.md` -> release backlog for MVP-test bugs, UX debts, and pre-release fixes
- `directives/00-start-every-task.md` -> mandatory start for every task: Ponytail mode, smallest safe step, no unnecessary code
- `directives/06-commit-and-deploy.md` -> required checklist before commit, push, preview, or production deploy
- `directives/07-process-feedback.md` -> workflow for turning raw chat feedback/screenshots into signals, backlog items, text notes, or decisions
- `directives/` -> task workflows for redesigns, features, bugs, tarot cards, text updates, commits, deploys, and feedback review
- `docs/competitors.md` -> competitor analysis and market notes

## Current Product State

Working MVP:

- Google auth and email auth
- unauthenticated daily card draw
- authenticated daily card draw, limited to once per day
- automatic save to journal
- dashboard with daily card and recent cards
- dashboard recent cards open through the full-result reader with the saved/fallback reading text
- journal with drawn card history, period filters, desktop table layout, and full-result reader for journal entries; visual outcome actions are still placeholders without saved state
- deck currently has 62 cards: 22 major arcana and 40 minor/court cards
- share-ready cards currently: `fool`, `magician`, `high-priestess`, `empress`, `emperor`, `hierophant`, `lovers`, `chariot`, `strength`, `hermit`, `wheel`, `justice`, `tower`, `two-of-cups`, `six-of-cups`, `ace-of-swords`, `page-of-cups`, `king-of-cups`, `four-of-swords`, `three-of-cups`, `four-of-cups`, `five-of-cups`, `ace-of-pentacles`, `two-of-pentacles`, `six-of-pentacles`, `three-of-pentacles`, `four-of-pentacles`, `five-of-pentacles`, `seven-of-pentacles`, `nine-of-pentacles`, `ten-of-pentacles`, `two-of-wands`, `four-of-wands`, `five-of-wands`, `six-of-wands`, `seven-of-wands`, `eight-of-wands`, `nine-of-wands`, `page-of-wands`, `page-of-swords`, `eight-of-cups`, `ten-of-cups`, `nine-of-cups`, `ten-of-wands`, `nine-of-swords`
- latest card addition: `ten-of-pentacles` / «Десятка Пентаклей»; approved visual keeps Rider-Waite-Smith logic of several generations near a home/arch, exactly ten visible pentacles, a child and two dogs, with a standard integrated `X` marker
- latest old-card text update: `justice` / «Справедливость» in `preview/full/share`, rewritten around the card symbols of sword, scales, facts, and one precise example for an honest conversation; approved with separate `share` texts
- dashboard share icon works for today's share-ready card and uses the same Telegram-first/Web Share fallback as the fresh result screen
- recent-card reader on dashboard is already implemented via `RecentCardsWidget` + `DashboardCardReader`; do not list it as a future task

Current work phase:

- UI redesign and polish for existing screens
- dashboard and journal are the active areas
- immediate mode: finish the card-response MLP before deeper Figma/mockup work; treat it as first response to a card, not as “prediction came true”
- current card-response progress: desktop `DashboardCardReader` has a Figma-based draft with `Принимаю / Не принимаю`, local confirmation text, and “Читать дальше” truncation; saving the response to the journal and the third `Пока не понимаю` option are still next steps
- proposed final response options: `Принимаю / Не моё / Пока не понимаю`; after tap, show a short hardcoded confirmation and save the response to the journal; no coins, statistics, evening checks, or AI explanation in the first pass
- cards-first continues in parallel one card per pass; next card pass is one old-card text update via `directives/05-update-card-texts.md`; do not change card art, IDs, draw/save/journal mechanics, or start `three-of-swords`
- AI tarot chat is planned later, after the product feels presentable

## Working Rules

Before edits:

1. Read this file.
2. Read `directives/00-start-every-task.md`.
3. Read the relevant detailed doc in `docs/`.
4. Inspect the actual code before changing behavior.
5. Keep changes scoped to the user's request.

Use Ponytail mode by default: question whether the work is needed, prefer existing project patterns and native platform features, avoid new abstractions/dependencies, and take the smallest safe step. Do not use Ponytail as an excuse to skip Mora quality gates: auth, save flow, card canon, design system, accessibility, animations, approvals, and QA still matter.

Do not rewrite working mechanics during UI work. Preserve auth, card draw, save, journal, and pending-draw sync behavior unless the user explicitly asks to change them.

When the user asks for "QA preview", "страницу с картами и текстами", or wants to inspect added cards, send the `/qa/cards` link for the active environment. Locally this is usually `http://localhost:3000/qa/cards`; if the dev server is on another port, use that port.

When the user says "разбираем фидбек" or sends a batch of MVP feedback/screenshots, read `directives/07-process-feedback.md` and use `docs/feedback.md` as the inbox. Do not turn every comment into a task automatically.

After meaningful product, architecture, or visual decisions, update `docs/decisions.md`.

Before commit, push, preview, or production deploy, read `directives/06-commit-and-deploy.md` and update docs/backlog/decisions so they say what is already done and what remains.

If changes have been deployed, pushed to production, or used for a production preview, they must be committed. Do not leave production behavior only in the local working tree; git history is the source of truth for the next chat.
