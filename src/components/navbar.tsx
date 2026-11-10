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
 * Close (or Esc) removes the top card; the wordmark clears the whole stack.
 * Rung 1: CSS keyframes only.
 */
export function Navbar() {
  const [cards, setCards] = useState<Card[]>([])
  const nextKey = useRef(0)

  const open = (id: SectionId) =>
    setCards(current => current.filter(c => !c.closing).length >= MAX_CARDS ? current
      : [...current, { key: nextKey.current++, id, closing: false }])

  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const remove = (key: number) => setCards(current => current.filter(c => c.key !== key))
  const closeTop = useCallback(() => setCards(current => {
    const index = current.findLastIndex(c => !c.closing)
    if (index < 0) return current
    if (reduced()) return current.filter((_, i) => i !== index)
    return current.map((c, i) => (i === index ? { ...c, closing: true } : c))
  }), [])
  const closeAll = () => setCards(current => (reduced() ? [] : current.map(c => ({ ...c, closing: true }))))

  const live = cards.filter(c => !c.closing)
  const hasCards = live.length > 0
  useEffect(() => {
    if (!hasCards) return
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") closeTop() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [hasCards, closeTop])

  const top = live[live.length - 1]
  const topTone = top ? tones[cards.indexOf(top) % tones.length] : null

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
            style={{ zIndex: 15 + index, "--card-bg": tone.bg, "--card-fg": tone.fg } as React.CSSProperties}
            onAnimationEnd={event => { if (card.closing && event.target === event.currentTarget) remove(card.key) }}
          >
            <div className="site-card-inner">
              <p className="site-card-eyebrow">{String(index + 1).padStart(2, "0")} — {section.label}</p>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
              <button type="button" className="site-card-close" onClick={closeTop}>Close</button>
            </div>
          </aside>
        )
      })}
    </>
  )
}
