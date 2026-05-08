'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AuthPage() {
  const [step, setStep] = useState<'enter' | 'verify'>('enter')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
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
    <div style={{
      minHeight: '100vh',
      background: '#090705',
      display: 'flex',
      fontFamily: 'Raleway, sans-serif',
    }}>
      {/* LEFT — image */}
      <div style={{
        flex: 1,
        backgroundImage: 'url(/assets/mora-door.png)',
        backgroundSize: 'cover',
        backgroundPosition: '30% center',
        position: 'relative',
        minHeight: '100vh',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to right, rgba(9,7,5,0.2) 0%, rgba(9,7,5,0.7) 100%)',
        }} />
      </div>

      {/* RIGHT — auth block */}
      <div style={{
        width: '480px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        background: 'rgba(9,7,5,0.92)',
      }}>
        <div style={{ width: '100%', maxWidth: '360px' }}>

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ color: '#c9a96e', fontSize: '13px', letterSpacing: '0.2em', marginBottom: '12px' }}>✦ MORA</div>
            <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '28px', fontWeight: 300, color: '#f0e6d3', margin: '0 0 8px' }}>
              Добро пожаловать к Море
            </h1>
            <p style={{ color: '#9a8a75', fontSize: '14px', margin: 0 }}>
              {step === 'enter' ? 'Она поможет тебе разобраться…' : `Письмо отправлено на ${email}`}
            </p>
          </div>

          {step === 'enter' ? (
            <>
              {/* Google */}
              <button onClick={handleGoogle} style={{
                width: '100%', padding: '13px', marginBottom: '20px',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '10px', color: '#f0e6d3', fontSize: '14px',
                fontFamily: 'Raleway, sans-serif', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                transition: 'background 0.2s',
              }}>
                <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                Войти с помощью Google
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                <span style={{ color: '#7a6040', fontSize: '12px', letterSpacing: '0.06em' }}>или</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
              </div>

              {/* Email form */}
              <form onSubmit={handleEmail}>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="Введите Email" required
                  style={{
                    width: '100%', padding: '13px 16px', marginBottom: '12px',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '10px', color: '#f0e6d3', fontSize: '14px',
                    fontFamily: 'Raleway, sans-serif', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {error && <p style={{ color: '#e07070', fontSize: '13px', margin: '0 0 12px' }}>{error}</p>}
                <button type="submit" disabled={loading} style={{
                  width: '100%', padding: '13px',
                  background: '#c9a96e', border: 'none', borderRadius: '10px',
                  color: '#090705', fontSize: '14px', fontWeight: 600,
                  fontFamily: 'Raleway, sans-serif', cursor: loading ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.06em', opacity: loading ? 0.7 : 1,
                }}>
                  {loading ? 'Отправляем…' : 'ВОЙТИ'}
                </button>
              </form>
            </>
          ) : (
            /* Step 2: OTP */
            <form onSubmit={handleVerify}>
              <p style={{ color: '#9a8a75', fontSize: '13px', marginBottom: '20px', lineHeight: 1.6 }}>
                Введи код из письма — он действует 10 минут. Код может быть 6 или 8 цифр.
              </p>
              <input
                type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••••" maxLength={8} required autoFocus
                style={{
                  width: '100%', padding: '16px', marginBottom: '12px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '10px', color: '#f0e6d3', fontSize: '24px',
                  fontFamily: 'Cormorant Garamond, serif', letterSpacing: '0.3em',
                  textAlign: 'center', outline: 'none', boxSizing: 'border-box',
                }}
              />
              {error && <p style={{ color: '#e07070', fontSize: '13px', margin: '0 0 12px' }}>{error}</p>}
              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '13px',
                background: '#c9a96e', border: 'none', borderRadius: '10px',
                color: '#090705', fontSize: '14px', fontWeight: 600,
                fontFamily: 'Raleway, sans-serif', cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: '0.06em', opacity: loading ? 0.7 : 1,
              }}>
                {loading ? 'Проверяем…' : 'ПОДТВЕРДИТЬ'}
              </button>
              <button type="button" onClick={() => { setStep('enter'); setOtp(''); setError('') }} style={{
                width: '100%', padding: '10px', marginTop: '10px',
                background: 'transparent', border: 'none',
                color: '#7a6040', fontSize: '13px', cursor: 'pointer',
                fontFamily: 'Raleway, sans-serif',
              }}>
                ← Изменить email
              </button>
            </form>
          )}

          <p style={{ textAlign: 'center', marginTop: '32px', fontSize: '12px', color: '#4a3e2e', lineHeight: 1.6 }}>
            Входя, вы соглашаетесь с условиями использования Mora
          </p>
        </div>
      </div>
    </div>
  )
}
