"use client"

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { sections, sectionFromPath, SectionContent, type SectionId } from "./sections"
import { createCardEngine } from "./card-engine"
import { loadCardSettings, useCardSettings } from "./card-settings"
import { loadGradientSettings } from "./gradient-settings"
import { SoundToggle } from "./sound-toggle"
import { SHORTCUT_KEYS } from "./shortcuts"

/** Scroll distance for one full slide, as a fraction of viewport height. 1:1 and linear. */
const SCROLL_TRAVEL = 0.8

/**
 * Centered nav over the hero. Each link owns one full-screen card (three max)
 * stacked over the others.
 *
 * - Nav link or letter key (W/S/D; A returns home): timed slide, triggered instantly on press. Delay, duration,
 *   ease and unlock time are in the properties panel (Cards tab; default 1.5s quartic ease-in).
 *   Buttons are locked until 100ms before it ends.
 * - Scroll / swipe: scrubbed. Down pulls the next section's card in, up pushes
 *   the front card out; its position follows the gesture linearly, so you
 *   scroll normally until the card is fully visible. See card-engine.ts.
 * - Close, Esc or Home clears the whole stack, top card first (70ms stagger).
 *
 * A small rAF engine instead of ScrollTrigger: the page has no document scroll
 * to pin or scrub against, and button tweens must share the same positions.
 */
