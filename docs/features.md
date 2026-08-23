# Features · Mora

## Production flow

### Welcome

- Одноразовый welcome-screen ведёт в ежедневный ритуал.
- После первого входа пользователь сразу попадает в Mora Next.
- Landing и ritual responsive на mobile и desktop.

### Авторизация

- Supabase email OTP встроен в Mora Next.
- После подтверждения сессия принадлежит реальному `auth.uid()`.
- Logout очищает сессию и возвращает guest-state.
- Старые самостоятельные `/auth`, `/dashboard` и `/journal` удалены из production tree.

### Карта дня

- Guest и authenticated пользователь проходят один 3D-ритуал: стопка → clean cut → веер → выбор → flip → result.
- Guest-result сохраняется локально; authenticated state хранится на сервере.
- После cooldown экран атомарно возвращается к idle даже в давно открытой вкладке.
- Result прокручивается независимо от fixed background и учитывает Safari browser bar.
- Карта, chip, название, тексты и действия адаптируются к ширине viewport.

### Расклад из трёх карт

- Guest видит объяснение и CTA входа; авторизованный пользователь выбирает тему.
- WebGL-веер поддерживает click/tap, drag на desktop и inertial swipe на mobile.
- Три выбранные карты получают настоящие face-текстуры, компактные подписи и переходят в generation state.
- AI создаёт пять секций: общий взгляд, прошлое, настоящее, будущее и итог.
- Переход к чтению выполняется только кнопкой «Читать расклад».
- Внутри каждой секции работает собственный вертикальный scroll; секции меняются только стрелками.
- Последний завершённый snapshot восстанавливается без повторной генерации.

### AI и ограничения

- `spread-reading` требует подтверждённую Supabase session.
- Попытка резервируется атомарно до provider call.
- Gemini — основной provider, GigaChat — fallback.
- Каждая provider-попытка пишет один обезличенный structured log: provider/model, latency, token usage, status и requestId; prompt, email и карты не логируются.
- Некорректный provider response не сохраняется и освобождает reservation.
- Обычный аккаунт получает новый завершённый расклад после 12-часового cooldown; admin не ограничен.
- Полная история раскладов пока не хранится: только последний snapshot.

### Колода

- `public/assets/cards.js` — единый источник карт, текстов и metadata.
- В production используются WebP-изображения.
- Служебный `/qa/cards` показывает колоду и reading-варианты; production требует `CARD_QA_TOKEN`.
- В колоде 77 карт; `three-of-swords` остаётся последней недостающей картой и добавляется только отдельной задачей.

## Release work

1. Выпустить текущий production cleanup и clean URL.
2. Добавить минимальную first-party продуктовую аналитику.
3. Купить домен, настроить Vercel, Supabase Site URL/redirects и production SMTP.
4. Сделать базовые metadata/SEO и провести закрытую бету 7–14 дней на 20–30 пользователях.
5. Перед масштабированием подключить доступный платный AI provider и проверить structured logs на реальном раскладе.

## Не делаем сейчас

- отдельные mobile/desktop механики;
- возврат legacy dashboard/journal;
- полную историю раскладов и отдельную админ-панель;
- платную подписку до продуктовой проверки;
- большую SEO-контентную стратегию до закрытой беты;
- AI-чат до стабилизации текущего ритуала и release infrastructure.
