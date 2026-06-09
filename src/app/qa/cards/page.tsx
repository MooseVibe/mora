import { redirect } from 'next/navigation'
import { TAROT_CARD_LIST } from '@/lib/tarot'
import { QACardsBrowser } from './qa-cards-browser'
import './qa-cards.css'

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default async function QACardsPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  const qaToken = process.env.CARD_QA_TOKEN

  if (process.env.NODE_ENV === 'production' && (!qaToken || token !== qaToken)) {
    redirect('/')
  }

  return (
    <main className="qa-cards-wrap">
      <header className="qa-cards-header">
        <a href="/" className="qa-cards-logo">
          <span className="qa-cards-logo-icon">✦</span>
          <span>MORA</span>
        </a>
        <div>
          <p className="qa-cards-kicker">QA preview</p>
          <h1 className="qa-cards-title">Карты и тексты</h1>
          <p className="qa-cards-desc">
            Служебный просмотр не вытягивает карту, не пишет в дневник и не меняет состояние пользователя.
          </p>
        </div>
      </header>

      <QACardsBrowser cards={TAROT_CARD_LIST} />
    </main>
  )
}
