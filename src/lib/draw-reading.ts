import { getTarotCardDailyMeaning } from '@/lib/tarot'

export type ReadingSnapshot = {
  version: 1
  label: string
  title: string
  titleMeta: string
  tags: string[]
  meaningLabel: string
  paragraphs: string[]
}

export type DrawReadingRow = {
  card_id: string
  drawn_at: string
  variant_idx?: number | null
  reading_snapshot?: unknown
}

export type DrawReading = {
  cardId: string
  drawnAt: string
  variantIdx: number
  title: string
  titleMeta: string
  tags: string[]
  meaningLabel: string
  paragraphs: string[]
  source: 'snapshot' | 'fallback'
}

function normalizeVariantIdx(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function isReadingSnapshot(value: unknown): value is ReadingSnapshot {
  if (!value || typeof value !== 'object') return false

  const snapshot = value as Partial<ReadingSnapshot>
  return snapshot.version === 1 &&
    typeof snapshot.label === 'string' &&
    typeof snapshot.title === 'string' &&
    typeof snapshot.titleMeta === 'string' &&
    isStringArray(snapshot.tags) &&
    typeof snapshot.meaningLabel === 'string' &&
    isStringArray(snapshot.paragraphs)
}

export function createReadingSnapshot(cardId: string, variantIdx: number): ReadingSnapshot | null {
  const meaning = getTarotCardDailyMeaning(cardId, variantIdx)
  if (!meaning) return null

  return {
    version: 1,
    label: meaning.label,
    title: meaning.title,
    titleMeta: meaning.titleMeta,
    tags: meaning.tags,
    meaningLabel: meaning.meaningLabel,
    paragraphs: meaning.paragraphs,
  }
}

export function getDrawReading(row: DrawReadingRow): DrawReading | null {
  const variantIdx = normalizeVariantIdx(row.variant_idx)

  if (isReadingSnapshot(row.reading_snapshot)) {
    return {
      cardId: row.card_id,
      drawnAt: row.drawn_at,
      variantIdx,
      title: row.reading_snapshot.title,
      titleMeta: row.reading_snapshot.titleMeta,
      tags: row.reading_snapshot.tags,
      meaningLabel: row.reading_snapshot.meaningLabel,
      paragraphs: row.reading_snapshot.paragraphs,
      source: 'snapshot',
    }
  }

  const fallback = getTarotCardDailyMeaning(row.card_id, variantIdx)
  if (!fallback) return null

  return {
    cardId: row.card_id,
    drawnAt: row.drawn_at,
    variantIdx: fallback.variantIdx,
    title: fallback.title,
    titleMeta: fallback.titleMeta,
    tags: fallback.tags,
    meaningLabel: fallback.meaningLabel,
    paragraphs: fallback.paragraphs,
    source: 'fallback',
  }
}
