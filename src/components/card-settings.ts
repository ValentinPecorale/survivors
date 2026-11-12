"use client"

import { useSyncExternalStore } from "react"
import { cubicBezier } from "./bezier"

export type Bezier = [number, number, number, number]

/**
 * Tunable numbers for the card open/close transitions (nav button and letter
 * shortcut share the same open). Read live by card-engine.ts,
 * edited in the properties panel (Cards tab). Not React state: the navbar,
 * the engine and the panel live in different trees.
 */
export const defaultCardSettings = {
  /**
   * Scroll camera: scrolling down from the hero first blends the camera from the
   * Camera tab settings to these (linear with scroll), then the first card enters.
   */
  camFocal: 37,
  camOrbit: 0,
  camElevation: 60,
  camShiftX: 0,
  camShiftY: 0,
  /** Cursor orbit (degrees, Camera tab: Horizontal / Vertical orbit) once the scroll camera has arrived. 0 = the view holds still. */
  camCursorHorizontal: 0,
  camCursorVertical: 0,
  /** Open by nav button: time for the card to slide from off-screen to fully in. */
  openMs: 1500,
  /** Easing of the open slide. Default is quartic ease-in: accelerates and stops sharply. */
  openEase: [0.5, 0, 0.75, 0] as Bezier,
  /** Wait between the trigger (button or letter key) and the slide starting. */
  openDelayMs: 0,
  /** The nav unlocks this long before the open slide ends, so the next press can start as it lands. */
  unlockMs: 100,
  /** Close (button, Esc, wordmark): time for a fully open card to slide out. Half-open cards take proportionally less. */
  closeMs: 1500,
  /** Delay between one card leaving and the next one under it starting to leave. */
  closeStaggerMs: 70,
  /** Easing of the close slide. Default is the same quartic ease-in as the open slide. */
  closeEase: [0.5, 0, 0.75, 0] as Bezier,
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

/**
 * Scroll camera progress, 0 (Camera tab settings) to 1 (scroll camera target).
 * Written by card-engine.ts every frame, read by hero-scene.tsx every frame.
 * A plain mutable object on purpose: no React re-render per frame.
 */
export const scrollCamera = { progress: 0 }

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
      camFocal: num(saved.camFocal, d.camFocal, 15, 120),
      camOrbit: num(saved.camOrbit, d.camOrbit, -180, 180),
      camElevation: num(saved.camElevation, d.camElevation, -60, 60),
      camShiftX: num(saved.camShiftX, d.camShiftX, -1, 1),
      camShiftY: num(saved.camShiftY, d.camShiftY, -1, 1),
      camCursorHorizontal: num(saved.camCursorHorizontal, d.camCursorHorizontal, 0, 30),
      camCursorVertical: num(saved.camCursorVertical, d.camCursorVertical, 0, 30),
      openMs: num(saved.openMs, d.openMs, 100, 5000),
      openEase: isBezier(saved.openEase) ? saved.openEase : d.openEase,
      openDelayMs: num(saved.openDelayMs, d.openDelayMs, 0, 1000),
      unlockMs: num(saved.unlockMs, d.unlockMs, 0, 1000),
      closeMs: num(saved.closeMs, d.closeMs, 100, 5000),
      closeStaggerMs: num(saved.closeStaggerMs, d.closeStaggerMs, 0, 1000),
      closeEase: isBezier(saved.closeEase) ? saved.closeEase : d.closeEase,
    })
  } catch { /* keep defaults */ }
}

export function saveCardSettings(): boolean {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); return true } catch { return false }
}
