"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"

/** Each section owns one card with a fixed tone, so reordering never recolors it. */
const sections = [
  { id: "work", label: "Work", title: "Selected work", body: "Placeholder copy. Projects, case studies and client names will live here once the portfolio is designed.", tone: { bg: "#f5f5f0", fg: "#0b0b0b", light: true } },
  { id: "studio", label: "Studio", title: "The studio", body: "Placeholder copy. Who we are, how we work and what we believe in.", tone: { bg: "#0b0b0b", fg: "#f5f5f0", light: false } },
  { id: "contact", label: "Contact", title: "Let's talk", body: "Placeholder copy. Email, socials and a short brief form will live here.", tone: { bg: "#c9ccbf", fg: "#0b0b0b", light: true } },
] as const

type SectionId = (typeof sections)[number]["id"]
type Card = { key: number; id: SectionId; closing: boolean; entering: boolean }

/**
 * Centered nav over the hero. Each link owns one full-screen card (three max)
 * that slides in from the right over the others; re-pressing a link lifts its
 * card back to the front. Each card is
 * 100vw wide, at least 100vh tall, and scrolls when its content is taller.
 * Nav presses are locked while a card is sliding in. Close, Esc or the wordmark clears the whole stack, top card first (70ms
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
  const open = (id: SectionId) => setCards(current => {
    const front = current.findLast(c => !c.closing)
    if (front?.id === id) return current
    // While entering, the nav is locked until the slide-in animation ends (see onAnimationEnd).
    const entering = !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    return [...current.filter(c => c.closing || c.id !== id), { key: nextKey.current++, id, closing: false, entering }]
  })
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
  // Follow the visually topmost card, even while it is still sliding out.
  const visibleTop = cards[cards.length - 1]
  const topTone = visibleTop ? sections.find(s => s.id === visibleTop.id)?.tone ?? null : null

  return (
    <>
      <header className="site-nav" data-on-light={topTone?.light ? "true" : undefined}>
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
        const tone = section.tone
        const isTop = card === top
        return (
          <aside
            key={card.key}
            className="site-card"
            data-closing={card.closing ? "true" : undefined}
            inert={!isTop}
            aria-label={section.title}
            style={{ zIndex: 15 + index, animationDelay: card.closing ? `${(cards.length - 1 - index) * 70}ms` : undefined, "--card-bg": tone.bg, "--card-fg": tone.fg } as React.CSSProperties}
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
