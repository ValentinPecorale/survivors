"use client"

import { useSyncExternalStore } from "react"
import { cubicBezier } from "./bezier"

export type Bezier = [number, number, number, number]

/**
 * Tunable numbers for the hold-a-letter shortcut. Read live by card-engine.ts,
 * edited in the properties panel (Cards tab). Not React state: the navbar,
 * the engine and the panel live in different trees.
 */
export const defaultCardSettings = {
  /** Hold this long to trigger the card. */
  holdMs: 1200,
  /** How much of the card is visible by the time the hold ends, in percent. */
  peekPct: 20,
  /** Easing of the 0 to peek creep while holding. */
  creepEase: [0.16, 1, 0.3, 1] as Bezier,
  /** Duration of the final slide (peek to 100%) after the hold triggers. */
  finishMs: 200,
  /** Easing of the final slide. Default is linear. */
  finishEase: [1 / 3, 1 / 3, 2 / 3, 2 / 3] as Bezier,
}
export type CardSettings = typeof defaultCardSettings

export const easePresets: [string, Bezier][] = [
  ["Linear", [1 / 3, 1 / 3, 2 / 3, 2 / 3]],
  ["Ease out · quart", [0.25, 1, 0.5, 1]],
  ["Ease out · expo", [0.16, 1, 0.3, 1]],
  ["Ease out · cubic", [0.33, 1, 0.68, 1]],
  ["Ease in · quart", [0.5, 0, 0.75, 0]],
  ["Ease in · cubic", [0.32, 0, 0.67, 0]],
  ["Ease in-out · cubic", [0.65, 0, 0.35, 1]],
  ["Ease in-out · expo", [0.87, 0, 0.13, 1]],
]

const STORAGE_KEY = "survivors:card-settings:v1"
const easeCache = new Map<string, (t: number) => number>()

/** Cached easing function for a bezier. */
export function bezierEase(b: Bezier) {
  const key = b.join(",")
  let fn = easeCache.get(key)
  if (!fn) { fn = cubicBezier(b[0], b[1], b[2], b[3]); easeCache.set(key, fn) }
  return fn
}

let current: CardSettings = defaultCardSettings
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

export const getCardSettings = () => current
export function setCardSettings(next: CardSettings) { current = next; emit() }
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export const useCardSettings = () => useSyncExternalStore(subscribe, getCardSettings, () => defaultCardSettings)

const isBezier = (v: unknown): v is Bezier => Array.isArray(v) && v.length === 4 && v.every(n => typeof n === "number" && Number.isFinite(n))
const num = (v: unknown, fallback: number, min: number, max: number) => typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback

/** Restore the saved preset, if any. Called once on the client. */
export function loadCardSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const saved = JSON.parse(raw) as Partial<Record<keyof CardSettings, unknown>>
    const d = defaultCardSettings
    setCardSettings({
      holdMs: num(saved.holdMs, d.holdMs, 100, 5000),
      peekPct: num(saved.peekPct, d.peekPct, 1, 99),
      creepEase: isBezier(saved.creepEase) ? saved.creepEase : d.creepEase,
      finishMs: num(saved.finishMs, d.finishMs, 20, 3000),
      finishEase: isBezier(saved.finishEase) ? saved.finishEase : d.finishEase,
    })
  } catch { /* keep defaults */ }
}

export function saveCardSettings(): boolean {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); return true } catch { return false }
}
