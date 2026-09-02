import { getTarotCardDefinition } from '@/lib/tarot'
import { createClient as createServerClient } from '@/lib/supabase/server'
import {
  isUnlimitedPrototypeAccount,
  prototypeAccountRequest,
} from '@/lib/prototype-testers'
import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'node:fs'
import { Agent, request as httpsRequest } from 'node:https'
import { join } from 'node:path'

const schema = {
  type: 'object',
  properties: {
    version: { type: 'integer', enum: [1] },
    overview: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        text: { type: 'string' },
      },
      required: ['title', 'text'],
    },
    cards: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          cardId: { type: 'string' },
          title: { type: 'string' },
          meaning: { type: 'string' },
          context: { type: 'string' },
        },
        required: ['cardId', 'title', 'meaning', 'context'],
      },
    },
    conclusion: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        text: { type: 'string' },
      },
      required: ['title', 'text'],
    },
  },
  required: ['version', 'overview', 'cards', 'conclusion'],
}

type SpreadRequest = {
  topic?: unknown
  cardIds?: unknown
}

type Reading = {
  version: number
  overview: { title: string; text: string }
  cards: Array<{ cardId: string; title: string; meaning: string; context: string }>
  conclusion: { title: string; text: string }
}

type ProviderSource = 'gemini' | 'gigachat'

type ProviderUsage = {
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  cachedInputTokens: number | null
}

type ProviderResult = {
  reading: Reading
  model: string
  usage: ProviderUsage
}

let gigaToken: { value: string; expiresAt: number } | null = null
let gigaOauthAgent: Agent | null = null

const topicGuidance: Record<string, string> = {
  'Внутреннее состояние': 'Сосредоточься на переживаниях, привычках и внутреннем конфликте человека. Не ставь диагнозов и не подменяй психолога.',
  'Работа': 'Сосредоточься на работе, профессиональных задачах, команде, росте или смене направления. Не предполагай, что у человека обязательно есть текущая работа.',
  'Карьера': 'Сосредоточься на работе, профессиональных задачах, команде, росте или смене направления. Не предполагай, что у человека обязательно есть текущая работа.',
  'Отношения': 'Тема относится к существующим романтическим отношениям. Разбирай динамику пары, но не утверждай как факт мысли, чувства или поступки партнёра.',
  'Поиск любви': 'Человек сейчас не находится в отношениях. Сосредоточься на знакомствах, готовности к новым отношениям и повторяющихся сценариях общения. Не обещай встречу, конкретного человека или срок.',
  'Финансы': 'Сосредоточься на доходах, расходах, финансовых привычках, стабильности и решениях человека. Не обещай прибыль или убыток и не давай инвестиционных, кредитных или азартных указаний.',
  'Выбор': 'Покажи силы, ограничения и последствия вариантов, но не принимай решение за человека.',
}

const allowedTopics = new Set(Object.keys(topicGuidance))

const rwsScenes: Record<string, string> = {
  fool: 'Юноша с белой розой и небольшим узелком стоит у края обрыва; рядом подпрыгивает белая собака, вдали видны горы, над сценой светит солнце.',
  magician: 'Маг стоит у стола с жезлом, кубком, мечом и пентаклем; одну руку с жезлом он поднял к небу, другую направил к земле. Над головой знак бесконечности, вокруг красные розы и белые лилии.',
  'high-priestess': 'Жрица сидит между чёрной колонной B и белой колонной J; за ней завеса с пальмами и гранатами. У ног лежит полумесяц, в руках свиток TORA, на голове лунная корона.',
  empress: 'Императрица сидит на мягком троне среди зрелой пшеницы; рядом лес, ручей и щит со знаком Венеры. На голове корона из двенадцати звёзд.',
  emperor: 'Император сидит на каменном троне, украшенном бараньими головами; в руках скипетр и держава. За ним поднимаются голые горы.',
  hierophant: 'Иерофант сидит между двумя колоннами, благословляя двух коленопреклонённых учеников. На нём тройная корона, у ног лежат скрещённые ключи.',
  lovers: 'Обнажённые мужчина и женщина стоят под ангелом и ярким солнцем. За женщиной растёт дерево с плодами и змеёй, за мужчиной — дерево с языками пламени; между ними видна гора.',
  chariot: 'Воин стоит в колеснице под звёздным балдахином; перед ним лежат чёрный и белый сфинксы, позади остаётся город. В руках нет поводьев: движение удерживается волей и направлением.',
  strength: 'Женщина в белом платье спокойно держит пасть льва; над её головой знак бесконечности, одежду украшает гирлянда цветов. Вдали видна гора.',
  hermit: 'Седой отшельник стоит один на заснеженной вершине; в одной руке у него посох, в другой — фонарь с шестиконечной звездой.',
}

