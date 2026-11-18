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
  highlight: "#eef6fd", shadow: "#0a0a0a", slate: "#58646a", base: "#1a242d",
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
  typeSize: 47,        // px
  typeWeight: 700,
  typeTracking: 0,     // em × 100
  typeCase: "none" as "none" | "uppercase" | "lowercase",
  typeColor: "#8e8e8e",
  typeBg: "#0a0a0a",
  typeHud: false,      // small step counter in the corner, for tuning
  // Skull frame (Figma 8:261): continuous chrome rotation with scroll acceleration
  skullScroll: 0,           // vh of pinned scrolling; 0 = no pin, the frame scrolls straight past
  skullSpeed: 3,            // idle revolutions per minute; negative reverses
  skullBoost: 2,            // added revolutions per minute per 100px/s of scrolling
  skullDecay: 600,          // milliseconds for scroll boost to lose 95%
  skullSize: 90,            // % of the canvas height the skull fills
  skullColor: "#ffffff",    // same chrome defaults as the hero tiger
  skullRoughness: 0.04,
  skullMetalness: 1,
  skullLight: 1,            // studio light (environment intensity ×)
  skullStudioRotation: 0,   // degrees
  // Client list in the skull frame
  listSize: 55,             // px
  listColor: "#414141",     // regular state
  listHover: "#ffffff",     // hover state: also moves in front of the skull
  listLine: "#ffffff",      // full-width line behind a hovered name
  listFade: 160,            // ms
  listBg: "#0a0a0a",
  // Section lines (About): a 2px line with its own gradient running behind it. The line is white where the gradient is white.
  lineOpacity: 1,
  lineHighlight: "#eef6fd", lineShadow: "#0a0a0a", lineSlate: "#58646a", lineBase: "#1a242d", // palette; the highlight is the white point the cursor moves
  linePaused: false,
  lineSpeed: 1,             // drift speed multiplier
  lineDelay: 150,           // ms the white point takes to catch up with the cursor; 0 = glued
  lineRadius: 240,          // px: size of the white point
  lineIntensity: 100,       // % weight of the white point
  lineWarp: 0.3,            // domain warp of the field
  lineFeather: 160,         // softness of the blend (0–230)
  lineCutoff: 0.45,         // how white the gradient must be for the line to show (higher = only the whitest parts)
  footerBg: "#0a0a0a",
  footerShapeColor: "#ffffff",
  footerDepth: 0.16,
  footerBevel: 0.02,
  footerRoughness: 0.31,
  footerHorizontal: 20,
  footerVertical: 20,
  footerSettling: 900,
  footerIdle: 0,
  footerKey: 2.2,
  footerLightVersion: 1,
  footerAzimuth: 0,
  footerElevation: 0,
  footerFill: 0.7,
  footerAmbient: 0.5,
  footerReflections: 0.15,
  footerZoom: 100,
  footerFov: 32,
  footerOffsetX: 0,
  footerOffsetY: 0,
  footerMotion: true, footerInvert: false,
  footerFinish: "metal" as "metal" | "matte" | "satin" | "glossy",
  footerProjection: "orthographic" as "orthographic" | "perspective",
  footerKeyColor: "#ffffff", footerFillColor: "#ffffff",
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
      lineOpacity: num(s.lineOpacity, d.lineOpacity, 0, 1),
      lineHighlight: hex(s.lineHighlight, d.lineHighlight), lineShadow: hex(s.lineShadow, d.lineShadow), lineSlate: hex(s.lineSlate, d.lineSlate), lineBase: hex(s.lineBase, d.lineBase),
      linePaused: typeof s.linePaused === "boolean" ? s.linePaused : d.linePaused,
      lineSpeed: num(s.lineSpeed, d.lineSpeed, 0.25, 3),
      lineDelay: num(s.lineDelay, d.lineDelay, 0, 1200),
      lineRadius: num(s.lineRadius, d.lineRadius, 40, 800),
      lineIntensity: num(s.lineIntensity, d.lineIntensity, 0, 100),
      lineWarp: num(s.lineWarp, d.lineWarp, 0, 1),
      lineFeather: num(s.lineFeather, d.lineFeather, 0, 230),
      lineCutoff: num(s.lineCutoff, d.lineCutoff, 0, 0.9),
      typeHud: typeof s.typeHud === "boolean" ? s.typeHud : d.typeHud,
      skullScroll: s.skullScroll === 200 ? d.skullScroll : num(s.skullScroll, d.skullScroll, 0, 600), // 200 was the old default: saved presets that never changed it move to the new no-pin default
      skullSpeed: num(s.skullSpeed, d.skullSpeed, -12, 12),
      skullBoost: num(s.skullBoost, d.skullBoost, 0, 10),
      skullDecay: num(s.skullDecay, d.skullDecay, 100, 2000),
      skullSize: num(s.skullSize, d.skullSize, 40, 130),
      skullColor: hex(s.skullColor, d.skullColor),
      skullRoughness: num(s.skullRoughness, d.skullRoughness, 0, 1),
      skullMetalness: num(s.skullMetalness, d.skullMetalness, 0, 1),
      skullLight: num(s.skullLight, d.skullLight, 0, 3),
      skullStudioRotation: num(s.skullStudioRotation, d.skullStudioRotation, -180, 180),
      listSize: num(s.listSize, d.listSize, 20, 120),
      listColor: hex(s.listColor, d.listColor),
      listHover: hex(s.listHover, d.listHover),
      listLine: s.listLine === "#414141" ? d.listLine : hex(s.listLine, d.listLine),
      listFade: num(s.listFade, d.listFade, 0, 1000),
      listBg: hex(s.listBg, d.listBg),
      footerBg: hex(s.footerBg, d.footerBg),
      footerShapeColor: hex(s.footerShapeColor, d.footerShapeColor),
      footerDepth: num(s.footerDepth, d.footerDepth, 0.01, 0.6),
      footerBevel: num(s.footerBevel, d.footerBevel, 0, 0.05),
      footerRoughness: num(s.footerRoughness, d.footerRoughness, 0, 1),
      footerHorizontal: num(s.footerHorizontal, d.footerHorizontal, 0, 45),
      footerVertical: num(s.footerVertical, d.footerVertical, 0, 45),
      footerSettling: num(s.footerSettling, d.footerSettling, 0, 2000),
      footerIdle: num(s.footerIdle, d.footerIdle, -45, 45),
      footerKey: num(s.footerKey, d.footerKey, 0, 6),
      footerLightVersion: d.footerLightVersion,
      footerAzimuth: s.footerLightVersion === d.footerLightVersion ? num(s.footerAzimuth, d.footerAzimuth, -180, 180) : d.footerAzimuth,
      footerElevation: s.footerLightVersion === d.footerLightVersion ? num(s.footerElevation, d.footerElevation, -90, 90) : d.footerElevation,
      footerFill: num(s.footerFill, d.footerFill, 0, 3),
      footerAmbient: num(s.footerAmbient, d.footerAmbient, 0, 3),
      footerReflections: num(s.footerReflections, d.footerReflections, 0, 2),
      footerZoom: num(s.footerZoom, d.footerZoom, 25, 150),
      footerFov: num(s.footerFov, d.footerFov, 15, 75),
      footerOffsetX: num(s.footerOffsetX, d.footerOffsetX, -50, 50),
      footerOffsetY: num(s.footerOffsetY, d.footerOffsetY, -50, 50),
      footerMotion: typeof s.footerMotion === "boolean" ? s.footerMotion : d.footerMotion,
      footerInvert: typeof s.footerInvert === "boolean" ? s.footerInvert : d.footerInvert,
      footerFinish: s.footerFinish === "matte" || s.footerFinish === "satin" || s.footerFinish === "glossy" ? s.footerFinish : "metal",
      footerProjection: s.footerProjection === "perspective" ? "perspective" : "orthographic",
      footerKeyColor: hex(s.footerKeyColor, d.footerKeyColor), footerFillColor: hex(s.footerFillColor, d.footerFillColor),
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
