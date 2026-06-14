import { createClient } from '@/lib/supabase/server'
import JournalClient from '@/components/JournalClient'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'
import { redirect } from 'next/navigation'
import '../dashboard/dashboard.css'
import './journal.css'

type JournalPeriod = 'all' | '30' | '7'
type ReturnPreview = 'empty' | 'empty-all' | 'drawn'

function getSelectedPeriod(period?: string): JournalPeriod {
  return period === '30' || period === '7' ? period : 'all'
}

function getReturnPreview(preview?: string): ReturnPreview | null {
  return preview === 'empty' || preview === 'empty-all' || preview === 'drawn' ? preview : null
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; returnPreview?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { period, returnPreview } = await searchParams
  const selectedPeriod = getSelectedPeriod(period)
  const preview = getReturnPreview(returnPreview)
  const dashboardHref = preview ? `/dashboard?preview=${encodeURIComponent(preview)}` : '/dashboard'

  const { data: draws } = await supabase
    .from('card_draws')
    .select('card_id, drawn_at, variant_idx, reading_snapshot')
    .eq('user_id', user.id)
    .order('drawn_at', { ascending: false })

  const firstName = user.user_metadata?.full_name?.split(' ')[0] || 'Путник'
  const avatarUrl = user.user_metadata?.avatar_url

  return (
    <div className="jn-wrap">
      <AuthenticatedHeader firstName={firstName} avatarUrl={avatarUrl} />

      <JournalClient draws={draws ?? []} initialPeriod={selectedPeriod} dashboardHref={dashboardHref} returnPreview={preview} />
    </div>
  )
}