function isReading(value: unknown, cardIds: string[]): value is Reading {
  if (!value || typeof value !== 'object') return false
  const reading = value as Partial<Reading>
  return reading.version === 1
    && typeof reading.overview?.title === 'string'
    && typeof reading.overview.text === 'string'
    && Array.isArray(reading.cards)
    && reading.cards.length === 3
    && reading.cards.every((card, index) => (
      card.cardId === cardIds[index]
      && typeof card.title === 'string'
      && typeof card.meaning === 'string'
      && typeof card.context === 'string'
    ))
    && typeof reading.conclusion?.title === 'string'
    && typeof reading.conclusion.text === 'string'
}

function parseReading(text: unknown, cardIds: string[]) {
  if (typeof text !== 'string') throw new Error('Provider returned no text')
  const json = text.match(/\{[\s\S]*\}/)?.[0]
  let reading: unknown = null
  try {
    reading = json ? JSON.parse(json) : null
  } catch {
    throw new Error('Provider returned malformed JSON')
  }
  if (reading && typeof reading === 'object' && Array.isArray((reading as Partial<Reading>).cards)) {
    const candidate = reading as Partial<Reading>
    reading = {
      ...candidate,
      version: 1,
      cards: candidate.cards!.map((card, index) => ({
        ...card,
        cardId: cardIds[index],
      })),
    }
  }
  if (!isReading(reading, cardIds)) {
    const candidate = reading as Partial<Reading> | null
    throw new Error(`Provider returned an invalid reading (cards=${Array.isArray(candidate?.cards) ? candidate.cards.length : 'invalid'})`)
  }
  return reading
}

function providerError(error: unknown) {
  if (!(error instanceof Error)) return 'failed'
  const cause = error.cause as { code?: unknown } | undefined
  return cause?.code ? `${error.message} (${String(cause.code)})` : error.message
}

async function generateWithGemini(apiKey: string, prompt: string, cardIds: string[]) {
  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
        },
      }),
      signal: AbortSignal.timeout(60_000),
    },
  )
  if (!response.ok) {
    const details = (await response.text()).slice(0, 400)
    throw new Error(`Gemini returned ${response.status}: ${details}`)
  }

  const payload = await response.json()
  const usage = payload?.usageMetadata
  return {
    reading: parseReading(payload?.candidates?.[0]?.content?.parts?.[0]?.text, cardIds),
    model: typeof payload?.modelVersion === 'string' ? payload.modelVersion : 'gemini-3.5-flash',
    usage: {
      inputTokens: typeof usage?.promptTokenCount === 'number' ? usage.promptTokenCount : null,
      outputTokens: typeof usage?.candidatesTokenCount === 'number' ? usage.candidatesTokenCount : null,
      totalTokens: typeof usage?.totalTokenCount === 'number' ? usage.totalTokenCount : null,
      cachedInputTokens: typeof usage?.cachedContentTokenCount === 'number' ? usage.cachedContentTokenCount : null,
    },
  } satisfies ProviderResult
}

