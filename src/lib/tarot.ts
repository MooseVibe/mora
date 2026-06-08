import { TAROT_CARDS } from '../../public/assets/cards.js'

export type TarotCardId =
  | 'fool'
  | 'magician'
  | 'high-priestess'
  | 'empress'
  | 'emperor'
  | 'hierophant'
  | 'lovers'
  | 'chariot'
  | 'strength'
  | 'hermit'
  | 'wheel'
  | 'justice'
  | 'hanged-man'
  | 'death'
  | 'temperance'
  | 'devil'
  | 'tower'
  | 'star'
  | 'moon'
  | 'sun'
  | 'judgement'
  | 'world'
  | 'ace-of-cups'
  | 'two-of-swords'
  | 'eight-of-pentacles'
  | 'three-of-wands'
  | 'ace-of-wands'
  | 'six-of-swords'
  | 'queen-of-pentacles'

type TarotCardMeta = {
  id: TarotCardId
  name: string
  arcana: string
  journalArcana: string
  num: string
}

type TarotCardResult = {
  label?: string
  title?: string
  titleMeta?: string
  tags?: string[]
  meaningLabel?: string
  dayVariants?: string[][]
  streetVariants?: string[][]
}

export type TarotCardDefinition = {
  id: TarotCardId
  name: string
  archetype: string
  description: string
  image?: string
  imageFallback?: string
  num: string
  result?: TarotCardResult
}

export type TarotDailyMeaning = {
  label: string
  title: string
  titleMeta: string
  tags: string[]
  meaningLabel: string
  paragraphs: string[]
  variantIdx: number
}

export const TAROT_CARD_LIST = TAROT_CARDS as TarotCardDefinition[]

export const TAROT_CARD_DEFINITIONS = TAROT_CARD_LIST.reduce<Record<TarotCardId, TarotCardDefinition>>((acc, card) => {
  acc[card.id] = card
  return acc
}, {} as Record<TarotCardId, TarotCardDefinition>)

function getJournalArcana(tags: string[] | undefined): string {
  if (!tags?.length) return 'Старшие арканы'
  if (tags.length === 1) return tags[0] === 'Старший аркан' ? 'Старшие арканы' : tags[0]
  return tags.join(' / ')
}

function getArcana(card: TarotCardDefinition): string {
  const tags = card.result?.tags ?? []
  if (card.num === 'Q') return card.name
  if (tags.includes('Кубки')) return `${card.num} Кубков`
  if (tags.includes('Мечи')) return `${card.num} Мечей`
  if (tags.includes('Пентакли')) return `${card.num} Пентаклей`
  if (tags.includes('Жезлы')) return `${card.num} Жезлов`
  return `${card.num} Аркан`
}

export const TAROT_CARD_META = TAROT_CARD_LIST.reduce<Record<TarotCardId, TarotCardMeta>>((acc, card) => {
  acc[card.id] = {
    id: card.id,
    name: card.name,
    arcana: getArcana(card),
    journalArcana: getJournalArcana(card.result?.tags),
    num: card.num,
  }
  return acc
}, {} as Record<TarotCardId, TarotCardMeta>)

export function getTarotCardMeta(cardId: string) {
  return TAROT_CARD_META[cardId as TarotCardId] ?? null
}

export function getTarotCardDefinition(cardId: string) {
  return TAROT_CARD_DEFINITIONS[cardId as TarotCardId] ?? null
}

export function getTarotCardImageSrc(cardId: string) {
  return `/assets/cards/${cardId}.webp`
}

export function getTarotCardDailyMeaning(cardId: string, variantIdx = 0): TarotDailyMeaning | null {
  const card = getTarotCardDefinition(cardId)
  if (!card) return null

  const variants = card.result?.dayVariants ?? []
  const safeVariantIdx = variants.length > 0 ? variantIdx % variants.length : 0
  const paragraphs = variants[safeVariantIdx] ?? [card.description]

  return {
    label: card.result?.label ?? 'Карта дня',
    title: card.result?.title ?? card.name,
    titleMeta: card.result?.titleMeta ?? card.archetype,
    tags: card.result?.tags ?? ['Старший аркан'],
    meaningLabel: card.result?.meaningLabel ?? 'Смысл карты дня',
    paragraphs,
    variantIdx: safeVariantIdx,
  }
}

export function getTarotCardJournalSummary(cardId: string) {
  return getTarotCardDefinition(cardId)?.description ?? ''
}
