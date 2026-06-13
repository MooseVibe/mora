'use client'

import React from 'react'
import { getTarotCardImageSrc } from '@/lib/tarot'

interface Props {
  cardId: string
  cardName: string
  sourceKey?: string
  onOpen?: () => void
}

export default function DrawnCardTilt({ cardId, cardName, sourceKey, onOpen }: Props) {
  function handleTilt(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const dx = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2)
    const dy = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2)
    e.currentTarget.style.transition = 'transform 0.08s ease'
    e.currentTarget.style.transform = `perspective(700px) rotateY(${dx * 12}deg) rotateX(${-dy * 12}deg)`
  }

  function handleTiltEnd(e: React.MouseEvent<HTMLDivElement>) {
    e.currentTarget.style.transition = 'transform 0.42s cubic-bezier(0.22, 0.61, 0.36, 1)'
    e.currentTarget.style.transform = ''
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!onOpen || (e.key !== 'Enter' && e.key !== ' ')) return
    e.preventDefault()
    onOpen()
  }

  return (
    <div
      className={`db-drawn-card${onOpen ? ' db-drawn-card--button' : ''}`}
      data-card-reader-source={sourceKey}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-label={onOpen ? `Развернуть карту ${cardName}` : undefined}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      onMouseMove={handleTilt}
      onMouseLeave={handleTiltEnd}
    >
      <img
        src={getTarotCardImageSrc(cardId)}
        alt={cardName}
        className="db-drawn-card-art"
      />
    </div>
  )
}
