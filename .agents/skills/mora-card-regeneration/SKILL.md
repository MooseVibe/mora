---
name: mora-card-regeneration
description: Regenerate existing Mora tarot artwork as a controlled batch of exactly five cards, with Rider–Waite–Smith verification, shared art direction, per-card visual approval, production optimization, and cross-context QA. Use for replacing existing card images; do not use for UI redesign or adding new card records.
---

# Mora Card Regeneration

Перегенерируй существующую колоду Mora партиями ровно по пять card ID, не превращая batch в массовую автоматическую замену.

## Обязательный вход

Работай только в активной рабочей копии и ветке, которые указал автор. Не трогай другие checkout, `supabase/.temp`, auth, API, домен или UI/motion.

Перед batch полностью прочитай:

- `AGENTS.md`, `PROJECT_CONTEXT.md`, `docs/current-work.md`;
- `directives/00-start-every-task.md`, `directives/04-add-tarot-cards.md`, `directives/06-commit-and-deploy.md`;
- `docs/project.md`, `docs/architecture.md`, `docs/design-system.md`, `docs/card-style.md`, `docs/decisions.md`;
- [references/master-spec.md](references/master-spec.md);
- [references/batch-checklist.md](references/batch-checklist.md).

Для растровой генерации используй `imagegen` в built-in режиме: одна отдельная генерация на одну карту. Ponytail применяй к процессу и коду, но не сокращай канон, визуальный QA или approval gates.

## Граница skill

- Batch состоит ровно из пяти разных существующих `card.id`.
- Skill заменяет только изображения существующих карт. Он не меняет ID, тексты, механику вытягивания, UI, GLB или CSS.
- Не начинай генерацию, пока автор не подтвердил пять ID и текущий master-spec.
- Не считай визуальную проблему автоматически проблемой ассета. Сначала отдели source-art от crop/UV/object-fit/геометрии.
- Никаких commit, push, preview или production deploy без отдельного явного запроса автора.

## Процесс партии

### 1. Зафиксируй пять карт

Для каждой карты выпиши `id`, русское название, текущий canonical path и причину приоритета. Проверь отсутствие дублей и существование записи в `public/assets/cards.js`.

Если проблема карты вызвана только отображением, не перегенерируй её. Покажи автору вывод и попроси заменить этот ID в пятёрке.

### 2. Зафиксируй канон до prompt

Для каждой карты отдельно составь короткий Rider–Waite–Smith contract:

- обязательные фигуры и их положение;
- обязательные предметы и точное количество;
- отношения фигур и предметов;
- обязательные фоновые символы;
- допустимые только стилистические изменения;
- запрещённые смысловые отклонения.

Покажи contracts автору до генерации, если хотя бы один канонический элемент допускает разные трактовки.

### 3. Заблокируй общий style block

Общая часть всех пяти prompts должна быть одинаковой и соответствовать утверждённому `references/master-spec.md`. Меняется только RWS-сцена конкретной карты.

Используй существующие production-карты как обязательную пару style-and-palette references:

- `public/assets/cards/world.webp`;
- `public/assets/cards/judgement.webp`.

Это style references, а не edit targets. Не копируй их персонажей или символы в другие арканы.

Палитра пары `world` + `judgement` заблокирована для всего batch. Все пять prompts используют один и тот же palette block из `references/master-spec.md`; сюжет карты не может заменять или расширять его собственной цветовой схемой. Допустим только маленький канонический акцент, уже разрешённый master-spec, без изменения общего цветового баланса.

До clean-art approval сравни каждого кандидата с обеими reference-картами. Отклоняй и перегенерируй результат, если он уходит в яркое золото/жёлтый, оранжевое свечение, насыщенный синий или красный, сепию, общий зелёный cast, почти монохромную чёрную fantasy-гамму либо другую самостоятельную палитру. Канон сцены не компенсирует palette drift.

### 4. Сгенерируй пять clean masters

Сделай пять отдельных built-in ImageGen вызовов, по одному на карту. Финальное artwork остаётся без номера, rank letter, footer symbol, названия, рамки, скругления или footer plaque.

Кандидаты остаются вне production tree до аппрува. Не заменяй `public/assets/cards/{id}.webp` и не складывай source/candidate-файлы рядом с колодой.

После генерации самостоятельно проверь каждую карту по канону, master-spec и читаемости в миниатюре. Явно назови любой риск; не маскируй ошибку атмосферой.

### 5. Получи clean-art approval каждой карты

Покажи все пять как обзор и каждую отдельно. Для каждой укажи статус:

- `approved-final`;
- `changes-requested`;
- `rejected`.

Аппрув одной карты не распространяется на остальные. До `approved-final` не оптимизируй и не интегрируй карту. Явный аппрув чистого artwork сразу даёт статус `approved-final`: отдельного marker-гейта нет.

После `approved-final` автоматически выполни шаги 6–8 без дополнительного вопроса автору. Отдельное разрешение всё ещё обязательно только для commit, push, preview и production deploy.

### 6. Интегрируй только approved-final

Для каждой одобренной карты:

1. Приведи master к точным `1024×1536`, без stretch и прозрачного padding.
2. Создай production WebP через `cwebp -q 82`.
3. Проверь dimensions, ratio, format и вес; цель до `350 KB`, максимум `500 KB` без отдельного согласования.
4. Замени тот же canonical `public/assets/cards/{card-id}.webp`. Старый файл не храни рядом: он восстановим через Git history.
5. Сохрани существующий `card.id` и path. `cards.js` меняй только если прежний путь действительно неканоничен.
6. После успешной проверки WebP и UI удали временные PNG/source/candidate-файлы; не жди commit.

Частичная интеграция допустима только для карт со статусом `approved-final`; остальные остаются вне production tree.

### 7. Проверь все production-контексты

Каждую интегрированную карту проверь на desktop `1440px` и mobile `375px`:

- вытянутая карта дня;
- выбранные карты в процессе расклада;
- готовый расклад на главном экране;
- reading section 1 «Общий взгляд»;
- sections 2–4 «Прошлое / Настоящее / Будущее»;
- section 5 «Итог»;
- `/qa/cards`.

Для настоящего daily-result используй локальный URL `/ritual?resetDaily=always&qaCard={card-id}`: `qaCard` выбирает конкретную карту только на localhost/LAN, а пользователь проходит обычный click/flip/result flow. Не создавай отдельный production mock или серверное событие.

Проверь DOM `object-fit`, WebGL/GLB face UV/crop, рамку, внутренние отступы, скругления и отсутствие stretch. Не добавляй индивидуальные CSS-исключения под отдельные карты.

### 8. Заверши партию

Обнови `docs/decisions.md`, `docs/current-work.md` и при необходимости `docs/card-style.md`. Запусти `git diff --check`, `npm run lint` и `npm run build`.

Отчёт должен перечислять все пять ID и их финальные статусы. Не называй batch завершённым, пока по каждой карте явно не зафиксировано: интегрирована, отклонена или перенесена в следующий проход.

## Стоп-условия

Остановись и спроси автора, если:

- не утверждён master-spec или точная пятёрка;
- непонятен RWS-канон или количество объектов;
- reference-карты расходятся по важному визуальному параметру;
- WebP превышает `500 KB`;
- требуется изменить CSS, GLB, UI, ID или данные;
- визуальный аппрув сформулирован неоднозначно.
