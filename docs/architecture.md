# Architecture

## Стек

- **Фреймворк:** Next.js (деплой на Vercel)
- **Язык:** TypeScript / JavaScript (агент: проверь по `package.json` перед началом работы)
- **Стили:** Vanilla CSS — единый файл `public/assets/styles.css` + отдельные CSS-файлы для страниц (`dashboard.css`, `journal.css`). Никаких CSS Modules, Tailwind, styled-components или UI-библиотек.
- **Авторизация:** Google OAuth + обычная авторизация
- **БД / хранилище:** Supabase (PostgreSQL). Таблица `card_draws` хранит `user_id`, `card_id`, `drawn_at`, а для новых вытягиваний также `variant_idx` и `reading_snapshot` с fallback-совместимостью для старой схемы. Клиент для браузера — `@supabase/ssr` createBrowserClient; для Server Components/Route Handlers — createServerClient.
- **Деплой:** Vercel project `mora` (`prj_iNES6q89fIyBt1acJ2j7OfMY1ygB`), прод на `mora-kappa.vercel.app`

> Если что-то из списка `[нужно уточнить]` — открой код и заполни этот файл. Не работай со слепыми догадками.

## Структура проекта

> Этот раздел заполняется по факту. Агент, при первой работе с проектом, должен зайти в репо, посмотреть структуру и описать её здесь. Шаблон ниже.

```
mora/
├── public/
│   └── assets/
│       ├── styles.css          # главная таблица стилей (подключается через <link> в layout)
│       ├── app.js              # точка входа клиентского JS (ES-модуль, грузится динамически)
│       ├── draw.js             # логика вытягивания карты
│       ├── cards.js            # данные/логика колоды
│       ├── gallery.js          # просмотр галереи колоды
│       ├── arc.js              # анимации арки
│       ├── state.js            # глобальное состояние на клиенте
│       ├── loader.js           # управление лоадером
│       ├── image-cache.js      # предзагрузка изображений
│       └── cards/              # изображения карт; новые карты коммитятся как WebP
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # корневой layout (подключает шрифты, styles.css)
│   │   ├── globals.css         # сброс box-sizing/margin/padding
│   │   ├── page.tsx            # / → <TaroApp />
│   │   ├── auth/
│   │   │   ├── page.tsx        # страница /auth
│   │   │   ├── AuthForm.tsx    # форма входа (Google OAuth + Email OTP)
│   │   │   ├── callback/route.ts   # обмен OAuth-кода на сессию
│   │   │   ├── login/route.ts      # вспомогательный маршрут
│   │   │   └── logout/route.ts     # выход, очистка сессии
│   │   ├── dashboard/
│   │   │   ├── page.tsx        # личный кабинет (Server Component, требует auth)
│   │   │   └── dashboard.css
│   │   ├── journal/
│   │   │   ├── page.tsx        # дневник карт: список/фильтры + full-result reader записей
│   │   │   └── journal.css
│   │   └── api/
│   │       ├── draws/route.ts  # POST /api/draws — сохранение вытянутой карты
│   │       ├── prototypes/tester-session/route.ts # обязательный email OTP Mora Next
│   │       ├── prototypes/account-state/route.ts # карта дня и snapshot расклада текущего Auth user
│   │       └── prototypes/spread-reading/route.ts # защищённый Gemini-only текст расклада
│   ├── components/
│   │   ├── TaroApp.tsx         # главный клиентский компонент лендинга
│   │   ├── DrawWidget.tsx      # виджет вытягивания для дашборда
│   │   ├── RecentCardsWidget.tsx # виджет последних карт на dashboard; открывает записи через DashboardCardReader
│   │   ├── DashboardCardReader.tsx # shared-element full-result reader для dashboard и journal-карт
│   │   ├── DashboardTodayCard.tsx # уже вытянутая карта дня на dashboard
│   │   ├── DashboardShareButton.tsx # Telegram-first/Web Share кнопка для approved shareText
│   │   ├── JournalClient.tsx   # клиентский список дневника с фильтрами периода и reader записей
│   │   └── CardSyncOnMount.tsx # sync: localStorage → Supabase при входе
│   ├── lib/
│   │   └── supabase/
│   │       ├── client.ts       # createBrowserClient (для 'use client')
│   │       └── server.ts       # createServerClient (для Server Components/Route Handlers)
│   ├── middleware.ts            # обновляет сессию Supabase на каждом запросе
│   └── types/
│       └── global.d.ts
├── next.config.mjs             # пустой — никаких кастомных настроек
├── tsconfig.json               # paths: "@/*" → "./src/*"
└── package.json
```

**Псевдоним пути:** `@/*` → `./src/*`

## Ключевые модули и где они живут