function gigaRequest(url: string, headers: Record<string, string>, body: string, timeout: number) {
  const agent = gigaOauthAgent ?? new Agent({
    ca: readFileSync(join(process.cwd(), 'certs/russian_trusted_root_ca_pem.crt')),
  })
  gigaOauthAgent = agent

  return new Promise<{ status: number; text: string }>((resolve, reject) => {
    const request = httpsRequest(url, {
      method: 'POST',
      agent,
      headers,
      timeout,
    }, (incoming) => {
      const chunks: Buffer[] = []
      incoming.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      incoming.on('end', () => resolve({
        status: incoming.statusCode ?? 0,
        text: Buffer.concat(chunks).toString('utf8'),
      }))
    })
    request.on('timeout', () => request.destroy(new Error('GigaChat request timed out')))
    request.on('error', reject)
    request.end(body)
  })
}

async function getGigaToken(credentials: string) {
  if (gigaToken && gigaToken.expiresAt > Date.now() + 60_000) return gigaToken.value

  let response: { status: number; text: string } | null = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await gigaRequest(
        'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
        {
          Accept: 'application/json',
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          RqUID: crypto.randomUUID(),
        },
        'scope=GIGACHAT_API_PERS',
        15_000,
      )
      if (response.status >= 200 && response.status < 300) break
      if (attempt === 1) break
    } catch (error) {
      if (attempt === 1) throw error
    }
  }
  if (!response) throw new Error('GigaChat OAuth returned no response')
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`GigaChat OAuth returned ${response.status}: ${response.text.slice(0, 400)}`)
  }

  const payload = JSON.parse(response.text)
  if (typeof payload?.access_token !== 'string' || typeof payload?.expires_at !== 'number') {
    throw new Error('GigaChat OAuth returned an invalid token')
  }
  gigaToken = { value: payload.access_token, expiresAt: payload.expires_at }
  return gigaToken.value
}

