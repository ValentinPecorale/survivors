/**
 * Card motion engine. Each card owns a position `p` (0 = off-screen right,
 * 1 = fully covering). Two things move it:
 *
 *  - tween: timed slide (nav button / close). Eased, fixed duration.
 *  - scrub: scroll or swipe. Linear 1:1 with the gesture (only a short
 *    exponential follow smooths mouse-wheel notches), no timing at all.
 *
 * Positions are written straight to element transforms in a rAF loop, so a
 * scroll gesture never triggers a React render per frame.
 */

import { cubicBezier } from "./bezier"
import { bezierEase, getCardSettings } from "./card-settings"

export type Card<Id extends string = string> = { key: number; id: Id; closing: boolean; entering: boolean }

type Motion = {
  p: number
  target: number | null
  scrubbed: boolean
  /** Key held down: p creeps toward HOLD_PEEK through the creep ease until released or the hold time commits it. */
  hold: { start: number; replace: number | null } | null
  tween: { from: number; to: number; start: number; delay: number; dur: number; onDone: () => void; onEarly?: () => void; early?: boolean; ease?: (t: number) => number } | null
}

/** Base duration for partial slides (a released hold retreating). Opening a card uses openMs from card-settings.ts. */
export const SLIDE_MS = 1500
/** Follow time constant for scrubbing: ~90ms glides wheel notches without adding easing. */
const SMOOTH_MS = 90
const MIN_TWEEN = 0.35
/** The nav unlocks this long before a slide-in ends, so the next press can start as it lands. */
export const EARLY_UNLOCK_MS = 100

