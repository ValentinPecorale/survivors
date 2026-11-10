"use client"

import { useEffect, useState } from "react"

const sections = [
  { id: "work", label: "Work", title: "Selected work", body: "Placeholder copy. Projects, case studies and client names will live here once the portfolio is designed." },
  { id: "studio", label: "Studio", title: "The studio", body: "Placeholder copy. Who we are, how we work and what we believe in." },
  { id: "contact", label: "Contact", title: "Let's talk", body: "Placeholder copy. Email, socials and a short brief form will live here." },
] as const

type SectionId = (typeof sections)[number]["id"]

/**
 * Centered nav over the hero. Clicking a link slides a full-screen card in
 * from the right to cover the hero. Rung 1 (CSS transitions): no GSAP needed
 * for one transform. Click the active link, the close button or Esc to leave.
 */
export function Navbar() {
  const [active, setActive] = useState<SectionId | null>(null)
  // Keep the last section rendered so the card's content doesn't vanish mid slide-out.
  const [shown, setShown] = useState<SectionId>("work")
  const section = sections.find(s => s.id === shown) ?? sections[0]

  const toggle = (id: SectionId) => {
    setShown(id)
    setActive(current => (current === id ? null : id))
  }

  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setActive(null) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [active])

  return (
    <>
      <header className="site-nav" data-on-light={active ? "true" : undefined}>
        <a href="/" className="site-nav-brand" aria-label="Survivors, home">Survivors</a>
        <nav aria-label="Primary">
          <ul>
            {sections.map(s => (
              <li key={s.id}>
                <button type="button" aria-expanded={active === s.id} aria-controls="site-card" data-active={active === s.id ? "true" : undefined} onClick={() => toggle(s.id)}>
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <aside id="site-card" className="site-card" data-open={active ? "true" : "false"} inert={!active} aria-label={section.title}>
        <div className="site-card-inner">
          <p className="site-card-eyebrow">{section.label}</p>
          <h2>{section.title}</h2>
          <p>{section.body}</p>
          <button type="button" className="site-card-close" onClick={() => setActive(null)}>Close</button>
        </div>
      </aside>
    </>
  )
}
