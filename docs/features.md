# Features · Mora

## Production flow

### Welcome

- Одноразовый welcome-screen ведёт в ежедневный ритуал.
- После первого входа пользователь сразу попадает в Mora Next.
- Landing и ritual responsive на mobile и desktop.

### Авторизация

- Supabase email OTP встроен в Mora Next.
- Production OTP состоит из 6 цифр и отправляется через Resend Custom SMTP с отдельного поддомена `auth.moratarot.com`; Supabase quota — 30 писем/час, resend interval — 60 секунд.
- После подтверждения сессия принадлежит реальному `auth.uid()`.
- Logout очищает сессию и возвращает guest-state.
- Старые самостоятельные `/auth`, `/dashboard` и `/journal` удалены из production tree.

### Карта дня

- Guest и authenticated пользователь проходят один 3D-ритуал: стопка → clean cut → веер → выбор → flip → result.
- Guest-result сохраняется локально; authenticated state хранится на сервере.
- После cooldown экран атомарно возвращается к idle даже в давно открытой вкладке.
- Result прокручивается независимо от fixed background и учитывает Safari browser bar.
- Карта, chip, название, тексты и действия адаптируются к ширине viewport.
- «Поделиться» открывает системный share sheet на mobile/touch или браузерную отправку Telegram на desktop с названием карты, утверждённым share-текстом варианта и ссылкой на Mora.

### Расклад из трёх карт

- Guest видит объяснение и CTA входа; авторизованный пользователь выбирает тему.
- Доступны шесть тем: «Внутреннее состояние», «Карьера», «Отношения», «Поиск любви», «Финансы» и «Выбор». «Поиск любви» не предполагает наличие партнёра, «Карьера» охватывает текущую работу и её поиск, «Финансы» отделены от профессионального контекста.
- WebGL-веер поддерживает click/tap, drag на desktop и inertial swipe на mobile.
- Новый расклад заранее фиксирует три уникальные карты через Web Crypto, прогревает только их face-текстуры и сохраняет draft до завершения; любая выбранная рубашка раскрывает следующую позицию, а полёт не зависит от сети и при редком cache miss показывает имя со shimmer.
- AI создаёт пять секций: общий взгляд, прошлое, настоящее, будущее и итог.
- Переход к чтению выполняется только кнопкой «Читать расклад».
- Внутри каждой секции работает собственный вертикальный scroll; секции меняются только стрелками.
- Последний завершённый snapshot восстанавливается без повторной генерации.
- В итоговой секции «Поделиться» открывает системный share sheet на mobile/touch или Telegram на desktop с темой и названиями трёх карт.

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
- В колоде все 78 карт Rider–Waite–Smith; `three-of-swords` добавлена последней отдельным проходом.

## Release work

1. ✅ Production cleanup и clean URL выпущены.
2. ✅ Минимальная privacy-safe PostHog Cloud EU аналитика подключена без autocapture и session replay.
3. 🟡 UX/legal пакет `/privacy` и `/terms` визуально согласован и готов к release с `noindex`; перед индексацией нужна финальная правовая проверка адреса, retention и AI-провайдера.
4. ✅ Домен `moratarot.com`, Supabase Site URL/redirects и production SMTP настроены; тестовое шестизначное OTP-письмо доставлено.
5. ✅ Базовые metadata/SEO и OG-preview переведены на `moratarot.com`; дальше проверить индексацию и провести закрытую бету 7–14 дней на 20–30 пользователях.
6. Перед масштабированием подключить доступный платный AI provider и проверить structured logs на реальном раскладе.

## Не делаем сейчас

- отдельные mobile/desktop механики;
- возврат legacy dashboard/journal;
- полную историю раскладов и отдельную админ-панель;
- платную подписку до продуктовой проверки;
- большую SEO-контентную стратегию до закрытой беты;
- AI-чат до стабилизации текущего ритуала и release infrastructure.
