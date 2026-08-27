# Mora — Project Context

Read this file first in every new chat before making assumptions or asking setup questions.

## What This Is

Mora is an online tarot reader. Mora Next is the canonical production flow; the current phase is cleanup, release infrastructure and final UI/motion polish.

North Star: an AI tarot reader in chat. The daily card and journal are retention mechanics that keep the product useful until the AI reader is ready.

## Tech Snapshot

- Framework: Next.js 14 App Router
- Language: TypeScript / React
- Styling: vanilla CSS, no Tailwind or UI library
- Auth and database: Supabase
- Path alias: `@/*` -> `./src/*`
- Local dev URL: `http://localhost:3000`
- Production: `mora-kappa.vercel.app`
- Vercel project: `mora` (`prj_iNES6q89fIyBt1acJ2j7OfMY1ygB`); the retired `mora-vnkt` project must never be used

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

- `/` -> canonical Mora welcome in `public/welcome/`
- `/ritual` -> production daily-card and three-card spread UI in `public/ritual/`
- `/api/prototypes/tester-session` -> Supabase email OTP session for Mora Next
- `/api/prototypes/account-state` -> authenticated daily-card and last-spread state
- `/api/prototypes/spread-reading` -> Gemini reading with GigaChat fallback
- `/qa/cards` -> service QA preview of all tarot cards, images, and prepared daily-card texts. Local URL: `http://localhost:3000/qa/cards` (or the active dev port). Production/Vercel Preview requires `CARD_QA_TOKEN`.

## Important Files

- `CLAUDE.md` -> agent rules and working conventions
- `docs/project.md` -> product idea, audience, phase, north star
- `docs/current-work.md` -> живой handoff: почему идёт параллельный редизайн, что сделано в последнем цикле и что делать следующим
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

- guest daily-card ritual and result
- Supabase email OTP auth inside the canonical mobile/desktop flow
- authenticated daily card with server state and 12-hour cooldown
- authenticated three-card spread with topic selection, WebGL fan and AI reading
- last completed spread snapshot with five reading sections
- Gemini provider with GigaChat fallback and reservation protection
- responsive mobile and desktop layouts sharing one product flow
- deck currently has 77 cards: 22 major arcana and 55 minor/court cards
- latest visual-unification release added ten more existing minor canonical artworks: `four-of-cups`, `five-of-cups`, `ace-of-pentacles`, `two-of-pentacles`, `six-of-pentacles`, `three-of-pentacles`, `four-of-pentacles`, `five-of-pentacles`, `seven-of-pentacles`, `eight-of-pentacles`; together with the previous ten, twenty minor/court artworks are released in commit `eba5629` / deployment `dpl_94abEHnXqEygGNoegxDzSHQXbp3S`; a fifth approved batch (`two-of-wands` through `six-of-wands`) is integrated locally and awaits manual QA plus a separate commit/deploy request
- share-ready cards currently (69): `fool`, `magician`, `high-priestess`, `empress`, `emperor`, `hierophant`, `lovers`, `chariot`, `strength`, `hermit`, `wheel`, `justice`, `hanged-man`, `death`, `temperance`, `devil`, `tower`, `star`, `moon`, `sun`, `judgement`, `world`, `two-of-cups`, `six-of-cups`, `ace-of-swords`, `page-of-cups`, `king-of-cups`, `queen-of-cups`, `knight-of-cups`, `king-of-wands`, `queen-of-wands`, `knight-of-wands`, `four-of-swords`, `five-of-swords`, `seven-of-swords`, `queen-of-swords`, `king-of-swords`, `knight-of-swords`, `three-of-cups`, `four-of-cups`, `five-of-cups`, `ace-of-pentacles`, `two-of-pentacles`, `six-of-pentacles`, `three-of-pentacles`, `four-of-pentacles`, `five-of-pentacles`, `seven-of-pentacles`, `nine-of-pentacles`, `ten-of-pentacles`, `page-of-pentacles`, `king-of-pentacles`, `knight-of-pentacles`, `two-of-wands`, `four-of-wands`, `five-of-wands`, `six-of-wands`, `seven-of-wands`, `eight-of-wands`, `nine-of-wands`, `page-of-wands`, `page-of-swords`, `eight-of-cups`, `ten-of-cups`, `nine-of-cups`, `ten-of-wands`, `nine-of-swords`, `eight-of-swords`, `ten-of-swords`
- latest card addition: `ten-of-swords` / «Десятка Мечей»; approved dark aged-oil visual preserves one prone figure beneath exactly ten swords, a muted red cloth, calm water, distant mountains, black sky and a narrow golden dawn; the accepted integrated `X` marker uses the standard numbered-card helper, and the card has three approved `preview/full/share` readings about a stopped project, a relationship or agreement ending and recovery after overwork
- previous card addition: `knight-of-swords` / «Рыцарь Мечей»; approved dark aged-oil visual preserves one knight on one pale galloping horse, exactly one raised sword, a red plume and cloak, storm clouds and bent trees; the accepted footer reuses the full `K`-with-crown marker from `king-of-swords`, and the card has three approved `preview/full/share` readings about a rushed work task, a sharp exchange and a time-sensitive opportunity
- previous card addition: `knight-of-wands` / «Рыцарь Жезлов»; approved dark aged-oil visual preserves one knight on one energetically raised horse, exactly one flowering wand, a red plume, salamander-patterned clothing, a dry desert and distant pyramids; the accepted footer reuses the full `K`-with-crown marker from `king-of-wands`, and the card has three approved `preview/full/share` readings about a sudden opportunity, launching a delayed idea and pacing a new attraction
- previous card addition: `eight-of-swords` / «Восьмёрка Мечей»; approved aged-oil visual preserves the Rider-Waite-Smith composition of one blindfolded loosely bound woman with free feet, exactly eight upright swords in an open 4+4 enclosure, marshy water, an escape path and a distant castle; the accepted integrated `VIII` marker uses the standard numbered-card geometry, and the card has three approved `preview/full/share` readings about separating real blockers from fear, checking assumptions after a conversation and testing a choice with limited risk
- previous old-card update: `star` / «Звезда» received an approved 1024x1536 aged-oil visual with one clothed kneeling woman, two ewers pouring into water and onto land, one large star plus seven smaller stars, one bird in one tree and the standard integrated `XVII` marker; its three approved scene-first `preview/full/share` readings cover recovery after an overworked period, returning to a project after failure and reopening an important relationship after a quarrel
- latest old-card update: `world` / «Мир» received an approved 1024x1536 muted aged-oil engraving visual with one central dancer, exactly two wands, one complete oval laurel wreath, a human/angel upper left, eagle upper right, bull lower left, lion lower right and the standard helper-rendered `XXI` marker; its three approved `preview/full/share` readings begin from the wreath, central figure with two wands and four corner creatures, explain their canonical meanings and only then suggest how the card may resonate today without predicting a specific event
- previous old-card update: `judgement` / «Суд» received an approved 1024x1536 aged-oil visual with one robed angel, one trumpet, one white banner with one red cross, distinct men, women and children rising from open stone coffins, calm water, distant mountains and the standard helper-rendered `XX` marker; its three approved `preview/full/share` readings cover receiving a review of one's work, answering a returning opportunity and correcting an old action
- previous old-card update: `sun` / «Солнце» received an approved 1024x1536 dark aged-oil visual with one clothed child on one white horse, one faced sun, one red banner, a flower wreath with one red feather, a low stone wall, exactly four sunflowers and the standard helper-rendered `XIX` marker; its three approved `preview/full/share` readings cover recognizing a good result, asking a direct question and returning to a manageable rhythm after exhaustion
- daily and spread result actions use the current Mora Next UI; legacy dashboard/journal screens were archived and removed from production tree on 2026-08-23

