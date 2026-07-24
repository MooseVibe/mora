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
  | 'two-of-cups'
  | 'six-of-cups'
  | 'ace-of-swords'
  | 'page-of-cups'
  | 'king-of-cups'
  | 'queen-of-cups'
  | 'knight-of-cups'
  | 'three-of-cups'
  | 'four-of-cups'
  | 'five-of-cups'
  | 'eight-of-cups'
  | 'nine-of-cups'
  | 'ten-of-cups'
  | 'two-of-swords'
  | 'four-of-swords'
  | 'five-of-swords'
  | 'seven-of-swords'
  | 'queen-of-swords'
  | 'king-of-swords'
  | 'knight-of-swords'
  | 'ace-of-pentacles'
  | 'two-of-pentacles'
  | 'three-of-pentacles'
  | 'four-of-pentacles'
  | 'five-of-pentacles'
  | 'six-of-pentacles'
  | 'seven-of-pentacles'
  | 'eight-of-pentacles'
  | 'nine-of-pentacles'
  | 'ten-of-pentacles'
  | 'page-of-pentacles'
  | 'king-of-pentacles'
  | 'knight-of-pentacles'
  | 'two-of-wands'
  | 'three-of-wands'
  | 'four-of-wands'
  | 'five-of-wands'
  | 'six-of-wands'
  | 'seven-of-wands'
  | 'eight-of-wands'
  | 'nine-of-wands'
  | 'ace-of-wands'
  | 'king-of-wands'
  | 'queen-of-wands'
  | 'page-of-wands'
  | 'knight-of-wands'
  | 'page-of-swords'
  | 'six-of-swords'
  | 'queen-of-pentacles'
  | 'seven-of-cups'
  | 'ten-of-wands'
  | 'nine-of-swords'
  | 'ten-of-swords'
  | 'eight-of-swords'

type TarotCardMeta = {
  id: TarotCardId
  name: string
  arcana: string
  journalArcana: string
  num: string
}

type TarotDayVariant = string[] | {
  preview: string[]
  full?: string[]
  share?: string
}

type TarotCardResult = {
  label?: string
  title?: string
  titleMeta?: string
  tags?: string[]
  tarotBrief?: string[]
  meaningLabel?: string
  dayVariants?: TarotDayVariant[]
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
  tarotBrief: string[]
  meaningLabel: string
  paragraphs: string[]
  fullParagraphs: string[]
  shareText?: string
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
  const image = getTarotCardDefinition(cardId)?.image
  if (!image) return `/assets/cards/${cardId}.webp`
  return image.startsWith('/') ? image : `/${image}`
}

export function getTarotCardDailyMeaning(cardId: string, variantIdx = 0): TarotDailyMeaning | null {
  const card = getTarotCardDefinition(cardId)
  if (!card) return null

  const variants = card.result?.dayVariants ?? []
  const safeVariantIdx = variants.length > 0 ? variantIdx % variants.length : 0
  const variant = variants[safeVariantIdx]
  const paragraphs = Array.isArray(variant) ? variant : variant?.preview
  const fullParagraphs = !Array.isArray(variant) && variant?.full?.length ? variant.full : paragraphs
  const shareText = !Array.isArray(variant) && typeof variant?.share === 'string'
    ? variant.share.trim()
    : ''

  return {
    label: card.result?.label ?? 'Карта дня',
    title: card.result?.title ?? card.name,
    titleMeta: card.result?.titleMeta ?? card.archetype,
    tags: card.result?.tags ?? ['Старший аркан'],
    tarotBrief: card.result?.tarotBrief ?? [],
    meaningLabel: card.result?.meaningLabel ?? 'Смысл карты дня',
    paragraphs: paragraphs ?? [card.description],
    fullParagraphs: fullParagraphs ?? paragraphs ?? [card.description],
    shareText: shareText || undefined,
    variantIdx: safeVariantIdx,
  }
}

export function getTarotCardJournalSummary(cardId: string) {
  return getTarotCardDefinition(cardId)?.description ?? ''
}
