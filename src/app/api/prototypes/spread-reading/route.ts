import { getTarotCardDefinition } from '@/lib/tarot'
import { createClient as createServerClient } from '@/lib/supabase/server'
import {
  PROTOTYPE_ADMIN_EMAIL,
  prototypeAccountRequest,
} from '@/lib/prototype-testers'
import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'node:fs'
import { Agent, request as httpsRequest } from 'node:https'
import { join } from 'node:path'

const schema = {
  type: 'object',
  properties: {
    version: { type: 'integer' },
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

let gigaToken: { value: string; expiresAt: number } | null = null
let gigaOauthAgent: Agent | null = null

const allowedTopics = new Set([
  'Внутреннее состояние',
  'Работа',
  'Отношения',
  'Выбор',
])

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
  if (!isReading(reading, cardIds)) throw new Error('Provider returned an invalid reading')
  return reading
}

function providerError(error: unknown) {
  if (!(error instanceof Error)) return 'failed'
  const cause = error.cause as { code?: unknown } | undefined
  return cause?.code ? `${error.message} (${String(cause.code)})` : error.message
}

async function generateWithGemini(apiKey: string, prompt: string, cardIds: string[]) {
  let response: Response | null = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(
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
    const transient = response.status === 408 || response.status === 429 || response.status >= 500
    if (!transient || attempt === 2) break
    await response.body?.cancel()
    const delay = 1000 * (2 ** attempt) + Math.floor(Math.random() * 250)
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
  if (!response) throw new Error('Gemini returned no response')
  if (!response.ok) {
    const details = (await response.text()).slice(0, 400)
    throw new Error(`Gemini returned ${response.status}: ${details}`)
  }

  const payload = await response.json()
  return parseReading(payload?.candidates?.[0]?.content?.parts?.[0]?.text, cardIds)
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

async function generateWithGigaChat(credentials: string, prompt: string, cardIds: string[]) {
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
          model: 'GigaChat-2',
          messages: [{ role: 'user', content: prompt }],
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

      return parseReading(JSON.parse(response.text)?.choices?.[0]?.message?.content, cardIds)
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
  const isAdmin = user?.email?.toLowerCase() === PROTOTYPE_ADMIN_EMAIL
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
    'Позиции заданы до вытягивания: 1 — Сейчас: что происходит в выбранной теме; 2 — Что мешает: главное препятствие; 3 — Что делать: конкретный следующий шаг.',
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
    'Структура ответа состоит из пяти последовательных секций: Общий рисунок, Сейчас, Что мешает, Что делать, Итог.',
    'Overview — это «Общий рисунок». Сначала назови один действительно заметный паттерн трёх карт: общую масть, повтор чисел, долю Старших арканов, сильный контраст или движение смыслов слева направо. Если общего паттерна нет, скажи, как меняется тема от первой карты к третьей. Объясни наблюдение простыми словами и только затем коротко обозначь, о чём будет чтение. Не выдавай итог заранее.',
    'Для каждой карты верни два отдельных абзаца.',
    'Первый абзац, поле meaning: в 2–3 коротких предложениях назови карту, свяжи её смысл с движением расклада и укажи 2–3 видимые детали с их обычным смыслом. Первая глава задаёт состояние, вторая продолжает, меняет или обостряет его, третья показывает, к чему это движение приходит. Связь должна быть смысловой: например, пауза превращается в путь, спор приводит к необходимости договориться. Не копируй эти примеры. Используй только переданные факты. Не добавляй предметы, действия или чувства персонажей, которых нет в данных.',
    'Второй абзац, поле context: ответь на вопрос позиции простым человеческим языком. Для первой карты объясни, что происходит сейчас. Для второй — что мешает и как это связано с первой. Для третьей — что конкретно можно сделать в ответ на первые две. Опирайся на смысловое ядро карты, но не пересказывай справочник.',
    'Не смешивай описание изображения с трактовкой. Не выдумывай детали и не восстанавливай сцену по памяти, если утверждённых данных недостаточно.',
    'Это один рассказ, а не три независимые справки. Начинай каждую карточную главу как естественное продолжение общей линии и связывай карты через их конкретный смысл в выбранной теме. Название карты вплетай в обычное предложение. Не сообщай порядковый номер карты и не пиши «первая карта», «вторая карта», «третья карта», «карта называется», «вам выпало», «следующая карта», «предыдущая карта», «рядом с картой» или «эти карты».',
    'Conclusion — это «Итог». Дай короткий прямой ответ: что три карты вместе показывают по выбранной теме и что человеку разумно сделать сейчас. Не повторяй overview и три карточных абзаца. Не задавай вопрос в конце.',
    'Для каждой карты верни переданный cardId без изменений.',
    'Поле title каждой карты должно дословно совпадать с её русским названием выше. Поля meaning и context — по одному абзацу из 2–3 коротких предложений. Остальные тексты — 2–4 коротких предложения.',
    'version всегда равен 1.',
  ].join('\n')

  const providers: Array<{
    source: ProviderSource
    generate: () => Promise<Reading>
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
      generate: () => generateWithGigaChat(process.env.GIGACHAT_CREDENTIALS!, prompt, cardIds),
    })
  }
  if (providers.length === 0) {
    await releaseReservation()
    return NextResponse.json({ error: 'Reading providers are not configured' }, { status: 503 })
  }

  try {
    let selected: { reading: Reading; source: ProviderSource } | null = null
    for (const provider of providers) {
      try {
        selected = { reading: await provider.generate(), source: provider.source }
        console.info('[provider]', { source: provider.source, status: 'completed' })
        break
      } catch (error) {
        console.error(`[${provider.source}]`, providerError(error))
      }
    }
    if (!selected) throw new Error('All reading providers are unavailable')

    const { reading, source } = selected
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
      throw new Error(`Unable to complete spread: ${completion?.data?.reason ?? completion?.status ?? 'failed'}`)
    }
    const nextSpreadAt = completion.data.nextSpreadAt ?? null
    reservationId = null

    return NextResponse.json({ reading, source, nextSpreadAt, snapshot })
  } catch (error) {
    console.error('[spread-reading]', providerError(error))
    await releaseReservation()
    return NextResponse.json({ error: 'Reading providers are unavailable' }, { status: 502 })
  }
}
