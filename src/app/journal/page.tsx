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

export default async function JournalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: draws } = await supabase
    .from('card_draws')
    .select('card_id, drawn_at')
    .eq('user_id', user.id)
    .order('drawn_at', { ascending: false })

  const firstName = user.user_metadata?.full_name?.split(' ')[0] || 'Путник'
  const avatarUrl = user.user_metadata?.avatar_url
  const list = draws ?? []

  return (
    <div className="jn-wrap">

      {/* HEADER */}
      <header className="jn-header">
        <div className="jn-header-left">
          <a href="/" className="jn-nav-link">
            <span className="jn-nav-icon">🕯</span>
            Сходить к тарологу
          </a>
          <a href="/" className="jn-nav-link">
            <span className="jn-nav-icon">✦</span>
            Карта дня
          </a>
        </div>

        <h1 className="jn-title">Дневник карт</h1>

        <div className="jn-header-right">
          <a href="/journal" className="jn-header-btn">
            <span>☰</span>
            Дневник карт
          </a>
          <div className="jn-avatar-wrap">
            {avatarUrl
              ? <img src={avatarUrl} alt={firstName} className="jn-avatar" />
              : <div className="jn-avatar-placeholder">{firstName[0]}</div>
            }
            <span className="jn-avatar-chevron">▾</span>
          </div>
        </div>
      </header>

      {/* FILTERS */}
      <div className="jn-filters">
        <div className="jn-filters-left">
          <button className="jn-filter-btn">
            <span>⊞</span> Все карты <span className="jn-chevron">▾</span>
          </button>
          <button className="jn-filter-btn">
            <span>📅</span> За всё время <span className="jn-chevron">▾</span>
          </button>
          <div className="jn-search-wrap">
            <span className="jn-search-icon">🔍</span>
            <input className="jn-search" type="text" placeholder="Поиск по картам..." disabled />
          </div>
        </div>
        <div className="jn-view-toggle">
          <button className="jn-view-btn jn-view-btn--active" title="Сетка">⊞</button>
          <button className="jn-view-btn" title="Список">☰</button>
        </div>
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
