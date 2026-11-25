"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { sections, navItems, sectionFromPath, SectionContent, type SectionId } from "./sections"
import { createCardEngine } from "./card-engine"
import { getCardSettings, loadCardSettings, scrollCamera, useCardSettings } from "./card-settings"
import { loadGradientSettings } from "./gradient-settings"
import { SoundToggle } from "./sound-toggle"
import { SHORTCUT_KEYS, SOUND_KEY } from "./shortcuts"
import { toggleAudio } from "./hero/sound"
import { setSkyLook, stepSkyView, toggleSkyLook, skyLooking, useSkyActive } from "./hero/sky-look"

/** Scroll distance for one full slide, as a fraction of viewport height. 1:1 and linear. */
const SCROLL_TRAVEL = 0.8
/** Keyboard scrolling: one arrow press moves this many px (holding repeats); PageUp / PageDown move this share of the screen. */
const KEY_STEP = 100
const KEY_PAGE = 0.85
/** A pause this long in scroll input ends a gesture. Short on purpose: a fresh scroll up from the side view must feel instant. */
const GESTURE_GAP_MS = 120

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

  // One page: every nav button but Learnings is a place inside the About card. Open the card if it is not in front, then bring the anchor to its top edge.
  const goRaf = useRef(0)
  const [anchor, setAnchor] = useState<string | undefined>()
  const go = useCallback((card: SectionId, selector?: string) => {
    cancelAnimationFrame(goRaf.current)
    setSkyLook(false)
    const frontEl = () => Array.from(document.querySelectorAll<HTMLElement>(".site-card:not([data-closing])")).pop()
    const offsetOf = (el: HTMLElement, target: HTMLElement) => target.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop
    const inFront = engine.snapshot().filter(c => !c.closing).at(-1)?.id === card
    if (inFront) {
      const el = frontEl(), target = selector ? el?.querySelector<HTMLElement>(selector) : null
      if (!el || !target || !engine.frontSettled()) return
      // Glide there: ease-in-out, 0.9s plus 80ms per screen travelled (cap 2.2s). Any other scroll input (wheel, drag) cancels it.
      const from = el.scrollTop, to = Math.max(0, Math.min(el.scrollHeight - el.clientHeight, offsetOf(el, target)))
      const dur = Math.min(2200, 900 + Math.abs(to - from) / window.innerHeight * 80)
      const start = performance.now()
      let written = from
      const step = (now: number) => {
        if (Math.abs(el.scrollTop - written) > 2) return
        const u = Math.min(1, (now - start) / dur)
        el.scrollTop = from + (to - from) * (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2)
        written = el.scrollTop
        if (u < 1) goRaf.current = requestAnimationFrame(step)
      }
      goRaf.current = requestAnimationFrame(step)
      return
    }
    engine.open(card)
    if (!selector) return
    // The card is still sliding in: park its scroll position behind the slide, so it arrives already in place.
    const deadline = performance.now() + 8000
    const locate = () => {
      const el = frontEl(), target = el?.querySelector<HTMLElement>(selector)
      if (el && target && !el.hasAttribute("inert")) el.scrollTop = offsetOf(el, target)
      if (!(target && engine.frontSettled()) && performance.now() < deadline) goRaf.current = requestAnimationFrame(locate)
    }
    goRaf.current = requestAnimationFrame(locate)
  }, [engine])
  useEffect(() => () => cancelAnimationFrame(goRaf.current), [])
  useEffect(() => {
    const here = (event: Event) => go("about", `[data-anchor="${(event as CustomEvent<string>).detail}"]`)
    window.addEventListener("survivors:go", here)
    return () => window.removeEventListener("survivors:go", here)
  }, [go])
  useEffect(() => {
    const show = () => go("about", "#clients")
    window.addEventListener("survivors:show-clients", show)
    return () => window.removeEventListener("survivors:show-clients", show)
  }, [go])

  // Which anchor the front card is showing: the last marker that has reached its top edge. Lights the matching nav button.
  useEffect(() => {
    let raf = 0
    const measure = () => {
      raf = 0
      const el = Array.from(document.querySelectorAll<HTMLElement>(".site-card:not([data-closing])")).pop()
      if (!el) { setAnchor(undefined); return }
      const edge = el.getBoundingClientRect().top + 4
      const hit = Array.from(el.querySelectorAll<HTMLElement>("[data-anchor]")).filter(m => m.getBoundingClientRect().top <= edge).at(-1)
      setAnchor(hit?.dataset.anchor)
    }
    const queue = () => { if (!raf) raf = requestAnimationFrame(measure) }
    window.addEventListener("scroll", queue, true)
    queue()
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", queue, true) }
  }, [cards])

  // Contact: clear the cards, then tilt the hero camera up to the sky. Pressing it again (or Home / Esc / any section) looks back down.
  const contact = useCallback(() => {
    if (skyLooking()) { setSkyLook(false); return }
    engine.closeAll()
    toggleSkyLook()
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
  const skyActive = useSkyActive() // scroll up, Contact or Space: the sky view is up, so Contact is where you are (not Home)


  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setSkyLook(false); engine.closeAll() } }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [engine])

  // Pressing a section's letter opens its card instantly, same slide as the nav button. No hold.
  useEffect(() => {
    // Sliders, switches and colour pickers do not swallow letters, so shortcuts keep working after tuning a control.
    const editable = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || /^(TEXTAREA|SELECT)$/.test(target.tagName) || (target instanceof HTMLInputElement && !/^(range|checkbox|radio|color|button)$/.test(target.type)))
    const down = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || editable(event.target)) return
      if (event.key.toLowerCase() === SOUND_KEY) { toggleAudio(); return }
      if (event.key.toLowerCase() === SHORTCUT_KEYS[0]) { setSkyLook(false); engine.closeAll(); return }
      if (event.key === " " && !(event.target instanceof HTMLElement && event.target.closest("button, a"))) { event.preventDefault(); contact(); return }
      const item = navItems.find(n => n.key === event.key.toLowerCase())
      if (item) go(item.card, item.anchor && `[data-anchor="${item.anchor}"]`)
    }
    window.addEventListener("keydown", down)
    return () => window.removeEventListener("keydown", down)
  }, [engine, go, contact])

  useEffect(() => {
    const touch = { y: null as number | null }
    // Route input explicitly: wheel momentum can remain targeted at the outgoing
    // card, so native scrolling alone cannot reliably reach the newly active card.
    // Smooth scroll: wheel notches move a target, the card's scrollTop eases toward it
    // (exponential follow, time constant = scrollSmoothMs). Position is kept as a float
    // because scrollTop rounds, which would stall small steps.
    const glider = { el: null as HTMLElement | null, pos: 0, target: 0, written: 0, raf: 0, last: 0 }
    const stopGlide = () => { cancelAnimationFrame(glider.raf); glider.raf = 0 }
    const glide = (front: HTMLElement, pixels: number, max: number) => {
      const { scrollSmoothMs, scrollSpeed } = getCardSettings()
      const distance = pixels * scrollSpeed
      if (scrollSmoothMs <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        stopGlide(); glider.el = null
        front.scrollTop = Math.max(0, Math.min(max, front.scrollTop + distance))
        return
      }
      // Resync when something else moved the card (anchor jump, scrollbar, new front card).
      if (glider.el !== front || Math.abs(front.scrollTop - glider.written) > 1.5) { glider.el = front; glider.pos = front.scrollTop; glider.target = glider.pos; glider.written = front.scrollTop }
      glider.target = Math.max(0, Math.min(max, glider.target + distance))
      if (glider.raf) return
      glider.last = performance.now()
      const step = (now: number) => {
        const el = glider.el
        if (!el || !el.isConnected || Math.abs(el.scrollTop - glider.written) > 1.5) { glider.raf = 0; return }
        const dt = Math.min(now - glider.last, 50); glider.last = now
        const tau = Math.max(1, getCardSettings().scrollSmoothMs)
        glider.pos += (glider.target - glider.pos) * (1 - Math.exp(-dt / tau))
        const done = Math.abs(glider.target - glider.pos) < 0.5
        if (done) glider.pos = glider.target
        el.scrollTop = glider.pos
        glider.written = el.scrollTop
        glider.raf = done ? 0 : requestAnimationFrame(step)
      }
      glider.raf = requestAnimationFrame(step)
    }
    const scrollContent = (pixels: number, apply = true) => {
      if (!engine.frontSettled()) return false
      const front = Array.from(document.querySelectorAll<HTMLElement>(".site-card:not([data-closing])")).pop()
      if (!front) return false
      const max = front.scrollHeight - front.clientHeight
      // While gliding, judge room from where the content is heading, not where it is now.
      const at = glider.el === front && glider.raf ? glider.target : front.scrollTop
      const room = pixels > 0 ? at < max - 1 : at > 1
      if (!room) return false
      if (apply) glide(front, pixels, max)
      return true
    }
    const ignored = (target: EventTarget | null) => target instanceof Element && !!target.closest(".properties-panel, .properties-launcher, input, select, textarea")
    const travel = () => window.innerHeight * SCROLL_TRAVEL
    // Side view is the start. Scrolling up on the bare hero scrubs straight to the sky, no extra steps.
    // The one exception: the swipe that brings the camera back from the zenith ends at the side view. Its remaining input (and the trackpad
    // momentum behind it) is swallowed until a new gesture begins: a pause of GESTURE_GAP_MS, a scroll the other way, or a flick harder than the tail before it.
    const gesture = { last: 0, mag: 0, locked: false, dir: -1 }
    const skyScroll = (pixels: number) => {
      if (engine.snapshot().some(c => !c.closing) || scrollCamera.progress > 0.001) { gesture.locked = true; gesture.dir = -1; return false }
      if (gesture.locked) {
        const newGesture = Math.sign(pixels) !== gesture.dir || performance.now() - gesture.last > GESTURE_GAP_MS || Math.abs(pixels) > gesture.mag * 1.4 + 4
        if (!newGesture) return true
        gesture.locked = false
      }
      // One scroll gesture is one step: up from the side view goes to the searchlight (centred, the forest stopped), up again to the sky,
      // and down retraces both. The rest of that swipe (and its trackpad momentum) is swallowed until a new gesture begins.
      if (pixels < 0 || skyLooking()) {
        stepSkyView(pixels < 0 ? 1 : -1)
        gesture.locked = true; gesture.dir = Math.sign(pixels)
        return true
      }
      return false
    }
    const stamp = (event: Event) => {
      gesture.last = performance.now()
      if (event instanceof WheelEvent) gesture.mag = Math.abs(event.deltaY) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1)
    }
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || ignored(event.target) || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return
      // Normalize line/page wheel modes to pixels.
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1)
      event.preventDefault()
      if (!pixels || (engine.frontReached() && !engine.frontSettled()) || scrollContent(pixels)) return
      if (skyScroll(pixels)) return
      engine.scrub(pixels / travel())
    }
    // Keyboard: Arrow Up / Down and Page Up / Down scroll exactly like the mouse wheel (same routing, same smoothing and speed),
    // so they scroll the open card, or drive the hero → card transition when no card is open. Controls that use the arrows themselves
    // (sliders, selects, text fields) keep them; Space stays the Contact shortcut.
    const typing = (target: EventTarget | null) => target instanceof Element && !!target.closest("input, select, textarea, [contenteditable=''], [contenteditable='true'], [role='slider']")
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || typing(event.target)) return
      const pixels = event.key === "ArrowDown" ? KEY_STEP : event.key === "ArrowUp" ? -KEY_STEP : event.key === "PageDown" ? window.innerHeight * KEY_PAGE : event.key === "PageUp" ? -window.innerHeight * KEY_PAGE : 0
      if (!pixels) return
      event.preventDefault()
      if ((engine.frontReached() && !engine.frontSettled()) || scrollContent(pixels)) return
      if (skyScroll(pixels)) return
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
      if (skyScroll(delta)) return
      engine.scrub(delta / travel())
    }
    window.addEventListener("wheel", onWheel, { passive: false })
    window.addEventListener("keydown", onKey)
    window.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchmove", onTouchMove, { passive: false })
    // Registered last, so each handler above sees the previous input's time and size.
    window.addEventListener("keydown", stamp, { passive: true })
    window.addEventListener("wheel", stamp, { passive: true })
    window.addEventListener("touchmove", stamp, { passive: true })
    return () => {
      window.removeEventListener("wheel", onWheel)
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("keydown", stamp)
      window.removeEventListener("wheel", stamp)
      window.removeEventListener("touchmove", stamp)
    }
  }, [engine])

  return (
    <>
      <header className="site-nav">
        <nav aria-label="Primary">
          <ul>
            <li>
              <Link href="/" scroll={false} aria-current={!hasCards && !skyActive ? "page" : undefined} aria-keyshortcuts={SHORTCUT_KEYS[0].toUpperCase()} onNavigate={event => { event.preventDefault(); setSkyLook(false); engine.closeAll() }}><span>Home</span><kbd aria-hidden="true">[{SHORTCUT_KEYS[0].toUpperCase()}]</kbd></Link>
            </li>
            {navItems.map(s => (
              <li key={s.id}>
                <Link href={`/${s.card}${s.anchor ? `#${s.anchor}` : ""}`} scroll={false} aria-current={top?.id === s.card && (!s.anchor || anchor === s.anchor) ? "page" : undefined} aria-keyshortcuts={s.key.toUpperCase()} aria-disabled={locked || undefined} onNavigate={event => { event.preventDefault(); if (!locked) go(s.card, s.anchor && `[data-anchor="${s.anchor}"]`) }}><span>{s.label}</span><kbd aria-hidden="true">[{s.key.toUpperCase()}]</kbd></Link>
              </li>
            ))}
            <li>
              <button type="button" aria-keyshortcuts="Space" aria-current={skyActive ? "page" : undefined} onClick={contact}><span>Contact</span><kbd aria-hidden="true">[SPACE]</kbd></button>
            </li>
            <li><SoundToggle /></li>
          </ul>
        </nav>
      </header>
      {/* Keep the route outlet rendered even when Home has no card. The page
          can return null, but Next still needs to visit its segment boundary. */}
      {/* The section pages render null (their content lives in the cards below), so this costs nothing. */}
      <div hidden>{children}</div>
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
              <SectionContent id={card.id} />

            </div>
          </aside>
        )
      })}
    </>
  )
}