Current work phase:

- Mora Next in `public/ritual/` is canonical production, not a parallel laboratory
- standalone 3D and legacy dashboard/journal/auth routes are archived outside the production tree
- current cleanup keeps only the static landing/spread UI, three protected APIs, Supabase server adapter, QA cards and shared assets
- cleanup и минимальная privacy-safe PostHog EU аналитика готовы; дальше домен/SMTP/auth redirects, metadata/SEO и закрытая бета
- cards-first continues in parallel; the latest controlled batches visually unified twenty existing minor/court cards after the approved twenty-card Major Arcana run, while `world` and `judgement` remain the locked style-and-palette references; only `three-of-swords` remains missing and must be handled last in a separate pass after an explicit instruction, without changing IDs or draw/save/journal mechanics; 8 old cards remain to be updated by text
- AI tarot chat is planned later, after the product feels presentable

## Working Rules

Before edits:

1. Read this file.
2. Read `docs/current-work.md` to understand the active workstream and latest handoff.
3. Read `directives/00-start-every-task.md`.
4. Read the relevant detailed doc in `docs/`.
5. Inspect the actual code before changing behavior.
6. Keep changes scoped to the user's request.

Use Ponytail mode by default: question whether the work is needed, prefer existing project patterns and native platform features, avoid new abstractions/dependencies, and take the smallest safe step. Do not use Ponytail as an excuse to skip Mora quality gates: auth, save flow, card canon, design system, accessibility, animations, approvals, and QA still matter.

If a task is estimated to take more than 10 minutes, warn the author before starting and propose splitting it into steps. Never leave the author without a status update for more than 2 minutes; if a command or process stalls or exceeds its expected duration, stop it yourself and immediately report what happened.

Do not rewrite working mechanics during UI work. Preserve current auth, daily card, spread reservation/generation and account snapshot behavior unless the user explicitly asks to change them.

When the user asks for "QA preview", "страницу с картами и текстами", or wants to inspect added cards, send the `/qa/cards` link for the active environment. Locally this is usually `http://localhost:3000/qa/cards`; if the dev server is on another port, use that port.

When the user says "разбираем фидбек" or sends a batch of MVP feedback/screenshots, read `directives/07-process-feedback.md` and use `docs/feedback.md` as the inbox. Do not turn every comment into a task automatically.

After meaningful product, architecture, or visual decisions, update `docs/decisions.md`.

Before commit, push, preview, or production deploy, read `directives/06-commit-and-deploy.md` and update docs/backlog/decisions so they say what is already done and what remains.

Before writing a handoff prompt for a new chat, first update `docs/current-work.md` so its latest cycle and next steps match the actual code and decisions.

If changes have been deployed, pushed to production, or used for a production preview, they must be committed. Do not leave production behavior only in the local working tree; git history is the source of truth for the next chat.
