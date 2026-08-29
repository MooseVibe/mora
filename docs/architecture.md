# Architecture

## Стек

- **Framework:** Next.js 14 App Router, deployment на Vercel.
- **UI:** production landing и ritual — статические HTML/CSS/ES modules; служебный `/qa/cards` — React.
- **3D:** Three.js `0.180.0`, vendored same-origin в `public/vendor/three/`.
- **Auth и данные:** Supabase Auth + PostgreSQL через server-side `@supabase/ssr`.
- **AI:** Gemini с GigaChat fallback через защищённый Route Handler.
- **Production:** `https://moratarot.com` на Vercel project `mora`. Служебный alias `mora-kappa.vercel.app` постоянно перенаправляется на канонический домен; проект `mora-vnkt` удалён и не используется.

## Канонический flow

```text
/
└── internal rewrite → /welcome/index.html
    └── /ritual
        └── internal rewrite → /ritual/index.html
            ├── /api/prototypes/tester-session
            ├── /api/prototypes/account-state
            └── /api/prototypes/spread-reading
                ├── Supabase
                ├── Gemini
                └── GigaChat fallback
```

Публичный UI использует только `/` и `/ritual`; старые `/prototypes/*` UI-адреса отсутствуют. Название `prototypes` пока остаётся только во внутренних API-контрактах и меняется отдельной серверной задачей. Старые `/auth`, `/dashboard`, `/journal`, `/api/draws`, React-компоненты MVP и standalone 3D-лаборатория удалены из production tree после создания Git archive point `archive/pre-cleanup-2026-08-23`.

## Структура проекта

```text
mora/
├── public/
│   ├── assets/
│   │   ├── cards.js              # единый источник колоды и текстов
│   │   ├── cards/*.webp          # production-изображения карт
│   │   ├── fonts.css + fonts/    # Spectral SC и Inter Display
│   │   └── 3d/                   # deck/result GLB и WebP-рубашка
│   ├── welcome/                  # одноразовый welcome-screen
│   ├── ritual/                   # production daily/spread UI и WebGL
│   └── vendor/three/0.180.0/      # локальные неизменённые Three.js modules
├── src/
│   ├── app/
│   │   ├── layout.tsx            # metadata и локальные шрифты
│   │   ├── qa/cards/              # служебный noindex QA колоды
│   │   └── api/prototypes/        # session, account state, AI reading
│   └── lib/
│       ├── prototype-testers.ts   # limits/admin policy
│       ├── tarot.ts               # TypeScript adapter для cards.js
│       └── supabase/server.ts     # server-side Supabase client
├── supabase/                      # migrations и Edge Function account-state
├── docs/                          # product, design, decisions, handoff
└── directives/                    # рабочие процессы агента
```

## Ключевые модули

| Модуль | Файл / папка | Что делает |
|---|---|---|
| Welcome | `public/welcome/` | Первый осознанный вход `/` и переход в ritual |
| Daily и spread UI | `public/ritual/index.html`, `styles.css`, `app.js` | Полный guest/auth mobile+desktop flow на `/ritual`, локальная навигация и состояния |
| Daily WebGL | `public/ritual/daily-3d.js` | Стопка, clean cut, веер, flip и handoff карты дня |
| Spread WebGL | `public/ritual/spread-deck-3d.js` | Веер, inertial swipe, выбор и полёт трёх карт |
| Данные карт | `public/assets/cards.js` + `src/lib/tarot.ts` | Один источник ID, изображений, канона и reading-текстов |
| 3D-ассеты | `public/assets/3d/` | `mora-card.glb`, `mora-card-result.glb`, `mora-card-back.webp` |
| Auth | `src/app/api/prototypes/tester-session/route.ts` | Supabase email OTP и logout текущего пользователя |
| Account state | `src/app/api/prototypes/account-state/route.ts` | Карта дня, cooldown и последний spread snapshot по `auth.uid()` |
| AI reading | `src/app/api/prototypes/spread-reading/route.ts` | Reservation, Gemini, GigaChat fallback, сохранение валидного чтения и обезличенные provider/latency/token logs |
| QA колоды | `src/app/qa/cards/` | Служебный noindex-preview; production требует `CARD_QA_TOKEN` |

## Договорённости по коду

1. Не переписывать утверждённую механику без отдельной задачи и ручного QA.
2. Не создавать второй mobile/desktop flow: responsive состояния используют общую логику.
3. `public/assets/cards.js` остаётся единственным источником карт и текстов.
4. TypeScript-типы обязательны на API/Supabase границах; `any` — только с объяснением.
5. Production UI не получает новые зависимости без доказанной необходимости.

## Окружения и команды

- dev: `npm run dev` (`localhost:3000`, при необходимости `3001/3002`)
- production: `moratarot.com`
- проверки: `npm run lint`, `npm run build`, `git diff --check`

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
GIGACHAT_...=...
CARD_QA_TOKEN=...
```

Публичные `NEXT_PUBLIC_*` используются только для конфигурации Supabase. Provider/service secrets остаются server-side и никогда не передаются browser-коду.
