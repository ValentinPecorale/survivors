"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"

const sections = [
  { id: "work", label: "Work", title: "Selected work", body: "Placeholder copy. Projects, case studies and client names will live here once the portfolio is designed." },
  { id: "studio", label: "Studio", title: "The studio", body: "Placeholder copy. Who we are, how we work and what we believe in." },
  { id: "contact", label: "Contact", title: "Let's talk", body: "Placeholder copy. Email, socials and a short brief form will live here." },
] as const

type SectionId = (typeof sections)[number]["id"]
type Card = { key: number; id: SectionId; closing: boolean }

/** Tone cycles per stack depth so overlapping cards stay distinguishable. */
const tones = [
  { bg: "#f5f5f0", fg: "#0b0b0b", light: true },
  { bg: "#0b0b0b", fg: "#f5f5f0", light: false },
  { bg: "#c9ccbf", fg: "#0b0b0b", light: true },
]
const MAX_CARDS = 10

/**
 * Centered nav over the hero. Every click on a link stacks a new full-screen
 * card that slides in from the right over the previous ones. Each card is
 * 100vw wide, at least 100vh tall, and scrolls when its content is taller.
 * Close, Esc or the wordmark clears the whole stack, top card first (70ms
 * stagger), revealing the hero.
 * Rung 1: CSS keyframes only.
 */
export function Navbar() {
  const [cards, setCards] = useState<Card[]>([])
  const nextKey = useRef(0)

  const open = (id: SectionId) =>
    setCards(current => current.filter(c => !c.closing).length >= MAX_CARDS ? current
      : [...current, { key: nextKey.current++, id, closing: false }])

  const remove = (key: number) => setCards(current => current.filter(c => c.key !== key))
  /** Closing any card clears the stack so the hero shows again; cards leave top-down. */
  const closeAll = useCallback(() => setCards(current =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? []
      : current.map(c => (c.closing ? c : { ...c, closing: true }))), [])

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
  const topTone = visibleTop ? tones[(cards.length - 1) % tones.length] : null

  return (
    <>
      <header className="site-nav" data-on-light={topTone?.light ? "true" : undefined}>
        <Link href="/" className="site-nav-brand" aria-label="Survivors, home" onClick={event => { if (cards.length) { event.preventDefault(); closeAll() } }}>Survivors</Link>
        <nav aria-label="Primary">
          <ul>
            {sections.map(s => (
              <li key={s.id}>
                <button type="button" data-active={top?.id === s.id ? "true" : undefined} onClick={() => open(s.id)}>{s.label}</button>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      {cards.map((card, index) => {
        const section = sections.find(s => s.id === card.id) ?? sections[0]
        const tone = tones[index % tones.length]
        const isTop = card === top
        return (
          <aside
            key={card.key}
            className="site-card"
            data-closing={card.closing ? "true" : undefined}
            inert={!isTop}
            aria-label={section.title}
            style={{ zIndex: 15 + index, animationDelay: card.closing ? `${(cards.length - 1 - index) * 70}ms` : undefined, "--card-bg": tone.bg, "--card-fg": tone.fg } as React.CSSProperties}
            onAnimationEnd={event => { if (card.closing && event.target === event.currentTarget) remove(card.key) }}
          >
            <div className="site-card-inner">
              <p className="site-card-eyebrow">{String(index + 1).padStart(2, "0")} — {section.label}</p>
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
