import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/')

  return (
    <main style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#090705',
      gap: '24px',
      fontFamily: 'sans-serif',
    }}>
      <h1 style={{ color: '#c9a96e', fontSize: '2rem', margin: 0 }}>Mora</h1>
      <p style={{ color: '#f0e6d3', margin: 0 }}>
        Привет, {user.user_metadata?.full_name || user.email}!
      </p>
      <p style={{ color: '#9a8a75', margin: 0, fontSize: '0.875rem' }}>
        Авторизация работает ✓
      </p>
      <a href="/auth/logout" style={{
        color: '#7a6040',
        fontSize: '0.875rem',
        textDecoration: 'underline',
      }}>
        Выйти
      </a>
    </main>
  )
}
