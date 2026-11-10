"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"

/** Each section owns one card. */
const sections = [
  { id: "work", label: "Work", title: "Selected work", body: "Placeholder copy. Projects, case studies and client names will live here once the portfolio is designed." },
  { id: "studio", label: "Studio", title: "The studio", body: "Placeholder copy. Who we are, how we work and what we believe in." },
  { id: "contact", label: "Contact", title: "Let's talk", body: "Placeholder copy. Email, socials and a short brief form will live here." },
] as const

type SectionId = (typeof sections)[number]["id"]
type Card = { key: number; id: SectionId; closing: boolean; entering: boolean }

/**
 * Centered nav over the hero. Each link owns one full-screen card (three max)
 * that slides in from the right over the others; re-pressing a link lifts its
 * card back to the front. Each card is
 * 100vw wide, at least 100vh tall, and scrolls when its content is taller.
 * Scrolling (wheel or swipe) also steps through the cards: down opens the next
 * section, up removes the front card. Nav presses are locked while a card is sliding in. Close, Esc or the wordmark clears the whole stack, top card first (70ms
 * stagger), revealing the hero.
 * Rung 1: CSS keyframes only.
 */
export function Navbar() {
  const [cards, setCards] = useState<Card[]>([])
  const nextKey = useRef(0)

  /**
   * One card per section. Opening a section that is already in the stack lifts
   * its card to the front and replays the slide-in; the front card is a no-op.
   */
  const withOpened = (current: Card[], id: SectionId): Card[] => {
    const front = current.findLast(c => !c.closing)
    if (front?.id === id) return current
    // While entering, the nav is locked until the slide-in animation ends (see onAnimationEnd).
    const entering = !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    return [...current.filter(c => c.closing || c.id !== id), { key: nextKey.current++, id, closing: false, entering }]
  }
  const open = (id: SectionId) => setCards(current => withOpened(current, id))

  /**
   * Scroll steps. Down opens the section after the front card (Work, Studio,
   * Contact); up slides only the front card out. Ignored while any card is
   * mid-animation, so one gesture is one step.
   */
  const scrollStep = useCallback((direction: 1 | -1) => setCards(current => {
    if (current.some(c => c.closing || c.entering)) return current
    const front = current[current.length - 1]
    if (direction > 0) {
      const next = sections[front ? sections.findIndex(s => s.id === front.id) + 1 : 0]
      return next ? withOpened(current, next.id) : current
    }
    if (!front) return current
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return current.slice(0, -1)
    return current.map(c => (c === front ? { ...c, closing: true } : c))
  }), [])
  useEffect(() => {
    const GESTURE_GAP = 140 // ms of silence that separates two wheel gestures (trackpad inertia keeps firing for ~1s)
    const SWIPE = 60 // px of finger travel that counts as one swipe
    const gesture = { last: 0, consumed: false, touchY: null as number | null }
    /** True when the front card is taller than the screen and still has content to scroll in this direction. */
    const cardCanScroll = (direction: 1 | -1) => {
      const front = Array.from(document.querySelectorAll<HTMLElement>(".site-card:not([data-closing])")).pop()
      if (!front || front.scrollHeight <= front.clientHeight + 1) return false
      return direction > 0 ? front.scrollTop + front.clientHeight < front.scrollHeight - 1 : front.scrollTop > 0
    }
    const ignored = (target: EventTarget | null) => target instanceof Element && !!target.closest(".properties-panel, .properties-launcher, input, select, textarea")
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || ignored(event.target) || Math.abs(event.deltaY) < Math.abs(event.deltaX) || Math.abs(event.deltaY) < 4) return
      const now = performance.now()
      if (now - gesture.last > GESTURE_GAP) gesture.consumed = false
      gesture.last = now
      const direction = event.deltaY > 0 ? 1 : -1
      if (gesture.consumed || cardCanScroll(direction)) return
      gesture.consumed = true
      scrollStep(direction)
    }
    const onTouchStart = (event: TouchEvent) => { gesture.touchY = ignored(event.target) ? null : event.touches[0].clientY }
    const onTouchMove = (event: TouchEvent) => {
      if (gesture.touchY === null) return
      const delta = gesture.touchY - event.touches[0].clientY // finger moving up = scrolling down
      if (Math.abs(delta) < SWIPE) return
      const direction = delta > 0 ? 1 : -1
      if (cardCanScroll(direction)) return
      gesture.touchY = null // one step per swipe
      scrollStep(direction)
    }
    window.addEventListener("wheel", onWheel, { passive: true })
    window.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchmove", onTouchMove, { passive: true })
    return () => {
      window.removeEventListener("wheel", onWheel)
      window.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchmove", onTouchMove)
    }
  }, [scrollStep])
  const remove = (key: number) => setCards(current => current.filter(c => c.key !== key))

  /** Closing any card clears the stack so the hero shows again; cards leave top-down. */
  const closeAll = useCallback(() => setCards(current =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? []
      : current.map(c => (c.closing ? c : { ...c, closing: true }))), [])

  const locked = cards.some(c => c.entering && !c.closing)
  const settle = (key: number) => setCards(current => current.map(c => (c.key === key ? { ...c, entering: false } : c)))
  // Safety net: if the browser never reports animationend (e.g. hidden tab), unlock after the animation should have finished.
  useEffect(() => {
    if (!locked) return
    const timer = window.setTimeout(() => setCards(current => current.map(c => (c.entering ? { ...c, entering: false } : c))), 1400)
    return () => window.clearTimeout(timer)
  }, [locked])

  const live = cards.filter(c => !c.closing)
  const hasCards = live.length > 0
  useEffect(() => {
    if (!hasCards) return
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") closeAll() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [hasCards, closeAll])

  const top = live[live.length - 1]

  return (
    <>
      <header className="site-nav">
        <Link href="/" className="site-nav-brand" aria-label="Survivors, home" onClick={event => { if (cards.length) { event.preventDefault(); closeAll() } }}>Survivors</Link>
        <nav aria-label="Primary">
          <ul>
            {sections.map(s => (
              <li key={s.id}>
                <button type="button" data-active={top?.id === s.id ? "true" : undefined} aria-disabled={locked || undefined} onClick={() => { if (!locked) open(s.id) }}>{s.label}</button>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      {cards.map((card, index) => {
        const section = sections.find(s => s.id === card.id) ?? sections[0]
        const isTop = card === top
        return (
          <aside
            key={card.key}
            className="site-card"
            data-closing={card.closing ? "true" : undefined}
            inert={!isTop}
            aria-label={section.title}
            style={{ zIndex: 15 + index, animationDelay: card.closing ? `${(cards.length - 1 - index) * 70}ms` : undefined }}
            onAnimationEnd={event => {
              if (event.target !== event.currentTarget) return
              if (card.closing) remove(card.key)
              else if (card.entering && event.animationName === "site-card-in") settle(card.key)
            }}
          >
            <div className="site-card-inner">
              <p className="site-card-eyebrow">{String(sections.indexOf(section) + 1).padStart(2, "0")} — {section.label}</p>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
              <button type="button" className="site-card-close" onClick={closeAll}>Close</button>
            </div>
          </aside>
        )
      })}
    </>
  )
}
