# Auth Email · Mora

## Production-настройка — 2026-08-31

Проверены фактический код и Supabase Dashboard проекта `mora` (`singajyplacgqopypelo`, main / Production, Free), затем применён минимальный набор без нового auth-кода и без Vercel deploy.

| Параметр | Наблюдаемое состояние |
|---|---|
| Отправитель | Custom SMTP включён: Resend, `Mora <no-reply@auth.moratarot.com>`, `smtp.resend.com:465`. Auth Hooks отсутствуют. |
| Email quota | **30 писем/час на проект** в Supabase. Ограничения Resend Free: **100/день и 3000/месяц**. Это больше прежних 2 писем/час, но не безлимитная доставка. |
| OTP length | **6 цифр**. |
| OTP expiry | **3600 секунд**. |
| Resend | Minimum interval per user сохранён как **60 секунд**. Платный тариф и pay-as-you-go не подключены. |
| Verify | **30 запросов/5 минут/IP**, UI также показывает 360/час. Это rate limit, не число ошибок на один выданный код. Отдельного лимита попыток на код UI не показывает. |
| Sign-up/sign-in | **30 запросов/5 минут/IP**, UI также показывает 360/час. Отдельного project-wide OTP поля текущий Dashboard не показывает; не подменять это значение старым документированным default 30 OTP/час. |
| IP forwarding | Выключен. Mora вызывает Auth на сервере с anon key без `Sb-Forwarded-For`; общий исходящий IP сервера может объединять verify-лимит нескольких пользователей. В этом проходе не менять ключи/forwarding. |
| CAPTCHA | Уже выключена до аудита; агент защиту не отключал. Не считать текущую конфигурацию готовой к массовому публичному запуску. |
| Site URL | `https://moratarot.com`. |
| Redirect URLs | `https://moratarot.com`, `https://moratarot.com/ritual` и localhost 3000/3001/3002. Устаревший callback удалён. |
| Email templates | Оба (`Confirm sign up`, `Magic link or OTP`) используют один OTP-only шаблон с `{{ .Token }}`; несуществующая fallback-ссылка удалена. |

### Аватар отправителя — 2026-08-31

- `no-reply@auth.moratarot.com` подтверждён как дополнительный адрес рабочего Google-аккаунта автора `mora.privacy@gmail.com`.
- В рабочем Google-аккаунте установлена авторская аватарка Mora из `Avamail.png`; страница аккаунта показывает новый логотип.
- Для получения письма подтверждения в Resend включён inbound на `auth.moratarot.com`, а в Cloudflare добавлен отдельный MX `auth` → `inbound-smtp.eu-west-1.amazonaws.com`, priority 10, DNS only. Корневые Beget MX/SPF и Google/Yandex verification TXT не менялись.
- Это бесплатный best-effort способ для Gmail. Аватар может появиться не сразу и не гарантирован во всех клиентах; universal BIMI/VMC не подключались и не оплачивались.

### Фактический код

- `public/ritual/app.js`: единственный login submit handler; OTP pattern `[0-9]{6,8}`, отправка **по кнопке**, автоматической проверки начиная с шестой цифры нет. Старое описание относилось к удалённому UI. Отдельной resend-кнопки/таймера в текущем flow тоже нет.
- `src/app/api/prototypes/tester-session/route.ts`: нормализует OTP до 8 цифр, вызывает `verifyOtp({ type: 'email' })`; отправка через `signInWithOtp`. Шестизначный код уже совместим с UI и сервером. Password tester и текущая сессия имеют отдельные существующие ветки — не менять.
- Ошибка отправки сейчас превращается в HTTP 502, ошибка проверки — в 401, UI показывает общую ошибку. Это скрывает причину rate limit, но не создаёт лимит двух писем.
- Обработчиков `/auth/callback` и `/auth/confirm` в production tree больше нет. Простое исправление Site URL не восстанавливает magic-link flow; минимальное решение — убрать обещание входа по ссылке из обоих писем, сохранив код.

### Что применено

1. OTP сокращён с 8 до **6 цифр**. Expiry **3600 секунд**, minimum interval **60 секунд**, verify/sign-in limits и подтверждение email сохранены.
2. Site URL и redirects переведены на `https://moratarot.com`; localhost URLs сохранены.
3. Оба письма оставлены OTP-only, потому что обработчика magic link в production tree нет.
4. Подключён **Resend Free** на отдельном sending subdomain `auth.moratarot.com`. Добавлены только его DKIM и отдельные MX/SPF для `send.auth.moratarot.com`; корневые Beget MX/SPF и verification TXT Google/Yandex сохранены.
5. API key имеет только Sending access и ограничен доменом `auth.moratarot.com`; он сохранён только в Supabase SMTP и не записан в репозиторий или документацию.
6. Production-запрос с `https://moratarot.com/ritual` дошёл на подтверждённый Gmail автора. Resend зафиксировал `Delivered`, письмо пришло от `Mora <no-reply@auth.moratarot.com>` и содержало шестизначный код без fallback-ссылки.
7. Автор подтвердил полный production-вход шестизначным кодом. Затем отправляющий адрес был связан с рабочим Google-аккаунтом, а его фото заменено на логотип Mora для бесплатного отображения аватара в Gmail.

