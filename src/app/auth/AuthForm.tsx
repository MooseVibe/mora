'use client'

import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { createClient } from '@/lib/supabase/client'

const RESEND_WAIT_SECONDS = 60
const MIN_OTP_LENGTH = 6
const MAX_OTP_LENGTH = 8

export default function AuthForm({ isSaveIntent }: { isSaveIntent: boolean }) {
  const [step, setStep] = useState<'enter' | 'verify'>('enter')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loadingAction, setLoadingAction] = useState<'email' | 'code' | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [resendTried, setResendTried] = useState(false)
  const [resendAvailableAt, setResendAvailableAt] = useState(0)
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0)
  const verifyingOtpRef = useRef('')
  const verifyOtpTimerRef = useRef<number | null>(null)

  const supabase = createClient()

  function isRateLimited(error: { message?: string; status?: number } | null) {
    const message = error?.message?.toLowerCase() ?? ''
    return error?.status === 429 || message.includes('rate limit')
  }

  function isValidEmailAddress(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
  }

  async function sendEmailCode(normalizedEmail: string) {
    setLoadingAction('email')
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    setLoadingAction(null)

    return error
  }

  function startResendWait() {
    const availableAt = Date.now() + RESEND_WAIT_SECONDS * 1000
    setResendAvailableAt(availableAt)
    setResendSecondsLeft(RESEND_WAIT_SECONDS)
  }

  useEffect(() => {
    if (step !== 'verify' || !resendAvailableAt || resendTried) return

    const updateTimer = () => {
      setResendSecondsLeft(Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000)))
    }
    updateTimer()

    const timer = window.setInterval(updateTimer, 1000)
    return () => window.clearInterval(timer)
  }, [resendAvailableAt, resendTried, step])

  async function handleGoogle() {
    flushSync(() => setGoogleLoading(true))
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    flushSync(() => setGoogleLoading(false))
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setError('Чтобы продолжить, нужен email')
      return
    }
    if (!isValidEmailAddress(normalizedEmail)) {
      setError('Чтобы продолжить, нужен полный email')
      return
    }
    setError('')
    setNotice('')
    setOtp('')
    setResendTried(false)
    setResendAvailableAt(0)
    setResendSecondsLeft(0)
    verifyingOtpRef.current = ''
    setEmail(normalizedEmail)
    const error = await sendEmailCode(normalizedEmail)

    if (error && !isRateLimited(error)) {
      setError('Не удалось отправить письмо. Проверь email.')
      return
    }

    startResendWait()
    setStep('verify')
  }

  async function handleResendCode() {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || loadingAction || resendSecondsLeft > 0) return
    if (resendTried) return
    setError('')
    setNotice('')
    const error = await sendEmailCode(normalizedEmail)
    setResendTried(true)
    setResendSecondsLeft(0)

    setNotice(
      error
        ? 'Если код не пришёл, попробуй позже.'
        : 'Отправили код повторно. Если он не пришёл, попробуй позже.'
    )
  }

  async function verifyEmailCode(code: string) {
    const normalizedEmail = email.trim().toLowerCase()
    if (
      code.length < MIN_OTP_LENGTH ||
      code.length > MAX_OTP_LENGTH ||
      !normalizedEmail ||
      loadingAction ||
      verifyingOtpRef.current === code
    ) return
    verifyingOtpRef.current = code
    setLoadingAction('code')
    setError('')
    const { error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: code,
      type: 'email',
    })
    setLoadingAction(null)
    if (error) {
      setError('Код введён неверно. Проверь цифры и попробуй ещё раз.')
      return
    }
    window.location.href = '/dashboard'
  }

  function scheduleEmailCodeVerification(code: string) {
    if (verifyOtpTimerRef.current) {
      window.clearTimeout(verifyOtpTimerRef.current)
    }

    if (code.length < MIN_OTP_LENGTH) return

    verifyOtpTimerRef.current = window.setTimeout(() => {
      void verifyEmailCode(code)
    }, 0)
  }

  return (
    <div className="auth-page">
      <div className="auth-page-bg" aria-hidden="true" />

      {googleLoading && (
        <div className="nav-transition-overlay">
          <div className="app-loader-deck nav-shuffling">
            <span className="app-loader-card" />
            <span className="app-loader-card" />
            <span className="app-loader-card" />
            <span className="app-loader-card" />
          </div>
          <div className="app-loader-copy">
            <div className="app-loader-text">
              <span className="app-loader-label">Мора думает</span>
              <span className="app-loader-dots" aria-hidden="true">
                <span>.</span><span>.</span><span>.</span>
              </span>
            </div>
          </div>
        </div>
      )}
      <div className="auth-modal">

        <div className="auth-modal-header">
          <div className="auth-mora-label">
            <span>✦</span>
            <span>MORA</span>
          </div>
          <div className="auth-modal-titles">
            <h1 className="auth-modal-title">
              {isSaveIntent ? 'Войди, чтобы Мора тебя запомнила' : 'Добро пожаловать к Море'}
            </h1>
            <p className="auth-modal-subtitle">
              {step === 'verify'
                ? `Отправили код на ${email}, он придет в течение минуты`
                : isSaveIntent
                  ? 'Карта дня сохранится в твоём дневнике'
                  : 'Она поможет тебе разобраться…'}
            </p>
          </div>
        </div>

        <div className="auth-modal-actions">
          {step === 'enter' ? (
            <>
              <button onClick={handleGoogle} className="auth-btn">
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Войти с помощью Google
              </button>

              <div className="auth-divider">
                <div className="auth-divider-line" />
                <span>или</span>
                <div className="auth-divider-line" />
              </div>

              <form onSubmit={handleEmail} className="auth-form" noValidate>
                <div className="auth-input-wrap">
                  <input
                    type="email"
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value)
                      setError('')
                    }}
                    placeholder="Введите Email"
                    required
                    className="auth-input auth-input--with-clear"
                  />
                  {email && (
                    <button
                      type="button"
                      onClick={() => setEmail('')}
                      className="auth-input-clear"
                      aria-label="Очистить email"
                    >
                      ×
                    </button>
                  )}
                </div>
                {error && <p className="auth-error">{error}</p>}
                <button type="submit" disabled={loadingAction === 'email'} className="auth-btn">
                  {loadingAction === 'email' ? 'Отправляем…' : 'Войти'}
                </button>
              </form>
            </>
          ) : (
            <div className="auth-form">
              <div className="auth-input-wrap">
                <input
                  type="text"
                  value={otp}
                  onChange={e => {
                    const nextOtp = e.target.value.replace(/\D/g, '').slice(0, MAX_OTP_LENGTH)
                    setOtp(nextOtp)
                    if (nextOtp.length < MIN_OTP_LENGTH) {
                      verifyingOtpRef.current = ''
                    }
                    scheduleEmailCodeVerification(nextOtp)
                  }}
                  placeholder="••••••••"
                  maxLength={MAX_OTP_LENGTH}
                  required
                  autoFocus
                  className="auth-input auth-input--otp auth-input--with-clear"
                />
                {otp && (
                  <button
                    type="button"
                    onClick={() => {
                      setOtp('')
                      setError('')
                      verifyingOtpRef.current = ''
                      if (verifyOtpTimerRef.current) {
                        window.clearTimeout(verifyOtpTimerRef.current)
                      }
                    }}
                    className="auth-input-clear"
                    aria-label="Очистить код"
                  >
                    ×
                  </button>
                )}
              </div>
              {error && <p className="auth-error">{error}</p>}
              {notice && <p className="auth-otp-hint">{notice}</p>}
              {loadingAction === 'code' && <p className="auth-otp-hint">Проверяем код…</p>}
              {loadingAction === 'email' && <p className="auth-otp-hint">Отправляем письмо…</p>}
              <button
                type="button"
                onClick={handleResendCode}
                disabled={Boolean(loadingAction) || resendTried || resendSecondsLeft > 0}
                className="auth-btn"
              >
                {resendTried
                  ? 'Код запрошен повторно'
                  : resendSecondsLeft > 0
                    ? `Мне не пришёл код · ${resendSecondsLeft} сек`
                    : 'Мне не пришёл код'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('enter')
                  setOtp('')
                  setError('')
                  setNotice('')
                  setResendTried(false)
                  setResendAvailableAt(0)
                  setResendSecondsLeft(0)
                }}
                className="auth-back-btn"
              >
                ← Изменить email
              </button>
            </div>
          )}
        </div>

        <p className="auth-disclaimer">
          Входя, вы соглашаетесь с условиями использования Mora
        </p>
      </div>
    </div>
  )
}
