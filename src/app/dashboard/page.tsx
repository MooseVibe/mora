import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CardSyncOnMount from '@/components/CardSyncOnMount'
import './dashboard.css'

const CARDS: Record<string, { name: string; arcana: string; desc: string; img: string }> = {
  fool:          { name: 'Шут',           arcana: '0 Аркан',    desc: 'День открытий и свежего начала. Доверься интуиции и иди вперёд без страха.', img: '/assets/cards/fool.png' },
  magician:      { name: 'Маг',           arcana: 'I Аркан',    desc: 'Все инструменты в твоих руках. Действуй с намерением — сегодня воля творит реальность.', img: '/assets/cards/magician.png' },
  'high-priestess': { name: 'Верховная Жрица', arcana: 'II Аркан', desc: 'Прислушайся к внутреннему голосу. Истина уже внутри тебя — не торопись.', img: '/assets/cards/high-priestess.png' },
  empress:       { name: 'Императрица',   arcana: 'III Аркан',  desc: 'День изобилия и творчества. Позволь себе получать и наслаждаться.', img: '/assets/cards/empress.png' },
  emperor:       { name: 'Император',     arcana: 'IV Аркан',   desc: 'Время взять контроль. Структура и дисциплина приведут к результату.', img: '/assets/cards/emperor.png' },
  hierophant:    { name: 'Иерофант',      arcana: 'V Аркан',    desc: 'Ищи мудрость в традиции. Обратись к наставнику или внутренним убеждениям.', img: '/assets/cards/hierophant.png' },
  lovers:        { name: 'Влюблённые',    arcana: 'VI Аркан',   desc: 'День важного выбора и связи. Действуй из сердца, не из страха.', img: '/assets/cards/lovers.png' },
  chariot:       { name: 'Колесница',     arcana: 'VII Аркан',  desc: 'Победа достаётся тому, кто не сворачивает. Твоя воля сильнее обстоятельств.', img: '/assets/cards/chariot.png' },
  strength:      { name: 'Сила',          arcana: 'VIII Аркан', desc: 'Мягкость победит жёсткость. Истинная сила — в терпении и сострадании.', img: '/assets/cards/strength.png' },
  hermit:        { name: 'Отшельник',     arcana: 'IX Аркан',   desc: 'Уединение даст ответы. Замедлись и послушай тишину внутри.', img: '/assets/cards/hermit.png' },
  wheel:         { name: 'Колесо Фортуны', arcana: 'X Аркан',  desc: 'Цикл меняется в твою пользу. Прими перемены — они ведут к лучшему.', img: '/assets/cards/wheel.png' },
  justice:       { name: 'Справедливость', arcana: 'XI Аркан', desc: 'День баланса и честности. Поступай по совести — последствия будут справедливы.', img: '/assets/cards/justice.png' },
  'hanged-man':  { name: 'Повешенный',    arcana: 'XII Аркан',  desc: 'Пауза — это не поражение. Смени угол зрения и увидишь то, что упускал.', img: '/assets/cards/hanged-man.png' },
  death:         { name: 'Смерть',        arcana: 'XIII Аркан', desc: 'Завершение пути открывает новый. Отпусти старое — без потери нет обновления.', img: '/assets/cards/death.png' },
  temperance:    { name: 'Умеренность',   arcana: 'XIV Аркан',  desc: 'Гармония в балансе крайностей. Сегодня ищи золотую середину.', img: '/assets/cards/temperance.png' },
  devil:         { name: 'Дьявол',        arcana: 'XV Аркан',   desc: 'Присмотрись к цепям — они держатся слабее, чем кажется. Свобода выбора есть всегда.', img: '/assets/cards/devil.png' },
  tower:         { name: 'Башня',         arcana: 'XVI Аркан',  desc: 'День резких перемен и освобождения. То, что держалось, может разрушиться. Это шанс освободиться от того, что больше не служит твоему росту.', img: '/assets/cards/tower.png' },
  star:          { name: 'Звезда',        arcana: 'XVII Аркан', desc: 'После бури — надежда. Доверяй вселенной: она ведёт тебя к исцелению.', img: '/assets/cards/star.png' },
  moon:          { name: 'Луна',          arcana: 'XVIII Аркан', desc: 'Иллюзии рассеются, если не бежать от них. Прислушайся к снам и предчувствиям.', img: '/assets/cards/moon.png' },
  sun:           { name: 'Солнце',        arcana: 'XIX Аркан',  desc: 'Радость и ясность — твои спутники сегодня. Позволь себе сиять.', img: '/assets/cards/sun.png' },
  judgement:     { name: 'Суд',           arcana: 'XX Аркан',   desc: 'Время честного взгляда на себя. Прощение — своё и чужое — открывает новую главу.', img: '/assets/cards/judgement.png' },
  world:         { name: 'Мир',           arcana: 'XXI Аркан',  desc: 'Цикл завершён. Ты достиг чего-то важного — признай это и прими благодарность.', img: '/assets/cards/world.png' },
}