/** Ease-in only (quartic): the card accelerates all the way and stops sharply at full speed, no ease-out. */
const ease = cubicBezier(0.5, 0, 0.75, 0)
/** Hold creep and final-slide curves, durations and peek come live from card-settings.ts (properties panel, Cards tab). */
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export function createCardEngine<Id extends string>(order: readonly Id[], onChange: (cards: Card<Id>[]) => void) {
  let cards: Card<Id>[] = []
  let nextKey = 0
  let raf = 0
  let last = 0
  const motion = new Map<number, Motion>()
  const els = new Map<number, HTMLElement>()

  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const commit = (next: Card<Id>[]) => { cards = next; onChange(next) }
  const live = () => cards.filter(c => !c.closing)
  const front = () => live().at(-1)
  const unlocking = (t: NonNullable<Motion["tween"]>, now: number) => !!t.onEarly && now >= t.start + t.delay + t.dur - EARLY_UNLOCK_MS
  const busy = () => { const now = performance.now(); return [...motion.values()].some(m => m.hold || (m.tween && !unlocking(m.tween, now))) }

  const paint = (key: number) => {
    const el = els.get(key)
    const m = motion.get(key)
    if (!el || !m) return
    el.style.transform = m.p >= 1 ? "none" : `translateX(${(1 - m.p) * 100}%)`
  }
  const remove = (key: number) => {
    motion.delete(key)
    commit(cards.filter(c => c.key !== key))
  }
  const settle = (key: number) => commit(cards.map(c => (c.key === key ? { ...c, entering: false } : c)))

  const frame = (now: number) => {
    raf = 0
    const dt = Math.min(now - last, 64)
    last = now
    let active = false
    for (const [key, m] of [...motion]) {
      const t = m.tween
      if (m.hold) {
        const cfg = getCardSettings()
        const raw = clamp01((now - m.hold.start) / cfg.holdMs)
        m.p = (cfg.peekPct / 100) * bezierEase(cfg.creepEase)(raw)
        if (raw >= 1) { paint(key); commitHold(key); active = true; continue }
        paint(key)
        active = true
        continue
      } else if (t) {
        const u = (now - t.start - t.delay) / t.dur
        if (u < 0) { active = true; continue }
        if (!t.early && unlocking(t, now)) { t.early = true; t.onEarly?.() }
        if (u >= 1) { m.p = t.to; m.tween = null; paint(key); t.onDone(); continue }
        m.p = t.from + (t.to - t.from) * (t.ease ?? ease)(u)
        active = true
      } else if (m.target !== null) {
        const diff = m.target - m.p
        if (Math.abs(diff) < 0.0005) {
          m.p = m.target
          m.target = null
          if (m.p === 0 && m.scrubbed) { remove(key); continue }
        } else {
          m.p += diff * (1 - Math.exp(-dt / SMOOTH_MS))
          active = true
        }
      }
      paint(key)
    }
    if (active) raf = requestAnimationFrame(frame)
  }
  const kick = () => {
    if (raf) return
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }

  const tweenTo = (key: number, to: number, opts: { delay?: number; full?: boolean; ms?: number; ease?: (t: number) => number; onDone: () => void; onEarly?: () => void }) => {
    const m = motion.get(key)
    if (!m) return
    m.target = null
    m.hold = null
    m.tween = { from: m.p, to, start: performance.now(), delay: opts.delay ?? 0, dur: opts.ms ?? (opts.full ? getCardSettings().openMs : SLIDE_MS * Math.max(MIN_TWEEN, Math.abs(to - m.p))), onDone: opts.onDone, onEarly: opts.onEarly, ease: opts.ease ?? (opts.full ? bezierEase(getCardSettings().openEase) : undefined) }
  }

  /** A held card is now fully open: drop the older card of the same section it was lifted from. */
  const finishHold = (key: number) => {
    const m = motion.get(key)
    const replace = m?.hold?.replace ?? null
    if (m) { m.hold = null; m.p = 1 }
    if (replace !== null) motion.delete(replace)
    commit(cards.filter(c => c.key !== replace).map(c => (c.key === key ? { ...c, entering: false } : c)))
  }

  /** The hold reached holdMs: finish the card (finishMs, finishEase). Holding longer changes nothing. */
  const commitHold = (key: number) => {
    const m = motion.get(key)
    if (!m?.hold) return
    const replace = m.hold.replace
    tweenTo(key, 1, { ms: getCardSettings().finishMs, ease: bezierEase(getCardSettings().finishEase), onDone: () => { m.hold = { start: 0, replace }; finishHold(key) }, onEarly: () => settle(key) })
  }

  /** Appends a card for `id` at p = 0, dropping any older live card of the same section. */
  const spawn = (id: Id) => {
    const key = nextKey++
    const previous = cards.find(c => !c.closing && c.id === id)
    if (previous) motion.delete(previous.key)
    motion.set(key, { p: 0, target: null, scrubbed: false, hold: null, tween: null })
    return { key, next: [...cards.filter(c => c.closing || c.id !== id), { key, id, closing: false, entering: false } as Card<Id>] }
  }

  return {
    /** Ref callback target: registers a card element and paints its current position. */
    register(key: number, el: HTMLElement | null) {
      if (el) { els.set(key, el); paint(key) } else els.delete(key)
    },

    /** Nav button: slide the section's card in over the stack (or finish a half-scrubbed one). */
    open(id: Id) {
      if (busy() || cards.some(c => c.closing)) return
      const top = front()
      const current = top && motion.get(top.key)
      if (top && current && top.id === id && (current.tween || (current.p >= 1 && current.target === null))) return
      if (top && current && top.id === id) {
        if (reduced()) { current.p = 1; current.target = null; paint(top.key); return }
        commit(cards.map(c => (c === top ? { ...c, entering: true } : c)))
        tweenTo(top.key, 1, { full: true, onDone: () => settle(top.key), onEarly: () => settle(top.key) })
        kick()
        return
      }
      // Anything half-scrolled on screen completes alongside the new card.
      for (const card of live()) {
        const m = motion.get(card.key)
        if (!m || m.p >= 1 || m.tween) continue
        if (reduced()) { m.p = 1; m.target = null; paint(card.key) } else tweenTo(card.key, 1, { full: true, onDone: () => {} })
      }
      const { key, next } = spawn(id)
      if (reduced()) { motion.get(key)!.p = 1; commit(next); return }
      commit(next.map(c => (c.key === key ? { ...c, entering: true } : c)))
      tweenTo(key, 1, { full: true, onDone: () => settle(key), onEarly: () => settle(key) })
      kick()
    },

    /**
     * Key pressed: the section's card starts creeping in (to the peek over
     * the hold time) and commits if the key is still down at the end. If the section already has a card lower in the stack it stays
     * put until this one commits, so an aborted hold loses nothing.
     */
    holdStart(id: Id) {
      if (busy() || cards.some(c => c.closing)) return false
      if (front()?.id === id) return false
      const key = nextKey++
      const replace = live().find(c => c.id === id)?.key ?? null
      motion.set(key, { p: 0, target: null, scrubbed: false, hold: { start: performance.now(), replace }, tween: null })
      commit([...cards, { key, id, closing: false, entering: true } as Card<Id>])
      kick()
      return true
    },

    /** Key released before the hold time: the card goes back to where it started and is removed. */
    holdEnd() {
      const held = [...motion].find(([, m]) => m.hold)
      if (!held) return
      const [key, m] = held
      const cfg = getCardSettings()
      m.p = (cfg.peekPct / 100) * bezierEase(cfg.creepEase)(clamp01((performance.now() - m.hold!.start) / cfg.holdMs))
      paint(key)
      tweenTo(key, 0, { onDone: () => remove(key) })
      kick()
    },

    /** Slide every card out, top first, revealing the hero. */
    closeAll() {
      const open = live()
      if (!open.length) return
      if (reduced()) { motion.clear(); commit([]); return }
      commit(cards.map(c => ({ ...c, closing: true, entering: false })))
      const cfg = getCardSettings()
      const ease = bezierEase(cfg.closeEase)
      open.forEach((c, i) => tweenTo(c.key, 0, {
        delay: (open.length - 1 - i) * cfg.closeStaggerMs,
        ms: cfg.closeMs * Math.max(MIN_TWEEN, motion.get(c.key)?.p ?? 1),
        ease,
        onDone: () => remove(c.key),
      }))
      kick()
    },

    /**
     * Scroll/swipe. `amount` is a fraction of one full slide (+ forward, - back).
     * Forward advances the front card or spawns the next section's card;
     * backward retreats the front card and removes it at 0.
     */
    scrub(amount: number) {
      if (!amount || busy() || cards.some(c => c.closing)) return
      let driver = front()
      const effective = driver && (motion.get(driver.key)?.target ?? motion.get(driver.key)?.p ?? 1)
      if (amount > 0 && (!driver || (effective ?? 1) >= 1)) {
        const nextId = order[driver ? order.indexOf(driver.id) + 1 : 0]
        if (nextId === undefined) return
        const { key, next } = spawn(nextId)
        commit(next)
        driver = next.find(c => c.key === key)
      }
      if (!driver) return
      const m = motion.get(driver.key)
      if (!m) return
      m.target = clamp01((m.target ?? m.p) + amount)
      m.scrubbed = true
      kick()
    },

    /** True when the front card is fully covering the screen and at rest. */
    frontSettled() {
      const top = front()
      const m = top && motion.get(top.key)
      return !!m && m.p >= 0.999 && m.target === null
    },

    /** Safety net when rAF never fired (hidden tab): jump running tweens to their end. */
    finishTweens() {
      for (const [key, m] of [...motion]) {
        const t = m.tween
        if (!t) continue
        m.p = t.to
        m.tween = null
        paint(key)
        t.onDone()
      }
    },

    destroy() { cancelAnimationFrame(raf); raf = 0 },
  }
}
