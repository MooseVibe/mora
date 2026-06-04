# Contributing to MORA

Thanks for taking an interest in MORA.

MORA is an early-stage pet project moving toward its first public release. The most useful contributions right now are careful bug reports, UI polish suggestions, accessibility notes, and focused improvements that preserve the existing product mechanics.

## Before You Start

Read these files first:

- `PROJECT_CONTEXT.md`
- `docs/project.md`
- `docs/architecture.md`
- `docs/design-system.md`
- The relevant file in `directives/`

The current product phase is UI polish for existing screens. Please avoid large rewrites unless they are discussed first.

## Development

Install dependencies:

```bash
npm install
```

Create `.env.local`:

```bash
cp .env.example .env.local
```

Run the app:

```bash
npm run dev
```

Run checks before opening a pull request:

```bash
npm run lint
npm run build
```

## Contribution Guidelines

- Keep changes scoped to the issue or task.
- Do not rewrite working auth, draw, save, journal, or pending-draw sync logic without a clear reason.
- Follow the visual language in `docs/design-system.md`.
- Check both mobile and desktop layouts when touching UI.
- Add or update docs when a product, architecture, or visual decision changes.
- Avoid adding new dependencies unless they clearly reduce complexity.

## Pull Requests

A good pull request includes:

- A short description of the change
- Screenshots for UI work
- Notes about mobile and desktop checks
- Any relevant tradeoffs or follow-up work

## Issues

For bug reports, include:

- What happened
- What you expected
- Steps to reproduce
- Browser/device if the issue is visual or interaction-related
