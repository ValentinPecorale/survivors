"use client"

import { useSyncExternalStore } from "react"

/**
 * Live numbers for the About "Websites" frame: the interactive mesh gradient behind the word, and the inner
 * shadow on the word itself. Edited in the properties panel (Gradient tab), read by highlight-gradient.tsx.
 * Not React state: the panel (hero tree) and the section card (navbar tree) are different trees.
 *
 * Gradient values come from the chrome-gradient exploration (its defaults, ranges and shader).
 */
export const defaultGradientSettings = {
  // Palette: the four points of the mesh. `highlight` is the one that follows the cursor.
  highlight: "#eef6fd", shadow: "#000101", slate: "#58646a", base: "#1a242d",
  // Movement & light
  paused: false,
  speed: 1,        // drift speed multiplier
  smoothing: 600,  // ms the highlight takes to catch up with the cursor
  size: 100,       // % influence of the cursor point
  intensity: 100,  // % weight of the cursor point
  warp: 0.3,       // domain warp of the whole field
  softness: 0.7,   // how far colours blend into each other
  // Typewriter (About frame): every step of scroll is one keypress
  typeSensitivity: 80, // px of scroll per keypress
  typeBeat: 2,         // empty steps between deleting a word and typing the next
  typeHold: 8,         // steps a finished word stays on screen before it is deleted: time to read it
  typeWords: "",       // one word or phrase per line; empty = the words from the About content (Keystatic)
  typeReversible: true, // scrolling back undoes keypresses (off: once typed, it stays)
  typeSize: 39,        // px
  typeWeight: 600,
  typeTracking: 0,     // em × 100
  typeCase: "none" as "none" | "uppercase" | "lowercase",
  typeColor: "#8e8e8e",
  typeBg: "#0a0a0a",
  typeHud: false,      // small step counter in the corner, for tuning
  // Inner shadow on the word (SVG filter: inverted alpha, offset, blurred, clipped to the glyphs)
  shadowEnabled: true,
  shadowColor: "#000000",
  shadowOpacity: 0.55,
  shadowX: 0,
  shadowY: 2,
  shadowBlur: 1.5,
}
export type GradientSettings = typeof defaultGradientSettings

const STORAGE_KEY = "survivors:gradient-settings:v1"

let current: GradientSettings = defaultGradientSettings
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

export const getGradientSettings = () => current
export function setGradientSettings(next: GradientSettings) { current = next; emit() }
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export const useGradientSettings = () => useSyncExternalStore(subscribe, getGradientSettings, () => defaultGradientSettings)

const num = (v: unknown, fallback: number, min: number, max: number) => typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback
const hex = (v: unknown, fallback: string) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback

/** Restore the saved preset, if any. Called once on the client. */
export function loadGradientSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const s = JSON.parse(raw) as Partial<Record<keyof GradientSettings, unknown>>
    const d = defaultGradientSettings
    setGradientSettings({
      highlight: hex(s.highlight, d.highlight), shadow: hex(s.shadow, d.shadow), slate: hex(s.slate, d.slate), base: hex(s.base, d.base),
      paused: typeof s.paused === "boolean" ? s.paused : d.paused,
      speed: num(s.speed, d.speed, 0.25, 3),
      smoothing: num(s.smoothing, d.smoothing, 0, 1200),
      size: num(s.size, d.size, 30, 160),
      intensity: num(s.intensity, d.intensity, 0, 100),
      warp: num(s.warp, d.warp, 0, 1),
      softness: num(s.softness, d.softness, 0, 1),
      typeSensitivity: num(s.typeSensitivity, d.typeSensitivity, 20, 200),
      typeBeat: Math.round(num(s.typeBeat, d.typeBeat, 0, 12)),
      typeHold: Math.round(num(s.typeHold, d.typeHold, 0, 40)),
      typeWords: typeof s.typeWords === "string" ? s.typeWords.slice(0, 600) : d.typeWords,
      typeReversible: typeof s.typeReversible === "boolean" ? s.typeReversible : d.typeReversible,
      typeSize: num(s.typeSize, d.typeSize, 16, 120),
      typeWeight: num(s.typeWeight, d.typeWeight, 100, 900),
      typeTracking: num(s.typeTracking, d.typeTracking, -10, 10),
      typeCase: s.typeCase === "uppercase" || s.typeCase === "lowercase" ? s.typeCase : "none",
      typeColor: hex(s.typeColor, d.typeColor),
      typeBg: hex(s.typeBg, d.typeBg),
      typeHud: typeof s.typeHud === "boolean" ? s.typeHud : d.typeHud,
      shadowEnabled: typeof s.shadowEnabled === "boolean" ? s.shadowEnabled : d.shadowEnabled,
      shadowColor: hex(s.shadowColor, d.shadowColor),
      shadowOpacity: num(s.shadowOpacity, d.shadowOpacity, 0, 1),
      shadowX: num(s.shadowX, d.shadowX, -10, 10),
      shadowY: num(s.shadowY, d.shadowY, -10, 10),
      shadowBlur: num(s.shadowBlur, d.shadowBlur, 0, 10),
    })
  } catch { /* keep defaults */ }
}

export function saveGradientSettings(): boolean {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); return true } catch { return false }
}
