# MORA

MORA is an early-stage online tarot reader built with Next.js and Supabase.

The current MVP lets people draw a daily tarot card, save it after signing in, and keep a personal journal of past cards. The long-term direction is an AI tarot reader in chat: a calm, always-available reader that can answer a question, make a spread, explain the cards, and continue the conversation.

MORA is currently a pet project moving toward its first public release. The repository is open to document the product, implementation choices, and reusable patterns behind ritual-feeling tarot interfaces.

## Status

MVP works:

- Daily card draw for unauthenticated visitors
- Google and email authentication
- Authenticated daily card, limited to one draw per day
- Automatic save to the card journal
- Dashboard with today's card and recent cards
- Journal with card history

In progress:

- UI polish for dashboard and journal
- AI-generated summaries and the future AI tarot chat
- Release-readiness work

## Tech Stack

- Next.js 14 App Router
- TypeScript and React
- Supabase for auth and database
- Vanilla CSS, without Tailwind or a component library
- Vercel deployment

## Getting Started

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Set the Supabase values in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```text
src/app/                  Next.js App Router pages, route handlers, layout
src/components/           React components for the app screens and widgets
src/lib/supabase/         Supabase browser and server clients
public/assets/            Client-side tarot animation code, card data, images, CSS
docs/                     Product, architecture, design system, feature docs
directives/               Agent workflows for redesigns, features, and bug fixes
```

Important docs:

- [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) - fast project overview
- [docs/project.md](docs/project.md) - product idea and north star
- [docs/architecture.md](docs/architecture.md) - stack, structure, commands
- [docs/design-system.md](docs/design-system.md) - visual language and UI rules
- [docs/features.md](docs/features.md) - current and planned features

## Product Direction

MORA is not meant to feel like a generic dashboard. The product direction is based on three principles:

- The first useful moment should be immediate: a visitor can draw a card before registering.
- Atmosphere matters: card drawing, transitions, and copy should feel like a ritual.
- AI is the north star: daily cards and the journal are retention mechanics until the AI reader is ready.

## Contributing

This project is early, but contributions and thoughtful feedback are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md) and the docs in `docs/`.

For security reports, see [SECURITY.md](SECURITY.md).

## License

MORA is licensed under the [MIT License](LICENSE).
