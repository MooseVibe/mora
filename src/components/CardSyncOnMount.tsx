'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

type DailyDraw = {
  cardId: string
  drawnAt: string
}

type PendingDraw = DailyDraw & {
  variantIdx: number
}

function getPendingDrawCookieMaxAge() {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setHours(24, 0, 0, 0)
  return Math.max(60, Math.ceil((tomorrow.getTime() - now.getTime()) / 1000))
}

function setPendingDrawCookie(draw: PendingDraw) {
  document.cookie = [
    `mora_pending_draw=${encodeURIComponent(JSON.stringify(draw))}`,
    'Path=/',
    `Max-Age=${getPendingDrawCookieMaxAge()}`,
    'SameSite=Lax',
  ].join('; ')
}

function clearPendingDrawCookie() {
  document.cookie = 'mora_pending_draw=; Path=/; Max-Age=0; SameSite=Lax'
}

function getTodayKey() {
  return new Date().toISOString().split('T')[0]
}

export default function CardSyncOnMount({ serverDraw }: { serverDraw?: DailyDraw | null }) {
  const router = useRouter()

  useEffect(() => {
    if (serverDraw) {
      const draw: PendingDraw = {
        cardId: serverDraw.cardId,
        drawnAt: serverDraw.drawnAt,
        variantIdx: 0,
      }
      localStorage.setItem('mora:pendingDraw', JSON.stringify(draw))
      setPendingDrawCookie(draw)
      return
    }

    const raw = localStorage.getItem('mora:pendingDraw')
    if (!raw) return

    let draw: PendingDraw
    try {
      draw = JSON.parse(raw)
    } catch {
      localStorage.removeItem('mora:pendingDraw')
      clearPendingDrawCookie()
      return
    }

    if (draw.drawnAt !== getTodayKey()) {
      localStorage.removeItem('mora:pendingDraw')
      clearPendingDrawCookie()
      return
    }

    setPendingDrawCookie(draw)

    fetch('/api/draws', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draw),
    }).then(res => {
      if (res.ok) {
        // не удаляем pendingDraw — он нужен чтобы после логаута
        // нельзя было вытянуть карту повторно в тот же день
        router.refresh()
      }
    }).catch(() => {})
  }, [router, serverDraw])

  return null
}
