# Architecture

## Стек

- **Фреймворк:** Next.js (деплой на Vercel)
- **Язык:** TypeScript / JavaScript (агент: проверь по `package.json` перед началом работы)
- **Стили:** Vanilla CSS — единый файл `public/assets/styles.css` + отдельные CSS-файлы для страниц (`dashboard.css`, `journal.css`). Никаких CSS Modules, Tailwind, styled-components или UI-библиотек.
- **Авторизация:** Google OAuth + обычная авторизация
- **БД / хранилище:** Supabase (PostgreSQL). Таблица `card_draws` (`user_id`, `card_id`, `drawn_at`). Клиент для браузера — `@supabase/ssr` createBrowserClient; для Server Components/Route Handlers — createServerClient.
- **Деплой:** Vercel, прод на `mora-vnkt.vercel.app`

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
│       └── cards/              # изображения 22 арканов (PNG + WebP-обложка)
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
│   │   │   ├── page.tsx        # дневник карт (WIP)
│   │   │   └── journal.css
│   │   └── api/
│   │       └── draws/route.ts  # POST /api/draws — сохранение вытянутой карты
│   ├── components/
│   │   ├── TaroApp.tsx         # главный клиентский компонент лендинга
│   │   ├── DrawWidget.tsx      # виджет вытягивания для дашборда
│   │   ├── RecentCardsWidget.tsx # виджет последних карт
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
| Вытягивание карты | `public/assets/draw.js` + `src/app/api/draws/route.ts` | Клиентская анимация + POST в БД. Защита: одна карта в день через `drawn_at`. Pending draw у незалогиненных — в localStorage |
| Дашборд | `src/app/dashboard/page.tsx` | Server Component. Загружает карту дня и 3 последних вытягивания из Supabase |
| Дневник карт | `src/app/journal/page.tsx` | WIP. Полный список вытягиваний пользователя |
| Sync pending draw | `src/components/CardSyncOnMount.tsx` | При входе читает `mora:pendingDraw` из localStorage и отправляет в `/api/draws` |

## Договорённости по коду

1. **Не переписывай рабочую логику без явной задачи.** Если экран работает — трогай только визуал.
2. **Компоненты в одну папку — стили + разметка + типы.** Не размазывай один компонент по 5 файлам без необходимости.
3. **TypeScript-типы — обязательны** для всего, что приходит с бэкенда или из БД.
4. **Никаких `any`** без комментария почему.

## Окружения

- **dev:** локально на `localhost:3000`
- **prod:** `mora-vnkt.vercel.app`

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
```

Оба значения публичные (`NEXT_PUBLIC_`), используются и на клиенте, и на сервере.

## Ключевые архитектурные особенности

**Два слоя JS.** Вся анимационная/игровая логика (перетасовка, флип, галерея) живёт в `public/assets/*.js` как нативные ES-модули без React. Next.js отвечает за SSR, auth и API. `TaroApp.tsx` подключает `app.js` динамически через `<script type="module">` после монтирования.

**Нет клиентских переходов (Next.js router).** Навигация между страницами — `window.location.href` с ручным overlay-лоадером (`#appLoader`). Так сохраняется полный контроль над анимацией перехода.
