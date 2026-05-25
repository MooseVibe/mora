import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import './journal.css'

const CARDS: Record<string, { name: string; arcana: string; num: string; desc: string }> = {
  fool:             { name: 'Шут',               arcana: 'Старшие арканы', num: '0',     desc: 'День открытий и свежего начала. Доверься интуиции и иди вперёд без страха.' },
  magician:         { name: 'Маг',               arcana: 'Старшие арканы', num: 'I',     desc: 'Все инструменты в твоих руках. Действуй с намерением — сегодня воля творит реальность.' },
  'high-priestess': { name: 'Верховная Жрица',   arcana: 'Старшие арканы', num: 'II',    desc: 'Прислушайся к внутреннему голосу. Истина уже внутри тебя — не торопись.' },
  empress:          { name: 'Императрица',        arcana: 'Старшие арканы', num: 'III',   desc: 'День изобилия и творчества. Позволь себе получать и наслаждаться.' },
  emperor:          { name: 'Император',          arcana: 'Старшие арканы', num: 'IV',    desc: 'Время взять контроль. Структура и дисциплина приведут к результату.' },
  hierophant:       { name: 'Иерофант',           arcana: 'Старшие арканы', num: 'V',     desc: 'Ищи мудрость в традиции. Обратись к наставнику или внутренним убеждениям.' },
  lovers:           { name: 'Влюблённые',         arcana: 'Старшие арканы', num: 'VI',    desc: 'День важного выбора и связи. Действуй из сердца, не из страха.' },
  chariot:          { name: 'Колесница',          arcana: 'Старшие арканы', num: 'VII',   desc: 'Победа достаётся тому, кто не сворачивает. Твоя воля сильнее обстоятельств.' },
  strength:         { name: 'Сила',              arcana: 'Старшие арканы', num: 'VIII',  desc: 'Мягкость победит жёсткость. Истинная сила — в терпении и сострадании.' },
  hermit:           { name: 'Отшельник',          arcana: 'Старшие арканы', num: 'IX',    desc: 'Уединение даст ответы. Замедлись и послушай тишину внутри.' },
  wheel:            { name: 'Колесо Фортуны',     arcana: 'Старшие арканы', num: 'X',     desc: 'Цикл меняется в твою пользу. Прими перемены — они ведут к лучшему.' },
  justice:          { name: 'Справедливость',     arcana: 'Старшие арканы', num: 'XI',    desc: 'День баланса и честности. Поступай по совести — последствия будут справедливы.' },
  'hanged-man':     { name: 'Повешенный',         arcana: 'Старшие арканы', num: 'XII',   desc: 'Пауза — это не поражение. Смени угол зрения и увидишь то, что упускал.' },
  death:            { name: 'Смерть',             arcana: 'Старшие арканы', num: 'XIII',  desc: 'Завершение пути открывает новый. Отпусти старое — без потери нет обновления.' },
  temperance:       { name: 'Умеренность',        arcana: 'Старшие арканы', num: 'XIV',   desc: 'Гармония в балансе крайностей. Сегодня ищи золотую середину.' },
  devil:            { name: 'Дьявол',             arcana: 'Старшие арканы', num: 'XV',    desc: 'Присмотрись к цепям — они держатся слабее, чем кажется. Свобода выбора есть всегда.' },
  tower:            { name: 'Башня',              arcana: 'Старшие арканы', num: 'XVI',   desc: 'День резких перемен и освобождения. То, что держалось, может разрушиться. Это шанс освободиться от того, что больше не служит твоему росту.' },
  star:             { name: 'Звезда',             arcana: 'Старшие арканы', num: 'XVII',  desc: 'День надежды, вдохновения и веры. Вселенная поддерживает тебя. Доверяй потоку и двигайся к своим мечтам.' },
  moon:             { name: 'Луна',               arcana: 'Старшие арканы', num: 'XVIII', desc: 'Иллюзии рассеются, если не бежать от них. Прислушайся к снам и предчувствиям.' },
  sun:              { name: 'Солнце',             arcana: 'Старшие арканы', num: 'XIX',   desc: 'Радость и ясность — твои спутники сегодня. Позволь себе сиять.' },
  judgement:        { name: 'Суд',                arcana: 'Старшие арканы', num: 'XX',    desc: 'Время честного взгляда на себя. Прощение — своё и чужое — открывает новую главу.' },
  world:            { name: 'Мир',                arcana: 'Старшие арканы', num: 'XXI',   desc: 'Цикл завершён. Ты достиг чего-то важного — признай это и прими благодарность.' },
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

type JournalPeriod = 'all' | '30' | '7'

const PERIOD_OPTIONS: Array<{ value: JournalPeriod; label: string; href: string }> = [
  { value: 'all', label: 'Все время', href: '/journal' },
  { value: '30', label: '30 дней', href: '/journal?period=30' },
  { value: '7', label: '7 дней', href: '/journal?period=7' },
]

function getPeriodStartDate(period: JournalPeriod): string | null {
  if (period === 'all') return null

  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - (Number(period) - 1))

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function getSelectedPeriod(period?: string): JournalPeriod {
  return period === '30' || period === '7' ? period : 'all'
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { period } = await searchParams
  const selectedPeriod = getSelectedPeriod(period)
  const periodStartDate = getPeriodStartDate(selectedPeriod)

  let drawsQuery = supabase
    .from('card_draws')
    .select('card_id, drawn_at')
    .eq('user_id', user.id)
    .order('drawn_at', { ascending: false })

  if (periodStartDate) {
    drawsQuery = drawsQuery.gte('drawn_at', periodStartDate)
  }

  const { data: draws } = await drawsQuery

  const firstName = user.user_metadata?.full_name?.split(' ')[0] || 'Путник'
  const avatarUrl = user.user_metadata?.avatar_url
  const list = draws ?? []

  return (
    <div className="jn-wrap">

      <header className="jn-header">
        <a href="/" className="jn-logo">
          <span className="jn-logo-icon">✦</span>
          <span className="jn-logo-text">MORA</span>
        </a>
        <div className="jn-header-right">
          <a href="/auth/logout" className="jn-logout-link">Выйти</a>
          <div className="jn-avatar-wrap">
            {avatarUrl
              ? <img src={avatarUrl} alt={firstName} className="jn-avatar" />
              : <div className="jn-avatar-placeholder">{firstName[0]}</div>
            }
            <span className="jn-avatar-chevron">▾</span>
          </div>
        </div>
      </header>

      <div className="jn-title-block">
        <a href="/dashboard" className="jn-back-link" aria-label="Вернуться на дашборд">‹</a>
        <h1 className="jn-page-title">Дневник карт</h1>
      </div>

      <div className="jn-filters">
        {PERIOD_OPTIONS.map(option => (
          <a
            key={option.value}
            href={option.href}
            className={`jn-period-chip${selectedPeriod === option.value ? ' jn-period-chip--active' : ''}`}
            aria-current={selectedPeriod === option.value ? 'page' : undefined}
          >
            {option.label}
          </a>
        ))}
      </div>

      {/* LIST */}
      <div className="jn-list">
        {list.length === 0 ? (
          <div className="jn-empty">
            <span className="jn-empty-icon">✦</span>
            <p className="jn-empty-text">Здесь появятся твои карты</p>
            <a href="/" className="jn-empty-btn">Вытянуть первую карту</a>
          </div>
        ) : (
          list.map((draw, i) => {
            const card = CARDS[draw.card_id]
            if (!card) return null
            return (
              <div className="jn-row" key={i}>
                {/* IMAGE */}
                <div className="jn-row-img-wrap">
                  <img
                    src={`/assets/cards/${draw.card_id}.png`}
                    alt={card.name}
                    className="jn-row-img"
                  />
                  <div className="jn-row-img-caption">
                    {card.name}<br />{card.num}
                  </div>
                </div>

                {/* CONTENT */}
                <div className="jn-row-content">
                  <span className="jn-row-date">{formatDate(draw.drawn_at)}</span>
                  <h2 className="jn-row-name">{card.name}</h2>
                  <p className="jn-row-desc">{card.desc}</p>
                  <span className="jn-row-tag">{card.arcana}</span>
                </div>

                {/* ACTIONS */}
                <div className="jn-row-actions">
                  <button className="jn-action-btn jn-action-btn--yes">
                    <span>✓</span> Сбылось
                  </button>
                  <button className="jn-action-btn jn-action-btn--no">
                    <span>✕</span> Не сбылось
                  </button>
                  <button className="jn-action-btn jn-action-btn--note">
                    <span>✎</span> Мои заметки
                  </button>
                  <span className="jn-row-arrow">›</span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* FOOTER HINT */}
      {list.length > 0 && (
        <div className="jn-footer-hint">
          <span>✦</span>
          <span>Твои карты сохраняются в твоём дневнике</span>
          <span>?</span>
        </div>
      )}

    </div>
  )
}
