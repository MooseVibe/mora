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
      return
    }

    const raw = localStorage.getItem('mora:pendingDraw')
    if (!raw) return

    let draw: PendingDraw
    try {
      draw = JSON.parse(raw)
    } catch {
      localStorage.removeItem('mora:pendingDraw')
      return
    }

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
