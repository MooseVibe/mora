'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CardSyncOnMount() {
  const router = useRouter()

  useEffect(() => {
    const raw = localStorage.getItem('mora:pendingDraw')
    if (!raw) return

    let draw: { cardId: string; variantIdx: number; drawnAt: string }
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
  }, [router])

  return null
}
