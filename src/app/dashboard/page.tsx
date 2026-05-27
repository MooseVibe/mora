import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CardSyncOnMount from '@/components/CardSyncOnMount'
import DrawWidget from '@/components/DrawWidget'
import RecentCardsWidget from '@/components/RecentCardsWidget'
import DrawnCardTilt from '@/components/DrawnCardTilt'
import './dashboard.css'

const CARDS: Record<string, { name: string; subtitle: string; desc: string[] }> = {
  fool:             { name: 'Шут',              subtitle: 'день лёгкого старта и доверия моменту',               desc: ['Сегодня хороший день, чтобы начать что-то без долгой подготовки.', 'Не жди идеальных условий — сделай первый шаг как есть, потом разберёшься.', 'Шут не знает, что впереди. Именно поэтому он идёт.'] },
  magician:         { name: 'Маг',              subtitle: 'день действия и полного ресурса',                     desc: ['Всё что нужно для решения задачи — уже у тебя в руках.', 'Не ищи недостающий инструмент или идеальный момент. Начни с того, что есть.', 'Маг не ждёт разрешения — он просто делает.'] },
  'high-priestess': { name: 'Верховная Жрица',  subtitle: 'день тишины и внутреннего знания',                   desc: ['Сегодня не стоит торопиться с выводами — дай ситуации немного настояться.', 'Если что-то не даёт покоя, не беги к чужому совету. Сначала послушай себя.', 'Жрица знает больше, чем говорит. Побудь сегодня чуть молчаливее обычного.'] },
  empress:          { name: 'Императрица',       subtitle: 'день заботы и восстановления ресурса',               desc: ['Сегодня важнее не успеть больше, а сохранить себя.', 'Позаботься о базовом: еда, отдых, что-то приятное — это не слабость, это топливо.', 'Императрица знает: нельзя давать из пустого.'] },
  emperor:          { name: 'Император',         subtitle: 'день решений и твёрдой позиции',                     desc: ['Сегодня нужно принять решение, которое ты откладывал.', 'Не жди больше информации или нужного момента — данных уже достаточно.', 'Император не тот, кто знает всё. Он тот, кто берёт ответственность.'] },
  hierophant:       { name: 'Иерофант',          subtitle: 'день проверенных путей и чужого опыта',              desc: ['Не изобретай сегодня с нуля — найди того, кто это уже прошёл.', 'Чужой опыт сейчас ценнее собственных экспериментов. Спроси, почитай, поучись.', 'Иерофант передаёт знание не потому что умнее. А потому что уже был там.'] },
  lovers:           { name: 'Влюблённые',        subtitle: 'день выбора и честности с собой',                    desc: ['Сегодня придётся выбрать — и оба варианта что-то требуют от тебя.', 'Не ищи способа взять всё сразу. Настоящий выбор всегда что-то закрывает.', 'Ты уже знаешь ответ. Осталось решиться его признать.'] },
  chariot:          { name: 'Колесница',         subtitle: 'день движения и удержания курса',                    desc: ['Сегодня важно не останавливаться, даже если темп кажется медленным.', 'Прогресс не всегда виден в моменте — но он накапливается.', 'Колесница побеждает не скоростью, а тем, что не сворачивает.'] },
  strength:         { name: 'Сила',              subtitle: 'день мягкой силы и внутреннего спокойствия',         desc: ['Сила сегодня — не в том, чтобы продавить, а в том, чтобы не сломаться.', 'Если что-то раздражает или давит — не реагируй первым импульсом.', 'Спокойствие в трудной ситуации — это и есть настоящая мощь.'] },
  hermit:           { name: 'Отшельник',         subtitle: 'день уединения и честного взгляда внутрь',           desc: ['Сегодня меньше говори и больше думай.', 'Не каждая мысль нуждается в аудитории — побудь с ней наедине.', 'Отшельник несёт фонарь не для других. Сначала для себя.'] },
  wheel:            { name: 'Колесо Фортуны',    subtitle: 'день перемен и принятия цикла',                      desc: ['Что-то меняется — и это нормально, даже если неудобно.', 'Не пытайся заморозить то, что пришло в движение. Лучше подумай, как использовать перемену.', 'Колесо крутится всегда. Вопрос только в том, цепляешься ты за него или едешь.'] },
  justice:          { name: 'Справедливость',    subtitle: 'день честных итогов и причинно-следственных связей', desc: ['Сегодня ты пожнёшь то, что сеял — в хорошем или плохом смысле.', 'Не удивляйся результатам: они прямо следуют из того, что ты делал раньше.', 'Справедливость не наказывает и не награждает. Она просто отражает.'] },
  'hanged-man':     { name: 'Повешенный',        subtitle: 'день паузы и смены угла зрения',                    desc: ['Остановись и посмотри на ситуацию с другой стороны — буквально переверни картину.', 'То, что кажется тупиком, может оказаться поворотом, если изменить угол.', 'Повешенный не в ловушке. Он намеренно завис, чтобы увидеть больше.'] },
  death:            { name: 'Смерть',            subtitle: 'день завершений и честного отпускания',              desc: ['Что-то подходит к концу — и это не трагедия, а освобождение.', 'Не цепляйся за то, что уже отжило. Старое уходит, чтобы дать место новому.', 'Карта Смерти в таро почти никогда не про физическое. Она про трансформацию.'] },
  temperance:       { name: 'Умеренность',       subtitle: 'день баланса и ровного темпа',                       desc: ['Сегодня не надо давить на газ — достаточно просто двигаться.', 'Ровный темп без рывков и остановок принесёт больше, чем спринт с откатом.', 'Умеренность — это не слабость. Это устойчивость.'] },
  devil:            { name: 'Дьявол',            subtitle: 'день честного взгляда на свои ловушки',              desc: ['Есть что-то, что тебя держит — и ты это знаешь.', 'Привычка, зависимость, страх, токсичный паттерн — назови это своим именем.', 'Цепи на карте Дьявола надеты свободно. Ты можешь снять их. Вопрос — хочешь ли.'] },
  tower:            { name: 'Башня',             subtitle: 'день резких перемен и освобождения',                 desc: ['Сегодня может всплыть то, что давно держалось на честном слове.', 'Не пытайся любой ценой сохранить старую схему — смотри не только на потерю, но и на освобождённое место.', 'Башня рушится не чтобы навредить, а чтобы убрать то, что мешало расти.'] },
  star:             { name: 'Звезда',            subtitle: 'день надежды и тихого восстановления',               desc: ['После трудного периода приходит облегчение. Сегодня именно такой день.', 'Позволь себе почувствовать, что стало чуть легче — не отталкивай это.', 'Звезда светит не ярко, но стабильно. Это именно то, что нужно сейчас.'] },
  moon:             { name: 'Луна',              subtitle: 'день туманных ощущений и внутренних страхов',        desc: ['Сегодня что-то может казаться не тем, чем является на самом деле.', 'Прежде чем делать выводы — проверь факты. Тревога любит достраивать то, чего нет.', 'Луна не лжёт, но она искажает. Ищи свет, а не тени.'] },
  sun:              { name: 'Солнце',            subtitle: 'день ясности, энергии и открытых действий',          desc: ['Сегодня у тебя больше энергии и ясности, чем обычно. Используй это.', 'Хороший день для того, чтобы сделать что-то, что давно откладывалось из-за усталости.', 'Солнце светит всем одинаково. Вопрос — выйдешь ли ты на него.'] },
  judgement:        { name: 'Суд',               subtitle: 'день переосмысления и нового призыва',               desc: ['Сегодня стоит честно подвести итог: что за последнее время работало, а что нет.', 'Без самобичевания и без оправданий — просто факты.', 'Суд — это не приговор. Это возможность начать следующую главу осознанно.'] },
  world:            { name: 'Мир',               subtitle: 'день завершения и заслуженного признания пути',      desc: ['Что-то важное завершается — не обесценивай это.', 'Посмотри назад и признай: ты прошёл путь. Это стоит того, чтобы заметить.', 'Мир не про финальную победу. Он про целостность — когда всё на своём месте.'] },
}