**Граница проверки:** доставка production-письма, формат кода и полный вход подтверждены автором. Агент не получал и не вводил чувствительный OTP. Тестировать исчерпание лимитов не нужно; отображение новой аватарки проверяется на следующем обычном письме после распространения фото Google.

Официальные источники, проверенные 2026-08-31: [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [rate limits](https://supabase.com/docs/guides/auth/rate-limits), [email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Auth config API](https://supabase.com/docs/reference/api/v1-update-auth-service-config), [Resend Free](https://resend.com/pricing), [Supabase SMTP integration](https://resend.com/docs/send-with-supabase-smtp), [Brevo Free](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan). Changelog Markdown не загрузился; проверен официальный Auth changelog и изменение шаблонов Free от 2026-06-03. Последнее не запрещает кастомизацию с Custom SMTP; существующие два шаблона Mora доступны.

## Исходное поручение — 2026-08-31 (выполнено)

Автор поручил устранить наблюдаемый лимит «2 кода в час» и сделать OTP короче. Задача выполнена штатной конфигурацией Supabase и Resend, без собственного OTP backend. Итоговые параметры и границы проверки зафиксированы выше.

Ниже сохранено описание рабочего решения; фактические production-значения приведены в верхнем разделе.

## Цель

Email-вход Mora использует Supabase Auth OTP. Основной сценарий для пользователя: ввести email, получить код из письма, ввести код и вернуться в выбранный ритуал.

## Что уже готово

- любой обычный email подтверждается через настоящий Supabase OTP до доступа к account-state;
- UI принимает 6–8 цифр, а сервер нормализует код и вызывает `verifyOtp`;
- после входа карты и расклады принадлежат `auth.uid()`, а не email или общему browser storage;
- logout завершает Supabase session и очищает локальные account-снимки.

Переписывать auth backend или делать собственную выдачу кодов для MVP не нужно.

## Что настроено

1. Подтверждённый sending subdomain `auth.moratarot.com`.
2. Custom SMTP Resend.
3. Одинаковые Supabase-шаблоны `Confirm sign up` и `Magic link or OTP` с `{{ .Token }}`.
4. Production Site URL/redirect URLs и подтверждённая доставка на Gmail автора.

Проверки на других почтовых сервисах остаются отдельным QA и допускаются только на адресах автора.

## Почему нужен Custom SMTP

Встроенная почта Supabase подходит только для локального теста и демо. У неё жёсткие лимиты, письма могут не приходить, а лимит отправки нельзя нормально контролировать без Custom SMTP.

Для MVP достаточно подключить внешний SMTP-провайдер с бесплатным тарифом, например Resend.

## Resend SMTP для Supabase

В Resend:

1. Добавить и подтвердить sending domain.
2. Прописать DNS-записи SPF/DKIM/DMARC, которые покажет Resend.
3. Создать API key.

В Supabase → Authentication → SMTP Settings:

```text
Enable custom SMTP: on
Host: smtp.resend.com
Port: 465
Username: resend
Password: RESEND_API_KEY
Sender name: Mora
Sender email: no-reply@auth.moratarot.com
```

`Sender email` должен быть на подтверждённом домене или поддомене.

## Supabase Email Templates

В шаблонах `Confirm sign up` и `Magic link or OTP` должен быть один и тот же сценарий с кодом:

```html
<h2>Код для входа в Mora</h2>

<p>Введи этот код на странице входа:</p>

<p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">
  {{ .Token }}
</p>

<p>Если ты не запрашивал вход в Mora, просто проигнорируй это письмо.</p>
```

Не ставить ссылку как основной сценарий. Mora ждёт код.

## Rate Limits

В Supabase → Authentication → Rate Limits:

- OTP resend для одного пользователя оставить не меньше 60 секунд.
- Project-wide email/OTP limit поднять под MVP-тесты после подключения Custom SMTP.
- Не отключать лимиты полностью: это защита от спама и блокировки sending domain.

## Длина OTP

Фактическая длина `{{ .Token }}` задаётся Supabase Auth на стороне проекта. Текущий UI Mora поддерживает 6–8 цифр и проверяет код по кнопке «Войти»; автоматическая проверка после шестой цифры была в старом удалённом интерфейсе.

Перед изменением длины кода, TTL или лимитов проверить штатные настройки текущей версии Supabase Auth. Собственный OTP backend рассматривать только при доказанном отсутствии нужной возможности; не считать его необходимым для сокращения кода.
