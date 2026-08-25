# Mora — карта персональных данных

Статус: read-only аудит от 25 августа 2026 года. Это техническая карта для подготовки релиза, а не юридическое заключение.

## Что происходит сейчас

| Данные | Откуда | Куда | Что хранится |
|---|---|---|---|
| Email, user ID, auth-сессия | Форма входа | Supabase Auth | Email, идентификатор пользователя и данные сессии |
| Карта дня | Ритуал | Supabase `prototype_account_states` | ID карты, вариант и время вытягивания |
| Расклад | Ритуал | Supabase `prototype_account_states` | Тема, три ID карт, полный сгенерированный текст, AI-source и время |
| Гостевая карта и порядок колоды | Браузер | `localStorage` | ID карты/варианта, время и порядок карт; после входа гостевая карта переносится в аккаунт |
| Продуктовые события | Welcome и ritual | PostHog Cloud EU | Название события и минимальные свойства вроде entry/source/position; email, тема, карты и reading не передаются намеренно |
| Запрос расклада | Vercel Function | Gemini и/или GigaChat | Тема из фиксированного списка, три карты и их справочные описания; email в prompt не передаётся |
| Технические запросы | Любой визит | Vercel | Сетевые и runtime-логи, включая IP/географию на стороне инфраструктуры Vercel |

В Supabase также остаются legacy-таблицы `prototype_testers` и `card_draws`. Актуальный ritual использует Supabase Auth и `prototype_account_states`, но legacy-данные нужно отдельно проверить и удалить или включить в процедуру удаления пользователя.

## География

- Supabase project `mora`: `AWS ap-southeast-1` — Сингапур; регион подтверждён в Dashboard.
- PostHog: EU Cloud, endpoint `eu.i.posthog.com`; PostHog указывает EU Cloud во Франкфурте.
- Vercel: глобальная edge-инфраструктура; без явной настройки Functions по умолчанию исполняются в США и данные могут передаваться между регионами.
- Gemini: внешний Google API. GigaChat: API Сбера. Маршрут использует Gemini первым и GigaChat следующим, если соответствующие credentials доступны в окружении.

## Что уже ограничено правильно

- PostHog не получает email, prompt, topic, card IDs или reading-текст из явных событий Mora.
- Autocapture, automatic pageview/pageleave и session replay отключены.
- PostHog ID хранится только в `sessionStorage`; Mora не вызывает `identify()`.
- AI prompt не содержит email пользователя.
- Server logs Mora для AI содержат request ID, provider/model, status, latency и token usage, но не prompt и не email.
- Supabase state закрыт RLS/grants; клиент не передаёт произвольный `user_id` для записи account state.

## Открытые риски перед публичным запуском в России

1. Основная база email и аккаунтов находится в Сингапуре. Это не соответствует требованию первичной записи, систематизации, хранения и извлечения данных российских граждан через базы в РФ без применимого исключения.
2. Для автоматизированной обработки обычно требуется уведомление Роскомнадзора до начала обработки; исключения нужно подтверждать отдельно.
3. Supabase, PostHog, Vercel и Gemini создают трансграничную обработку/передачу. Для неё нужны правовое основание, точный перечень стран и получателей и отдельная проверка уведомления.
4. В продукте нет self-service удаления аккаунта. Запрос через `mora.privacy@gmail.com` возможен, но нужна документированная ручная процедура, охватывающая Auth, account state и legacy-таблицы.
5. Сроки хранения сейчас не зафиксированы и фактически ограничены только ручным удалением.
6. PostHog wrapper оставляет `capture_exceptions`, `capture_heatmaps`, `capture_performance`, surveys и feature flags на remote/default настройках. Dashboard из текущего региона недоступен, поэтому перед релизом эти возможности нужно явно выключить в коде, если они не используются.

## Минимальный release-путь

1. Выбрать российское первичное хранилище для Auth и account state либо до его появления не открывать публичную регистрацию российских пользователей.
2. После выбора хранилища описать срок хранения и процедуру удаления всех данных пользователя.
3. С профильным юристом проверить уведомление об обработке, трансграничную передачу и необходимость публикации полного адреса оператора.
4. Явно зафиксировать минимальные настройки PostHog в коде или временно отключить аналитику.
5. Обновить Privacy Policy точными регионами и реально включёнными процессорами.
6. Только затем покупать домен, настраивать production SMTP, redirects и canonical URL.

## Источники

- 152-ФЗ, статья 18, часть 5: https://www.consultant.ru/document/cons_doc_LAW_61801/cbf4e15b7c330f9372e876cdf2bc928bad7950ef/
- 152-ФЗ, статья 22: https://www.consultant.ru/document/cons_doc_LAW_61801/d996966e22e1320c9de1ab82d9f6be12c3d9d765/
- 152-ФЗ, статья 12: https://www.consultant.ru/document/cons_doc_LAW_61801/e4ebbe1780de623c7cf32a59ca82a7bb523a25dd/
- Supabase regions: https://supabase.com/docs/guides/platform/regions
- PostHog JS configuration: https://posthog.com/docs/libraries/js/config
- Vercel security and data location: https://vercel.com/docs/security/compliance
- Vercel privacy notice: https://vercel.com/legal/privacy-notice