function formatTodayDate() {
  return new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { preview } = await searchParams

  const today = new Date().toISOString().split('T')[0]

  const { data: todayDraw } = await supabase
    .from('card_draws')
    .select('*')
    .eq('user_id', user.id)
    .eq('drawn_at', today)
    .single()

  const { data: recentDraws } = await supabase
    .from('card_draws')
    .select('card_id, drawn_at')
    .eq('user_id', user.id)
    .order('drawn_at', { ascending: false })
    .limit(3)

  const firstName = user.user_metadata?.full_name?.split(' ')[0] || 'Путник'
  const avatarUrl = user.user_metadata?.avatar_url
  const isEmptyAllPreview = preview === 'empty-all'

  // preview overrides: ?preview=empty forces today's empty state, ?preview=empty-all simulates a new user
  let cardId: string | undefined
  if (preview === 'empty' || isEmptyAllPreview) {
    cardId = undefined
  } else if (preview === 'drawn') {
    cardId = todayDraw?.card_id ?? 'sun'
  } else {
    cardId = todayDraw?.card_id as string | undefined
  }
  const card = cardId ? CARDS[cardId] ?? null : null
  const recentDrawsForView = isEmptyAllPreview ? [] : recentDraws

  return (
    <div className="db-wrap">
      <CardSyncOnMount
        serverDraw={!preview && todayDraw?.card_id && todayDraw?.drawn_at
          ? { cardId: todayDraw.card_id, drawnAt: todayDraw.drawn_at }
          : null}
      />

      {/* HEADER */}
      <header className="db-header">
        <a href="/" className="db-logo">
          <span className="db-logo-icon">✦</span>
          <span className="db-logo-text">MORA</span>
        </a>
        <div className="db-header-right">
          <a href="/auth/logout" className="db-logout-link">Выйти</a>
          <div className="db-avatar-wrap">
            {avatarUrl
              ? <img src={avatarUrl} alt={firstName} className="db-avatar" />
              : <div className="db-avatar-placeholder">{firstName[0]}</div>
            }
            <span className="db-avatar-chevron">▾</span>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <div className="db-main">

        <h1 className="db-welcome">Добро пожаловать, {firstName}</h1>

        <div className="db-grid">

          {/* LEFT: CARD OF DAY */}
          <div className={`db-panel db-panel--card${!card ? ' db-panel--draw' : ''}`}>
            {card && cardId ? (
              <>
                <div className="db-panel-toprow">
                  <span className="db-panel-date">Сегодня {formatTodayDate()}</span>
                  <div className="db-panel-icons">
                    <button className="db-panel-icon-btn" type="button" disabled aria-label="Поделиться">
                      <svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
                        <path d="M176 160a48.07 48.07 0 0 0-33.88 14.09L96.28 145.9a48.14 48.14 0 0 0 0-35.8l45.84-28.19A48 48 0 1 0 128 48a47.47 47.47 0 0 0 2.65 15.49L82.75 91.91a48 48 0 1 0 0 72.18l47.9 28.42A47.47 47.47 0 0 0 128 208a48 48 0 1 0 48-48z"/>
                      </svg>
                    </button>
                    <button className="db-panel-icon-btn" type="button" disabled aria-label="Развернуть">
                      <svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
                        <path d="M216 48v56a8 8 0 0 1-16 0V75.31l-58.34 58.35a8 8 0 0 1-11.32-11.32L188.69 64H160a8 8 0 0 1 0-16h56a8 8 0 0 1 8 8ZM98.34 130.34 40 188.69V160a8 8 0 0 0-16 0v56a8 8 0 0 0 8 8h56a8 8 0 0 0 0-16H59.31l58.35-58.34a8 8 0 0 0-11.32-11.32Z"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="db-card-section">
                  <h2 className="db-card-section-title">Ваша карта дня</h2>

                  <div className="db-card-row">
                    <DrawnCardTilt cardId={cardId} cardName={card.name} />

                    <div className="db-card-info">
                      <div className="db-card-info-top">
                        <div className="db-card-badge">Старший аркан</div>
                        <h3 className="db-card-title">
                          <span className="db-card-title-name">{card.name}</span>
                          {card.subtitle && (
                            <span className="db-card-title-sub"> — {card.subtitle}</span>
                          )}
                        </h3>
                        <div className="db-card-descs">
                          {card.desc.map((para, i) => (
                            <p key={i} className="db-card-desc">{para}</p>
                          ))}
                        </div>
                      </div>
                      <div className="db-outcome-btns">
                        <button className="db-outcome-btn db-outcome-btn--yes" type="button">
                          <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
                            <path d="M229.66 77.66l-128 128a8 8 0 0 1-11.32 0l-56-56a8 8 0 0 1 11.32-11.32L96 188.69 218.34 66.34a8 8 0 0 1 11.32 11.32Z"/>
                          </svg>
                          Сбылось
                        </button>
                        <button className="db-outcome-btn db-outcome-btn--no" type="button">
                          <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
                            <path d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31l-66.34 66.35a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66a8 8 0 0 1 11.32-11.32L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z"/>
                          </svg>
                          Не сбылось
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <DrawWidget date={`Сегодня ${formatTodayDate()}`} />
            )}
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="db-sidebar">

            <RecentCardsWidget draws={recentDrawsForView} />

            <div className="db-panel db-tarot-stub">
              <span className="db-tarot-stub-label">Походы к тарологу</span>
              <p className="db-tarot-stub-text">Скоро здесь появятся ваши сеансы с тарологом</p>
            </div>

          </div>

        </div>

      </div>

      {/* ADVICE */}
      <div className="db-advice">
        <span className="db-advice-star">✦</span>
        <p className="db-advice-text">Совет дня: не бойся перемен. Иногда разрушение — это начало чего-то лучшего.</p>
        <span className="db-advice-star">✦</span>
      </div>

    </div>
  )
}