export function Navbar({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const routedPath = useRef(pathname)
  const syncingRoute = useRef(false)
  const [engine] = useState(() => createCardEngine<SectionId>(
    sections.map(s => s.id), () => {}, sectionFromPath(pathname),
  ))
  const [cards, setCards] = useState(() => engine.snapshot())

  useLayoutEffect(() => {
    return engine.subscribe(next => {
      setCards(next)
      const front = next.filter(c => !c.closing).at(-1)
      const destination = front ? `/${front.id}` : "/"
      if (!syncingRoute.current && destination !== routedPath.current) {
        routedPath.current = destination
        router.push(destination, { scroll: false })
      }
    })
  }, [router, engine])

  useLayoutEffect(() => {
    if (pathname === routedPath.current) return
    routedPath.current = pathname
    syncingRoute.current = true
    engine.navigate(sectionFromPath(pathname))
    syncingRoute.current = false
  }, [pathname, engine])
  useEffect(() => () => engine.destroy(), [engine])

  useEffect(() => {
    let raf = 0
    const showClients = () => {
      cancelAnimationFrame(raf)
      engine.open("about")
      const deadline = performance.now() + 8000
      const locate = () => {
        const target = document.querySelector<HTMLElement>(".site-card:not([inert]) #clients")
        const card = target?.closest<HTMLElement>(".site-card")
        if (target && card && engine.frontSettled()) {
          card.scrollTop += target.getBoundingClientRect().top - card.getBoundingClientRect().top
          return
        }
        if (performance.now() < deadline) raf = requestAnimationFrame(locate)
      }
      raf = requestAnimationFrame(locate)
    }
    window.addEventListener("survivors:show-clients", showClients)
    return () => { cancelAnimationFrame(raf); window.removeEventListener("survivors:show-clients", showClients) }
  }, [engine])

  const { openMs, openDelayMs } = useCardSettings()
  useEffect(() => { loadCardSettings(); loadGradientSettings() }, [])
  const locked = cards.some(c => c.entering)
  // Safety net: if the browser never reports animation frames (hidden tab), unlock after the slide should have finished.
  useEffect(() => {
    if (!locked) return
    const timer = window.setTimeout(() => engine.finishTweens(), openDelayMs + openMs + 600)
    return () => window.clearTimeout(timer)
  }, [locked, openMs, openDelayMs, engine])

  const live = cards.filter(c => !c.closing)
  const top = live[live.length - 1]
  const hasCards = live.length > 0


  useEffect(() => {
    if (!hasCards) return
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") engine.closeAll() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [hasCards, engine])

  // Pressing a section's letter opens its card instantly, same slide as the nav button. No hold.
  useEffect(() => {
    // Sliders, switches and colour pickers do not swallow letters, so shortcuts keep working after tuning a control.
    const editable = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || /^(TEXTAREA|SELECT)$/.test(target.tagName) || (target instanceof HTMLInputElement && !/^(range|checkbox|radio|color|button)$/.test(target.type)))
    const down = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || editable(event.target)) return
      if (event.key.toLowerCase() === SHORTCUT_KEYS[0]) { engine.closeAll(); return }
      const section = sections.find(s => s.key === event.key.toLowerCase())
      if (section) engine.open(section.id)
    }
    window.addEventListener("keydown", down)
    return () => window.removeEventListener("keydown", down)
  }, [engine])

  useEffect(() => {
    const touch = { y: null as number | null }
    // Route input explicitly: wheel momentum can remain targeted at the outgoing
    // card, so native scrolling alone cannot reliably reach the newly active card.
    const scrollContent = (pixels: number, apply = true) => {
      if (!engine.frontSettled()) return false
      const front = Array.from(document.querySelectorAll<HTMLElement>(".site-card:not([data-closing])")).pop()
      if (!front) return false
      const max = front.scrollHeight - front.clientHeight
      const room = pixels > 0 ? front.scrollTop < max - 1 : front.scrollTop > 1
      if (!room) return false
      if (apply) front.scrollTop = Math.max(0, Math.min(max, front.scrollTop + pixels))
      return true
    }
    const ignored = (target: EventTarget | null) => target instanceof Element && !!target.closest(".properties-panel, .properties-launcher, input, select, textarea")
    const travel = () => window.innerHeight * SCROLL_TRAVEL

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || ignored(event.target) || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return
      // Normalize line/page wheel modes to pixels.
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1)
      event.preventDefault()
      if (!pixels || (engine.frontReached() && !engine.frontSettled()) || scrollContent(pixels)) return
      engine.scrub(pixels / travel())
    }
    const onTouchStart = (event: TouchEvent) => { touch.y = ignored(event.target) ? null : event.touches[0].clientY }
    const onTouchMove = (event: TouchEvent) => {
      if (touch.y === null) return
      const y = event.touches[0].clientY
      const delta = touch.y - y // finger moving up = scrolling down
      touch.y = y
      if (event.touches.length !== 1) return
      if (engine.frontReached() && !engine.frontSettled()) { event.preventDefault(); return }
      if (!delta || scrollContent(delta, false)) return
      event.preventDefault()
      engine.scrub(delta / travel())
    }
    window.addEventListener("wheel", onWheel, { passive: false })
    window.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchmove", onTouchMove, { passive: false })
    return () => {
      window.removeEventListener("wheel", onWheel)
      window.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchmove", onTouchMove)
    }
  }, [engine])

  return (
    <>
      <header className="site-nav">
        <nav aria-label="Primary">
          <ul>
            <li>
              <Link href="/" scroll={false} aria-current={!hasCards ? "page" : undefined} aria-keyshortcuts={SHORTCUT_KEYS[0].toUpperCase()} onNavigate={event => { event.preventDefault(); engine.closeAll() }}><span>Home</span><kbd aria-hidden="true">[{SHORTCUT_KEYS[0].toUpperCase()}]</kbd></Link>
            </li>
            {sections.map(s => (
              <li key={s.id}>
                <Link href={`/${s.id}`} scroll={false} aria-current={top?.id === s.id ? "page" : undefined} aria-keyshortcuts={s.key.toUpperCase()} aria-disabled={locked || undefined} onNavigate={event => { event.preventDefault(); if (!locked) engine.open(s.id) }}><span>{s.label}</span><kbd aria-hidden="true">[{s.key.toUpperCase()}]</kbd></Link>
              </li>
            ))}
            <li>
              <button type="button" aria-keyshortcuts="Space"><span>Contact</span><kbd aria-hidden="true">[SPACE]</kbd></button>
            </li>
            <li><SoundToggle /></li>
          </ul>
        </nav>
      </header>
      {/* Keep the route outlet rendered even when Home has no card. The page
          can return null, but Next still needs to visit its segment boundary. */}
      {!cards.some(card => sectionFromPath(pathname) === card.id) && (
        <div hidden={sectionFromPath(pathname) !== undefined}>{children}</div>
      )}
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
            style={{ zIndex: 15 + index, transform: "none" }}
          >
            <div className="site-card-inner">
              {sectionFromPath(pathname) === card.id ? children : <SectionContent id={card.id} />}

            </div>
          </aside>
        )
      })}
    </>
  )
}
