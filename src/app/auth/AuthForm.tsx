'use client'

import { useState } from 'react'
import { flushSync } from 'react-dom'
import { createClient } from '@/lib/supabase/client'

export default function AuthForm({ isSaveIntent }: { isSaveIntent: boolean }) {
  const [step, setStep] = useState<'enter' | 'verify'>('enter')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

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
    if (!email) return
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    setLoading(false)
    if (error) { setError('Не удалось отправить код. Проверь email.'); return }
    setStep('verify')
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!otp) return
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    })
    setLoading(false)
    if (error) { setError('Неверный код. Попробуй ещё раз.'); return }
    window.location.href = '/dashboard'
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
                ? `Письмо отправлено на ${email}`
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

              <form onSubmit={handleEmail} className="auth-form">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Введите Email"
                  required
                  className="auth-input"
                />
                {error && <p className="auth-error">{error}</p>}
                <button type="submit" disabled={loading} className="auth-btn">
                  {loading ? 'Отправляем…' : 'Войти'}
                </button>
              </form>
            </>
          ) : (
            <form onSubmit={handleVerify} className="auth-form">
              <p className="auth-otp-hint">
                Введи код из письма — он действует 10 минут. Код может быть 6 или 8 цифр.
              </p>
              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••••"
                maxLength={8}
                required
                autoFocus
                className="auth-input auth-input--otp"
              />
              {error && <p className="auth-error">{error}</p>}
              <button type="submit" disabled={loading} className="auth-btn">
                {loading ? 'Проверяем…' : 'Подтвердить'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('enter'); setOtp(''); setError('') }}
                className="auth-back-btn"
              >
                ← Изменить email
              </button>
            </form>
          )}
        </div>

        <p className="auth-disclaimer">
          Входя, вы соглашаетесь с условиями использования Mora
        </p>
      </div>
    </div>
  )
}