| Модуль | Файл / папка | Что делает |
|---|---|---|
| Авторизация | `src/app/auth/` | Google OAuth + Email OTP через Supabase. Callback → `/auth/callback/route.ts` |
| Вытягивание карты | `public/assets/draw.js` + `src/app/api/draws/route.ts` | Клиентская анимация + POST в БД. Защита: одна карта в день через `drawn_at`. Pending draw у незалогиненных — в localStorage. Новые записи сохраняют `variant_idx` и `reading_snapshot`, если схема БД поддерживает snapshot |
| Данные карт | `public/assets/cards.js` + `src/lib/tarot.ts` | `cards.js` — единый источник текстов/картинок для нативного draw-flow; `tarot.ts` — TypeScript-адаптер для React-экранов |
| Дашборд | `src/app/dashboard/page.tsx` | Server Component. Загружает карту дня и 3 последних вытягивания из Supabase |
| Full-result reader | `src/components/DashboardCardReader.tsx` | Shared-element раскрытие сегодняшней карты, recent cards и записей дневника, чтение сохранённого/fallback reading, share при approved `shareText` |
| Дневник карт | `src/app/journal/page.tsx` + `src/components/JournalClient.tsx` | Полный список вытягиваний пользователя с фильтрами и full-result reader для записей; outcome/note пока визуальные, без сохранения состояния |
| QA просмотр карт | `src/app/qa/cards/page.tsx` | Служебный noindex-preview всех карт и вариантов текстов. Локально открыт, в production требует `CARD_QA_TOKEN` |
| Sync pending draw | `src/components/CardSyncOnMount.tsx` | При входе читает `mora:pendingDraw` из localStorage и отправляет в `/api/draws` |
| AI-расклад Mora Next | `src/app/api/prototypes/spread-reading/route.ts` | Требует подтверждённую Supabase Auth-сессию, атомарно резервирует попытку текущего `user_id` до Gemini и сохраняет snapshot только после валидного чтения |
| Account-state Mora Next | `src/app/api/prototypes/account-state/route.ts` + `supabase/functions/prototype-tester-session/index.ts` | Начальный read/bootstrap выполняет authenticated RPC: публичный `security invoker` wrapper вызывает реализацию в закрытой схеме, которая определяет владельца только через `auth.uid()`. Записи передают access token в Edge Function v7 с проверкой JWT. Закрытая RLS-таблица `prototype_account_states` хранит server-pending/complete карты дня, последний spread snapshot и 12-часовые timestamps по `auth.users.id` |
| Tester-session | `src/app/api/prototypes/tester-session/route.ts` | Любой email входит через Supabase OTP; старые tester-cookie очищаются и больше не определяют владельца данных |
| Mora Next | `public/prototypes/spread/` | Изолированный UI/WebGL-прототип карты дня и расклада; production-маршруты не заменяет. `daily-3d.js` обслуживает утверждённую карту дня, `spread-deck-3d.js` — пока неутверждённый 3D-flow выбора трёх карт |
| 3D-ассеты карт | `public/prototypes/3d-daily/assets/` | `mora-card.glb` используется для стопок и вееров; `mora-card-result.glb` — только для крупных выбранных/result-карт. Имена mesh/material, особенно `_front`, считаются контрактом кода |

### Mora Next и 3D-лаборатория

- `public/prototypes/spread/index.html`, `styles.css`, `app.js` — экран и продуктовые состояния Mora Next, включая невидимые DOM hit targets для веера расклада.
- `public/prototypes/spread/daily-3d.js` — утверждённый полный 3D-flow карты дня: стопка, clean cut, веер, выбор, сохранение и result.
- `public/prototypes/spread/spread-deck-3d.js` — экспериментальный WebGL-слой расклада; click-flow трёх карт ещё требует ручного QA, drag остаётся 2D.
- `public/prototypes/3d-daily/app.js` и соседние ассеты — исходная отдельная лаборатория. Не удалять её до полного аппрува Mora Next 3D-flow.

## Договорённости по коду

1. **Не переписывай рабочую логику без явной задачи.** Если экран работает — трогай только визуал.
2. **Компоненты в одну папку — стили + разметка + типы.** Не размазывай один компонент по 5 файлам без необходимости.
3. **TypeScript-типы — обязательны** для всего, что приходит с бэкенда или из БД.
4. **Никаких `any`** без комментария почему.

## Окружения

- **dev:** локально на `localhost:3000`
- **prod:** `mora-kappa.vercel.app`

## Команды разработки

```bash
npm run dev      # dev-сервер на http://localhost:3000
npm run build    # production-сборка
npm run start    # запуск production-сборки
npm run lint     # ESLint
```

## Переменные окружения

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
GEMINI_API_KEY=...
```

Значения `NEXT_PUBLIC_` публичные и используются на клиенте и сервере. `GEMINI_API_KEY` остаётся только в deployment environment и никогда не передаётся браузеру.

## Ключевые архитектурные особенности

**Два слоя JS.** Вся анимационная/игровая логика (перетасовка, флип, галерея) живёт в `public/assets/*.js` как нативные ES-модули без React. Next.js отвечает за SSR, auth и API. `TaroApp.tsx` подключает `app.js` динамически через `<script type="module">` после монтирования.

**Нет клиентских переходов (Next.js router).** Навигация между страницами — `window.location.href` с ручным overlay-лоадером (`#appLoader`). Так сохраняется полный контроль над анимацией перехода.
