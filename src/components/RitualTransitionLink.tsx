'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { MouseEvent, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const TRANSITION_MS = 1720
const REDUCED_MOTION_TRANSITION_MS = 320

type Props = {
  href: string
  className?: string
  ariaLabel?: string
  children: ReactNode
}

function shouldUseNativeNavigation(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.defaultPrevented ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  )
}

export default function RitualTransitionLink({ href, className, ariaLabel, children }: Props) {
  const router = useRouter()
  const [isMounted, setIsMounted] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    router.prefetch(href)
  }, [href, router])

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (shouldUseNativeNavigation(event)) return

    event.preventDefault()
    setIsTransitioning(true)
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    window.setTimeout(() => {
      router.push(href)
    }, prefersReducedMotion ? REDUCED_MOTION_TRANSITION_MS : TRANSITION_MS)
  }

  return (
    <>
      <Link
        href={href}
        prefetch
        className={className}
        aria-label={ariaLabel}
        onClick={handleClick}
      >
        {children}
      </Link>

      {isMounted && isTransitioning && createPortal(
        <div className="nav-transition-overlay" role="status" aria-live="polite" aria-label="Грузим колоду">
          <div className="app-loader-deck nav-shuffling" aria-hidden="true">
            <span className="app-loader-card" />
            <span className="app-loader-card" />
            <span className="app-loader-card" />
            <span className="app-loader-card" />
          </div>
          <div className="app-loader-copy">
            <div className="app-loader-text">
              <span className="app-loader-label">Грузим колоду</span>
              <span className="app-loader-dots" aria-hidden="true">
                <span>.</span><span>.</span><span>.</span>
              </span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
