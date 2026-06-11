'use client'

import { useState } from 'react'

const SHARE_BASE_URL = 'https://mora-vnkt.vercel.app'

type Props = {
  cardId: string
  cardTitle: string
  shareText?: string
}

function getTelegramShareUrl({ text, url }: { text: string; url: string }) {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
}

function isDesktopShareContext() {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

function isShareAbort(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

async function copyShareText(text: string) {
  if (!navigator.clipboard?.writeText) return false

  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

async function createShareFile(cardId: string) {
  if (typeof File === 'undefined' || !navigator.canShare) return null

  try {
    const imageUrl = new URL(`/assets/cards/${cardId}.webp`, window.location.origin).href
    const response = await fetch(imageUrl, { cache: 'force-cache' })
    if (!response.ok) return null

    const blob = await response.blob()
    const file = new File([blob], `${cardId}.webp`, { type: blob.type || 'image/webp' })
    return navigator.canShare({ files: [file] }) ? file : null
  } catch {
    return null
  }
}

export default function DashboardShareButton({ cardId, cardTitle, shareText }: Props) {
  const approvedShareText = shareText?.trim()
  const [feedback, setFeedback] = useState('')
  const isEnabled = Boolean(approvedShareText)

  function flashFeedback(label: string) {
    setFeedback(label)
    window.setTimeout(() => setFeedback(''), 1500)
  }

  async function handleShare() {
    if (!approvedShareText) return

    const title = `Моя карта дня — ${cardTitle}`
    const url = SHARE_BASE_URL
    const text = [
      `Сегодня моя карта дня — ${cardTitle}.`,
      '',
      approvedShareText,
      '',
      'Вытащи свою карту дня:',
    ].join('\n')
    const fallbackText = `${text}\n${url}`
    const telegramUrl = getTelegramShareUrl({ text, url })

    if (isDesktopShareContext()) {
      const popup = window.open(telegramUrl, '_blank', 'noopener,noreferrer')
      if (popup) return

      const copied = await copyShareText(fallbackText)
      flashFeedback(copied ? 'Скопировано' : 'Не удалось')
      return
    }

    if (navigator.share) {
      try {
        const file = await createShareFile(cardId)
        const files = file ? [file] : undefined
        await navigator.share({
          title,
          text,
          url,
          ...(files ? { files } : {}),
        })
        return
      } catch (error) {
        if (isShareAbort(error)) return
      }
    }

    const popup = window.open(telegramUrl, '_blank', 'noopener,noreferrer')
    if (popup) return

    const copied = await copyShareText(fallbackText)
    flashFeedback(copied ? 'Скопировано' : 'Не удалось')
  }

  return (
    <button
      className={`db-panel-icon-btn${isEnabled ? ' db-panel-icon-btn--active' : ''}`}
      type="button"
      disabled={!isEnabled}
      aria-label={isEnabled ? 'Поделиться картой дня' : 'Поделиться картой дня — текст ещё не готов'}
      title={feedback || (isEnabled ? 'Поделиться картой дня' : 'Поделиться картой дня — текст ещё не готов')}
      onClick={handleShare}
    >
      <svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
        <path d="M176 160a48.07 48.07 0 0 0-33.88 14.09L96.28 145.9a48.14 48.14 0 0 0 0-35.8l45.84-28.19A48 48 0 1 0 128 48a47.47 47.47 0 0 0 2.65 15.49L82.75 91.91a48 48 0 1 0 0 72.18l47.9 28.42A47.47 47.47 0 0 0 128 208a48 48 0 1 0 48-48z"/>
      </svg>
    </button>
  )
}