async function generateWithGigaChat(
  credentials: string,
  systemPrompt: string,
  prompt: string,
  cardIds: string[],
) {
  const token = await getGigaToken(credentials)
  let lastError: unknown = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await gigaRequest(
        'https://api.giga.chat/v1/chat/completions',
        {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        JSON.stringify({
          model: 'GigaChat-2-Pro',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          response_format: { type: 'json_schema', schema, strict: true },
        }),
        25_000,
      )
      if (response.status < 200 || response.status >= 300) {
        const error = new Error(`GigaChat returned ${response.status}: ${response.text.slice(0, 400)}`)
        if ((response.status === 429 || response.status >= 500) && attempt === 0) {
          lastError = error
          continue
        }
        throw error
      }

      const payload = JSON.parse(response.text)
      const usage = payload?.usage
      return {
        reading: parseReading(payload?.choices?.[0]?.message?.content, cardIds),
        model: typeof payload?.model === 'string' ? payload.model : 'GigaChat-2-Pro',
        usage: {
          inputTokens: typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : null,
          outputTokens: typeof usage?.completion_tokens === 'number' ? usage.completion_tokens : null,
          totalTokens: typeof usage?.total_tokens === 'number' ? usage.total_tokens : null,
          cachedInputTokens: typeof usage?.precached_prompt_tokens === 'number' ? usage.precached_prompt_tokens : null,
        },
      } satisfies ProviderResult
    } catch (error) {
      lastError = error
      if (attempt === 1) throw error
    }
  }
  throw lastError ?? new Error('GigaChat returned no response')
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as SpreadRequest | null
  const { topic, cardIds } = body ?? {}
  if (
    typeof topic !== 'string'
    || !allowedTopics.has(topic)
    || !Array.isArray(cardIds)
    || cardIds.length !== 3
    || !cardIds.every((id) => typeof id === 'string')
    || new Set(cardIds).size !== 3
  ) {
    return NextResponse.json({ error: 'Invalid spread' }, { status: 400 })
  }

  const cards = cardIds.map((id) => getTarotCardDefinition(id))
  if (cards.some((card) => !card)) {
    return NextResponse.json({ error: 'Unknown card' }, { status: 400 })
  }

  const auth = await createServerClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user?.email) {
    return NextResponse.json({ error: 'Authenticated account required' }, { status: 401 })
  }
  const { data: { session } } = await auth.auth.getSession()
  if (!session?.access_token) {
    return NextResponse.json({ error: 'Authenticated account required' }, { status: 401 })
  }
  const isAdmin = isUnlimitedPrototypeAccount(user.email)
  const accessToken = session.access_token
  let reservationId: string | null = null

  if (!isAdmin) {
    const reservation = await prototypeAccountRequest(accessToken, {
      action: 'reserve-account-spread',
    }).catch(() => null)
    if (!reservation?.ok || reservation.data?.reserved !== true) {
      return NextResponse.json({
        error: reservation?.data?.reason ?? 'Unable to reserve spread',
        nextSpreadAt: reservation?.data?.nextSpreadAt ?? null,
      }, { status: reservation?.status === 401 ? 401 : 409 })
    }
    reservationId = reservation.data.reservationId
  }

  const releaseReservation = async () => {
    if (!reservationId) return
    await prototypeAccountRequest(accessToken, {
      action: 'release-account-spread',
      reservationId,
    }).catch(() => null)
    reservationId = null
  }

  const prompt = [
    'Ты — русскоязычный таролог Mora. Ты объясняешь расклад обычному человеку, который ничего не знает о таро и хочет получить понятный ответ.',
    'Пиши так, как умный и спокойный знакомый говорил бы за обычным столом: прямо, просто и без лекции.',
    'Используй короткие предложения. В одном предложении должна быть одна мысль. Выбирай обычные глаголы и конкретные существительные.',
    'Можно говорить прямо: «не начинай этот разговор сегодня», «спроси его об этом», «не соглашайся только из страха поссориться». Не принимай за человека опасные решения и не приказывай расставаться, увольняться, лечиться или тратить деньги.',
    'Не предсказывай конкретные события. Не утверждай как факт, что думает, чувствует или сделает другой человек. Не объявляй неизбежными расставание, увольнение, болезнь или другой конкретный исход. Если карта означает завершение, сначала назови, что именно может завершаться: старый формат общения, привычка, спор, этап или способ действия.',
    'Не используй эзотерические и терапевтические штампы. Запрещены слова и обороты: «энергия карты», «карты говорят», «вам выпало», «откликается», «внутренняя опора», «ресурс», «проявиться», «создать пространство», «действовать яснее», «назови это честно», «маленький шаг», «выбрать себя».',
    'Не строй абзацы на красивом развороте «не X, а Y». Не используй ритмические списки абстрактных слов. Если термин таро нужен, сразу объясни его обычными словами.',
    `Тема расклада: ${topic}.`,
    `Контекст темы: ${topicGuidance[topic]}`,
    'Позиции заданы до вытягивания: 1 — Прошлое: релевантный опыт или паттерн, который сформировал ситуацию; 2 — Настоящее: активная динамика темы сейчас и её связь с прошлым; 3 — Будущее: возможное или наиболее вероятное направление, если текущая динамика сохранится. Это не неизбежная судьба: решения человека могут изменить направление.',
    ...cards.map((card, index) => (
      [
        `${index + 1}. ${card!.name} (${card!.id}).`,
        `Масть или тип: ${(card!.result?.tags || ['Старший аркан']).join(', ')}. Номер или ранг: ${card!.num}.`,
        `Утверждённый визуальный образ Mora: ${card!.character}.`,
        `Утверждённые видимые детали: ${card!.visualHint}.`,
        `Каноническая сцена RWS: ${rwsScenes[card!.id] || 'Используй только утверждённые видимые детали Mora выше; не дополняй сцену по памяти.'}`,
        `Смысловое ядро карты в прямом положении: ${card!.archetype}.`,
        `Базовый смысл Mora: ${card!.description}`,
      ].join(' ')
    )),
    'Структура ответа состоит из пяти последовательных секций: Общий взгляд, Прошлое, Настоящее, Будущее, Итог.',
    `overview.title должен дословно равняться «Расклад на тему ${topic}». Не добавляй другие слова или знаки препинания.`,
    'Overview — это «Общий взгляд». Сначала назови один действительно заметный паттерн трёх карт: общую масть, повтор чисел, долю Старших арканов, сильный контраст или движение смыслов слева направо. Если общего паттерна нет, скажи, как меняется тема от первой карты к третьей. Простыми словами объясни общую линию и роли прошлого, настоящего и возможного будущего. Не выдавай итог заранее.',
    'Для каждой карты верни два отдельных абзаца.',
    'Первый абзац, поле meaning: в 2–3 коротких предложениях назови карту, свяжи её смысл с движением расклада и укажи 2–3 видимые детали с их обычным смыслом. Используй только переданные факты. Не добавляй предметы, действия или чувства персонажей, которых нет в данных.',
    'Второй абзац, поле context: ответь на вопрос позиции простым человеческим языком. Для Прошлого опиши только релевантный опыт или повторяющийся паттерн, который мог сформировать ситуацию; не выдумывай конкретное событие как факт. Для Настоящего опиши активную динамику сейчас и покажи её связь с прошлым. Для Будущего опиши условное направление, если нынешняя динамика продолжится; явно оставь место для изменения решениями человека и не предсказывай конкретное событие.',
    'Не смешивай описание изображения с трактовкой. Не выдумывай детали и не восстанавливай сцену по памяти, если утверждённых данных недостаточно.',
    'Это один рассказ, а не три независимые справки. Начинай каждую карточную главу как естественное продолжение общей линии и связывай карты через их конкретный смысл в выбранной теме. Название карты вплетай в обычное предложение. Не сообщай порядковый номер карты и не пиши «первая карта», «вторая карта», «третья карта», «карта называется», «вам выпало», «следующая карта», «предыдущая карта», «рядом с картой» или «эти карты».',
    'Conclusion — это «Итог». Дай короткий прямой ответ: что три карты вместе показывают по выбранной теме и что человеку разумно сделать сейчас. Не повторяй overview и три карточных абзаца. Не задавай вопрос в конце.',
    'Для каждой карты верни переданный cardId без изменений.',
    'Поле title каждой карты должно дословно совпадать с её русским названием выше. Поля meaning и context — по одному абзацу из 2–3 коротких предложений. Остальные тексты — 2–4 коротких предложения.',
    'version всегда равен 1.',
  ].join('\n')

  const cardTags = cards.map((card) => card!.result?.tags || ['Старший аркан'])
  const majorCount = cardTags.filter((tags) => tags.includes('Старший аркан')).length
  const suits = ['Жезлы', 'Кубки', 'Мечи', 'Пентакли']
    .map((suit) => ({ suit, count: cardTags.filter((tags) => tags.includes(suit)).length }))
    .filter(({ count }) => count > 0)
  const repeatedRanks = Array.from(new Set(cards.map((card) => card!.num)))
    .filter((rank) => cards.filter((card) => card!.num === rank).length > 1)

  const gigaSystemPrompt = [
    'Ты — русскоязычный таролог Mora. Объясняй расклад человеку без знаний таро: конкретно, спокойно и обычными словами.',
    'Верни только JSON по переданной схеме. Интерфейс сам показывает названия пяти секций.',
    'Никогда не вставляй в title, meaning, context или text служебные метки «Прошлое», «Настоящее», «Будущее», «Итог», фигурные скобки или номера секций.',
    'Каждая позиция прежде всего отвечает на свой вопрос: карта 1 — какой релевантный опыт сформировал ситуацию; карта 2 — какая динамика действует сейчас; карта 3 — какое возможное направление открывается при сохранении этой динамики. Все три главы образуют одну историю и объясняют связь прошлого, настоящего и возможного будущего.',
    'Пиши короткими предложениями. Не используй эзотерические и терапевтические штампы, философские обобщения и абстрактные советы.',
    'Не пиши формальные фразы вроде «расклад показывает», «рассматривается ситуация» или «проверяется текущее состояние». Сразу называй конкретное наблюдение.',
    'Не объявляй человеку нехватку способностей или качеств. Описывай конкретную нагрузку, конфликт задач или способ действия.',
    'Не придумывай значение отдельного символа по памяти. Связывай видимые детали только с переданным смыслом карты.',
    'Не используй слова и обороты «выгорание», «бережно относиться к себе», «осознанно», «восстановить силы». Вместо них называй конкретное действие или наблюдаемую проблему.',
    'Не предсказывай события и не утверждай как факт мысли или действия других людей. Не приказывай расставаться, увольняться, лечиться или тратить деньги.',
  ].join('\n')

  const gigaPrompt = [
    `Тема расклада: ${topic}.`,
    `Контекст темы: ${topicGuidance[topic]}`,
    'Позиции: 1 — Прошлое; 2 — Настоящее; 3 — Будущее (условное направление, а не неизбежный прогноз).',
    ...cards.map((card, index) => (
      [
        `Карта ${index + 1}: ${card!.name}.`,
        `cardId: ${card!.id}.`,
        `Масть или тип: ${(card!.result?.tags || ['Старший аркан']).join(', ')}. Номер или ранг: ${card!.num}.`,
        `Видимые детали Mora: ${card!.visualHint}.`,
        `Сцена RWS: ${rwsScenes[card!.id] || 'Используй только видимые детали Mora и не дополняй сцену по памяти.'}`,
        `Смысл карты: ${card!.archetype}. ${card!.description}`,
      ].join(' ')
    )),
    `Проверенные факты для общего взгляда: Старших арканов ${majorCount} из 3; масти — ${suits.length ? suits.map(({ suit, count }) => `${suit}: ${count}`).join(', ') : 'у Старших арканов мастей нет'}; повтор ранга — ${repeatedRanks.length ? repeatedRanks.join(', ') : 'нет'}; движение смыслов — ${cards.map((card) => card!.archetype).join(' → ')}.`,
    'Заполни пять экранов через поля JSON:',
    `overview.title: дословно «Расклад на тему ${topic}», без других слов и знаков препинания.`,
    'overview.text: 2–4 коротких предложения. Начни с одного проверенного факта выше. Если нет общей масти, повторов и большинства Старших арканов, используй движение смыслов. Объясни его именно в выбранной теме. Не пересказывай назначение расклада и не подводи итог заранее.',
    'У каждой карты два разных по задаче абзаца. context не пересказывает meaning другими словами.',
    'cards[0].meaning: 2–3 предложения. Объясни, что изображено на карте по переданной сцене RWS и видимым деталям Mora, что это канонически значит и какой релевантный опыт или паттерн это может обозначать в теме. Не утверждай конкретное прошлое событие как факт. Назови минимум две переданные видимые детали. cards[0].context: 2–3 новых предложения. Покажи, как этот опыт сформировал нынешнюю ситуацию, не выдумывая биографию человека.',
    'cards[1].meaning: 2–3 предложения. Объясни изображение, канонический смысл и его проявление в активной динамике темы сейчас. Назови минимум две переданные видимые детали. cards[1].context: 2–3 новых предложения. Покажи, как настоящее продолжает или меняет линию прошлого и что в нём важно заметить.',
    'cards[2].meaning: 2–3 предложения. Объясни изображение, канонический смысл и возможное направление темы, если нынешняя динамика сохранится. Назови минимум две переданные видимые детали. cards[2].context: 2–3 новых предложения. Покажи связь с прошлым и настоящим, подчеркни условность направления и назови одно разумное действие сейчас, которое может изменить его.',
    'conclusion.text: 2–4 предложения с прямым итогом трёх карт и разумным действием сейчас. Не повторяй предыдущие абзацы.',
    'title каждой карты дословно совпадает с её русским названием. cardId верни без изменений. version равен 1.',
    'Не пиши внутри текстовых полей названия секций или пояснения формата. Связывай позиции через конкретные значения карт, но не повторяй уже сказанные фразы и выводы.',
  ].join('\n')

  const providers: Array<{
    source: ProviderSource
    generate: () => Promise<ProviderResult>
  }> = []
  if (process.env.GEMINI_API_KEY) {
    providers.push({
      source: 'gemini',
      generate: () => generateWithGemini(process.env.GEMINI_API_KEY!, prompt, cardIds),
    })
  }
  if (process.env.GIGACHAT_CREDENTIALS) {
    providers.push({
      source: 'gigachat',
      generate: () => generateWithGigaChat(
        process.env.GIGACHAT_CREDENTIALS!,
        gigaSystemPrompt,
        gigaPrompt,
        cardIds,
      ),
    })
  }
  if (providers.length === 0) {
    if (request.nextUrl.hostname === 'localhost' || request.nextUrl.hostname === '127.0.0.1') {
      const cookie = request.headers.get('cookie')
      if (cookie) {
        const upstream = await fetch('https://mora-kappa.vercel.app/api/prototypes/spread-reading', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body: JSON.stringify({ topic, cardIds }),
          cache: 'no-store',
        })
        return new NextResponse(upstream.body, {
          status: upstream.status,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
        })
      }
    }
    await releaseReservation()
    return NextResponse.json({ error: 'Reading providers are not configured' }, { status: 503 })
  }

  const requestId = crypto.randomUUID()
  try {
    let selected: { result: ProviderResult; source: ProviderSource } | null = null
    for (const provider of providers) {
      const startedAt = Date.now()
      try {
        const result = await provider.generate()
        selected = { result, source: provider.source }
        console.info('[ai-provider]', {
          event: 'spread-generation',
          requestId,
          provider: provider.source,
          model: result.model,
          status: 'completed',
          durationMs: Date.now() - startedAt,
          ...result.usage,
        })
        break
      } catch (error) {
        console.error('[ai-provider]', {
          event: 'spread-generation',
          requestId,
          provider: provider.source,
          status: 'failed',
          durationMs: Date.now() - startedAt,
          error: providerError(error),
        })
      }
    }
    if (!selected) throw new Error('All reading providers are unavailable')

    const { result: { reading: providerReading }, source } = selected
    const reading = {
      ...providerReading,
      overview: {
        ...providerReading.overview,
        title: `Расклад на тему ${topic}`,
      },
      cards: providerReading.cards.map((card, index) => ({
        ...card,
        title: cards[index]!.name,
      })),
    }
    const snapshot = {
      version: 2,
      topic,
      cardIds,
      reading,
      source,
      createdAt: new Date().toISOString(),
    }
    let completion = null
    for (let attempt = 0; attempt < 2; attempt += 1) {
      completion = await prototypeAccountRequest(accessToken, {
        action: 'complete-account-spread',
        reservationId,
        snapshot,
      }).catch(() => null)
      if (completion?.ok && completion.data?.completed === true) break
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 200))
    }
    if (!completion?.ok || completion.data?.completed !== true) {
      console.error('[spread-reading]', {
        requestId,
        status: completion?.status ?? null,
        reason: completion?.data?.reason ?? completion?.data?.error ?? null,
        stage: 'complete-account-spread',
      })
      await releaseReservation()
      return NextResponse.json({
        reading,
        source,
        nextSpreadAt: null,
        snapshot,
        persisted: false,
      })
    }
    const nextSpreadAt = completion.data.nextSpreadAt ?? null
    reservationId = null

    return NextResponse.json({ reading, source, nextSpreadAt, snapshot })
  } catch (error) {
    console.error('[spread-reading]', { requestId, error: providerError(error) })
    await releaseReservation()
    return NextResponse.json({ error: 'Reading providers are unavailable' }, { status: 502 })
  }
}
