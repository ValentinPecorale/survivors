"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { createCardEngine, type Card } from "./card-engine"

/** Each section owns one card. */
const sections = [
  { id: "work", label: "Work", key: "w", title: "Selected work", body: "Placeholder copy. Projects, case studies and client names will live here once the portfolio is designed." },
  { id: "studio", label: "Studio", key: "s", title: "The studio", body: "Placeholder copy. Who we are, how we work and what we believe in." },
  { id: "contact", label: "Contact", key: "c", title: "Let's talk", body: "Placeholder copy. Email, socials and a short brief form will live here." },
] as const

type SectionId = (typeof sections)[number]["id"]

/** Scroll distance for one full slide, as a fraction of viewport height. 1:1 and linear. */
const SCROLL_TRAVEL = 0.8

/**
 * Centered nav over the hero. Each link owns one full-screen card (three max)
 * stacked over the others.
 *
 * - Nav button: timed slide (900ms, expo in-out). Buttons are locked until it ends.
 * - Scroll / swipe: scrubbed. Down pulls the next section's card in, up pushes
 *   the front card out; its position follows the gesture linearly, so you
 *   scroll normally until the card is fully visible. See card-engine.ts.
 * - Hold a section's letter ([W] [S] [C]) for 2s: its card slides in linearly with
 *   the hold (ease in-out, cubic-bezier(0.65, 0, 0.35, 1) over 2s). Release before 1s
 *   and it returns; after 1s it finishes opening.
 * - Close, Esc or the wordmark clears the whole stack, top card first (70ms stagger).
 *
 * A small rAF engine instead of ScrollTrigger: the page has no document scroll
 * to pin or scrub against, and button tweens must share the same positions.
 */
export function Navbar() {
  const [cards, setCards] = useState<Card<SectionId>[]>([])
  const [engine] = useState(() => createCardEngine<SectionId>(sections.map(s => s.id), setCards))
  useEffect(() => () => engine.destroy(), [engine])

  const locked = cards.some(c => c.entering)
  // Safety net: if the browser never reports animation frames (hidden tab), unlock after the slide should have finished.
  useEffect(() => {
    if (!locked) return
    const timer = window.setTimeout(() => engine.finishTweens(), 1400)
    return () => window.clearTimeout(timer)
  }, [locked, engine])

  const live = cards.filter(c => !c.closing)
  const top = live[live.length - 1]
  const hasCards = live.length > 0

  useEffect(() => {
    if (!hasCards) return
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") engine.closeAll() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [hasCards, engine])

  // Hold a section's letter for 2s to open its card; see card-engine.ts holdStart/holdEnd.
  useEffect(() => {
    const editable = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
    let holding: string | null = null
    const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const down = (event: KeyboardEvent) => {
      if (event.repeat || holding || event.ctrlKey || event.metaKey || event.altKey || editable(event.target)) return
      const section = sections.find(s => s.key === event.key.toLowerCase())
      if (!section) return
      if (reduced()) { engine.open(section.id); return }
      if (engine.holdStart(section.id)) holding = section.key
    }
    const up = (event: KeyboardEvent) => {
      if (holding && event.key.toLowerCase() === holding) { holding = null; engine.holdEnd() }
    }
    const blur = () => { if (holding) { holding = null; engine.holdEnd() } }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", blur)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", blur)
    }
  }, [engine])

  useEffect(() => {
    const touch = { y: null as number | null }
    /** True when the front card is taller than the screen and still has content to scroll in this direction. */
    const cardCanScroll = (direction: 1 | -1) => {
      if (!engine.frontSettled()) return false
      const front = Array.from(document.querySelectorAll<HTMLElement>(".site-card:not([data-closing])")).pop()
      if (!front || front.scrollHeight <= front.clientHeight + 1) return false
      return direction > 0 ? front.scrollTop + front.clientHeight < front.scrollHeight - 1 : front.scrollTop > 0
    }
    const ignored = (target: EventTarget | null) => target instanceof Element && !!target.closest(".properties-panel, .properties-launcher, input, select, textarea")
    const travel = () => window.innerHeight * SCROLL_TRAVEL

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || ignored(event.target) || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return
      // Normalize line/page wheel modes to pixels.
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1)
      if (cardCanScroll(pixels > 0 ? 1 : -1)) return
      engine.scrub(pixels / travel())
    }
    const onTouchStart = (event: TouchEvent) => { touch.y = ignored(event.target) ? null : event.touches[0].clientY }
    const onTouchMove = (event: TouchEvent) => {
      if (touch.y === null) return
      const y = event.touches[0].clientY
      const delta = touch.y - y // finger moving up = scrolling down
      touch.y = y
      if (cardCanScroll(delta > 0 ? 1 : -1)) return
      engine.scrub(delta / travel())
    }
    window.addEventListener("wheel", onWheel, { passive: true })
    window.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchmove", onTouchMove, { passive: true })
    return () => {
      window.removeEventListener("wheel", onWheel)
      window.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchmove", onTouchMove)
    }
  }, [engine])

  return (
    <>
      <header className="site-nav">
        <Link href="/" className="site-nav-brand" aria-label="Survivors, home" onClick={event => { if (cards.length) { event.preventDefault(); engine.closeAll() } }}>Survivors</Link>
        <nav aria-label="Primary">
          <ul>
            {sections.map(s => (
              <li key={s.id}>
                <button type="button" data-active={top?.id === s.id ? "true" : undefined} aria-disabled={locked || undefined} onClick={() => { if (!locked) engine.open(s.id) }}>{s.label}<kbd aria-hidden="true">[{s.key.toUpperCase()}]</kbd></button>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      {cards.map((card, index) => {
        const section = sections.find(s => s.id === card.id) ?? sections[0]
        return (
          <aside
            key={card.key}
            ref={el => engine.register(card.key, el)}
            className="site-card"
            data-closing={card.closing ? "true" : undefined}
            inert={card !== top}
            aria-label={section.title}
            style={{ zIndex: 15 + index }}
          >
            <div className="site-card-inner">
              <p className="site-card-eyebrow">{String(sections.indexOf(section) + 1).padStart(2, "0")} — {section.label}</p>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
              <button type="button" className="site-card-close" onClick={() => engine.closeAll()}>Close</button>
            </div>
          </aside>
        )
      })}
    </>
  )
}
