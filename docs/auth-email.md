# Auth Email · Mora

## Цель

Email-вход Mora использует Supabase Auth OTP. Основной сценарий для пользователя: ввести email, получить код из письма, ввести код, попасть в dashboard.

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
Port: 587
Username: resend
Password: RESEND_API_KEY
Sender name: Mora
Sender email: no-reply@auth.yourdomain.com
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

Фактическая длина `{{ .Token }}` задаётся Supabase Auth на стороне проекта. UI Mora поддерживает 6-8 цифр и проверяет код сразу после ввода каждой цифры начиная с шестой, не блокируя дальнейший ввод.

Если понадобится полный контроль над длиной кода, TTL или количеством попыток, нужен отдельный custom OTP backend.