function formatDate() {
  return new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const today = new Date().toISOString().split('T')[0]
  const { data: todayDraw } = await supabase
    .from('card_draws')
    .select('*')
    .eq('user_id', user.id)
    .eq('drawn_at', today)
    .single()

  const firstName = user.user_metadata?.full_name?.split(' ')[0] || 'Путник'
  const avatarUrl = user.user_metadata?.avatar_url
  const card = todayDraw ? CARDS[todayDraw.card_id] : null

  return (
    <div className="db-wrap">
      <CardSyncOnMount />

      {/* HEADER */}
      <header className="db-header">
        <div className="db-header-left">
          <a href="/" className="db-nav-link">
            <span className="db-nav-link-icon">✦</span>
            Сходить к тарологу
          </a>
          <a href="/" className="db-nav-link">
            <span className="db-nav-link-icon">✧</span>
            Карта дня
          </a>
        </div>
        <div className="db-header-right">
          <a href="/journal" className="db-nav-link">
            <span className="db-nav-link-icon">☰</span>
            Дневник карт
          </a>
          <div className="db-avatar-wrap">
            {avatarUrl
              ? <img src={avatarUrl} alt={firstName} className="db-avatar" />
              : <div className="db-avatar-placeholder">{firstName[0]}</div>
            }
            <span className="db-avatar-chevron">▾</span>
          </div>
          <a href="/auth/logout" className="db-logout-link">Выйти</a>
        </div>
      </header>

      {/* WELCOME */}
      <div className="db-welcome">
        <h1 className="db-welcome-name">Добро пожаловать, {firstName}</h1>
        <p className="db-welcome-sub">Рады видеть вас в вашем личном пространстве <span className="db-welcome-plus">✦</span></p>
      </div>

      {/* GRID */}
      <div className="db-grid">

        {/* LEFT: CARD OF DAY */}
        <div className="db-widget">
          <div className="db-card-header">
            <span className="db-card-label">Ваша карта дня</span>
            <span className="db-card-date">Сегодня, {formatDate()}</span>
          </div>

          {card ? (
            <div className="db-card-body">
              <div className="db-card-img-wrap">
                <img src={card.img} alt={card.name} className="db-card-img" />
                <div className="db-card-img-name">{card.name}<br />{card.arcana}</div>
              </div>
              <div className="db-card-content">
                <h2 className="db-card-title">{card.name}</h2>
                <p className="db-card-arcana">{card.arcana}</p>
                <p className="db-card-desc">{card.desc}</p>
                <p className="db-outcome-label">Как прошёл ваш день?</p>
                <div className="db-outcome-btns">
                  <button className="db-outcome-btn db-outcome-btn--yes">✓ Сбылось</button>
                  <button className="db-outcome-btn db-outcome-btn--no">✕ Не сбылось</button>
                </div>
                <div className="db-card-actions">
                  <a href="/" className="db-card-action-link">☰ Открыть карту</a>
                  <a href="#" className="db-card-action-link">↗ Поделиться</a>
                </div>
              </div>
            </div>
          ) : (
            <div className="db-no-card">
              <div className="db-no-card-icon">✦</div>
              <p className="db-no-card-text">Вы ещё не вытянули карту сегодня</p>
              <a href="/" className="db-no-card-btn">Вытянуть карту</a>
            </div>
          )}
        </div>

        {/* RIGHT WIDGETS */}
        <div className="db-right">
          <div className="db-widget">
            <div className="db-widget-icon">✦</div>
            <h3 className="db-widget-title">Давайте сделаем предсказания точнее</h3>
            <p className="db-widget-text">Ответьте на несколько вопросов о себе, чтобы мы лучше понимали вас и ваши запросы.</p>
            <a href="#" className="db-widget-btn">Ответить на вопросы</a>
            <a href="#" className="db-widget-btn db-widget-btn--ghost">Позже</a>
          </div>

          <div className="db-widget">
            <div className="db-tarot-img-placeholder">☽</div>
            <span className="db-card-label">Походы к тарологу</span>
            <h3 className="db-widget-title" style={{marginTop: '8px'}}>У вас пока нет консультаций с тарологом</h3>
            <p className="db-widget-text">Здесь будут сохраняться ваши сеансы и диалоги с тарологом.</p>
            <a href="#" className="db-widget-btn">✦ Посетить тарологa</a>
          </div>
        </div>

      </div>

      {/* FOOTER */}
      <footer className="db-footer">
        <span className="db-footer-star">✦</span>
        <p className="db-footer-tip">Совет дня: не бойся перемен. Иногда разрушение — это начало чего-то лучшего.</p>
        <span className="db-footer-star">✦</span>
      </footer>

    </div>
  )
}
