'use client'

import React from 'react'

interface Props {
  cardId: string
  cardName: string
}

export default function DrawnCardTilt({ cardId, cardName }: Props) {
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

  return (
    <div
      className="db-drawn-card"
      onMouseMove={handleTilt}
      onMouseLeave={handleTiltEnd}
    >
      <img
        src={`/assets/cards/${cardId}.png`}
        alt={cardName}
        className="db-drawn-card-art"
      />
    </div>
  )
}
