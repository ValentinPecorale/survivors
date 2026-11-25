"use client"

import { useSyncExternalStore } from "react"

/**
 * Live numbers for the About "Websites" frame: the interactive mesh gradient behind the word, and the inner
 * shadow on the word itself. Edited in the properties panel (Gradient tab), read by highlight-gradient.tsx.
 * Not React state: the panel (hero tree) and the section card (navbar tree) are different trees.
 *
 * Gradient values come from the chrome-gradient exploration (its defaults, ranges and shader).
 */
/**
 * The three chrome icons in the footer (footer-models.tsx), edited in the properties panel (Footer tab).
 * "fm" = footer models. Yaw and pitch are degrees; scale is % of the icon's box (Figma: 14.7×16.7 each).
 */
export const defaultFooterModels = {
  fmFollow: true,       // turn towards the cursor
  fmYaw: 55,            // ° the most a model turns sideways
  fmPitch: 30,          // ° the most it tilts up / down
  fmReach: 360,         // px from an icon at which it is turned all the way
  fmEase: 90,           // ms time constant of the ease (0 = snaps)
  fmGap: 4,             // px between the icons
  fmColor: "#ffffff", fmRoughness: 0.04, fmMetalness: 1,
  fmLight: 1,           // studio reflections (× the normalised HDR)
  fmStudioRotation: 0,  // ° the studio turns round the model
  fmKey: 1,             // white key light intensity
  fmJawsScale: 100, fmJawsYaw: 0, fmJawsPitch: 0,
  fmEagleScale: 100, fmEagleYaw: 0, fmEaglePitch: 0,
  fmTigerScale: 100, fmTigerYaw: 0, fmTigerPitch: 0,
}

/**
 * The footer itself (site-footer.tsx), edited in the properties panel (Footer tab). "ft" = footer. Sizes are px unless the label says otherwise.
 * Rows are counted in DOTS of the grid, so changing them keeps every text on a dot row.
 */
export const defaultFooterLayout = {
  ftDots: true, ftDotsColor: "#8e8e8e", ftDotsOpacity: 0.45, ftDotsSize: 1.3,
  ftKnock: 8,           // px of clear space between a text (or icon) and the dots
  ftRows: 3,            // dot rows per button / text row (page links, socials, place, copyright)
  ftCtaRows: 5,         // dot rows of the call to action ("Send a flare", 47/45 bold): the columns are this + 6 × ftRows + the spacer
  ftCtaSize: 47, ftCtaLine: 45, // the call to action type (Figma: Geist Bold 47 / 45)
  ftSpacer: 1,          // dot rows between the call to action and the links
  ftIconGap: 12,        // px between the three icons and "Call a survivor"
  ftTextSize: 47, ftTextLine: 45,
  ftLinkSize: 15, ftLinkTrack: 0.3, // buttons and links; tracking in em (Figma 4.5px)
  ftSmallSize: 15,      // socials, place, copyright
  ftPad: 32,            // px above and below the content (Figma: 32 all round)
  ftVerticalGap: 6.5,   // px between footer rows, independent of the dot grid
  ftGap: 20,            // px between the left half (sentence + place) and the dots grid (right), Figma 20
  ftBg: "#0a0a0a", ftTextColor: "#8e8e8e", ftSmallColor: "#8e8e8e",
  ftCtaColor: "#ffffff", // the call to action ("Send a flare"): white
  ftLinkColor: "#8e8e8e", ftHoverColor: "#ffffff", // the page links in the bottom left: grey; the socials turn white on hover
  ftStateBg: "#ffffff", ftStateText: "#0a0a0a",    // the navbar states on the buttons at the left (hover, press, focus, current page): white box, black text
}

export const defaultGradientSettings = {
  ...defaultFooterLayout,
  ...defaultFooterModels,
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
  typeSensitivity: 35, // px of scroll per keypress
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
  // About videos: extra scroll with the frame still pinned once the third video is fully in
  whoHold: 70,         // svh (screens × 100): one more video's worth
  // Video badges: how the label appears (the same random reveal as the long texts; letters, since a badge is one word)
  badgeDuration: 440,  // ms from the first step to the last
  badgeSteps: 10,      // discrete frames the reveal snaps to (1 = all at once)
  badgeSkew: 1,        // >1: most land early · <1: most land late
  badgeSeed: 7,        // same seed = same order
  badgeUnit: "char" as "char" | "word",
  footerProjection: "orthographic" as "orthographic" | "perspective",
  footerKeyColor: "#ffffff", footerFillColor: "#ffffff",
  // Featured projects: the ASCII dot grid over the regular cards (the effect's "." field, rebuilt as a tile; see featured-projects.tsx)
  dotsEnabled: false,  // hidden for now: switch on in the panel (About → Featured cards · ASCII dots)
  dotsColor: "#d90d0d",
  dotsOpacity: 0.45,   // ink per dot (0–1)
  dotsColumns: 161,    // columns across one card (the video slots use 155 across ~917px: 5.9px cells; a 678px card at 115 columns is the same cell)
  dotsRatio: 2.07,     // cell height ÷ cell width: the glyph aspect of the effect (12.25 ÷ 5.918)
  dotsSize: 1.5,       // px: the dot, the one size for every dot grid on the site (cards, separators, strip, footer, searchlight)
  // Featured cards, hover: how the dots behind the title appear (random reveal, same family as the text reveal)
  stripOpacity: 0.5,  // ink per dot (0–1)
  stripSize: 1.3,      // px: the dot
  stripColor: "#8E8E8E", // the dots behind the title AND the dotted separators in the metadata
  stripDuration: 700,  // ms from the first step to the last
  stripSteps: 15,      // discrete frames the reveal snaps to (1 = all at once)
  stripSkew: 1,        // >1: most dots land early · <1: most land late
  stripSeed: 4231,     // same seed = same pattern
  // Inner shadow on the word (SVG filter: inverted alpha, offset, blurred, clipped to the glyphs)
  shadowEnabled: true,
  shadowColor: "#000000",
  shadowOpacity: 0.55,
  shadowX: 0,
  shadowY: 2,
  shadowBlur: 1.5,
}
export type GradientSettings = typeof defaultGradientSettings

const STORAGE_KEY = "survivors:gradient-settings:v2"

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
      whoHold: num(s.whoHold, d.whoHold, 0, 400),
      badgeDuration: num(s.badgeDuration, d.badgeDuration, 0, 3000),
      badgeSteps: Math.round(num(s.badgeSteps, d.badgeSteps, 1, 60)),
      badgeSkew: num(s.badgeSkew, d.badgeSkew, 0.2, 4),
      badgeSeed: Math.round(num(s.badgeSeed, d.badgeSeed, 0, 9999)),
      badgeUnit: s.badgeUnit === "word" ? "word" : "char",
      footerFinish: s.footerFinish === "matte" || s.footerFinish === "satin" || s.footerFinish === "glossy" ? s.footerFinish : "metal",
      footerProjection: s.footerProjection === "perspective" ? "perspective" : "orthographic",
      footerKeyColor: hex(s.footerKeyColor, d.footerKeyColor), footerFillColor: hex(s.footerFillColor, d.footerFillColor),
      dotsEnabled: typeof s.dotsEnabled === "boolean" ? s.dotsEnabled : d.dotsEnabled,
      dotsColor: hex(s.dotsColor, d.dotsColor),
      dotsOpacity: num(s.dotsOpacity, d.dotsOpacity, 0, 1),
      dotsColumns: Math.round(num(s.dotsColumns, d.dotsColumns, 20, 400)),
      dotsRatio: num(s.dotsRatio, d.dotsRatio, 0.5, 4),
      dotsSize: num(s.dotsSize, d.dotsSize, 0.5, 6),
      stripOpacity: num(s.stripOpacity, d.stripOpacity, 0, 1),
      stripSize: num(s.stripSize, d.stripSize, 0.5, 6),
      stripColor: hex(s.stripColor, d.stripColor),
      stripDuration: num(s.stripDuration, d.stripDuration, 0, 3000),
      stripSteps: Math.round(num(s.stripSteps, d.stripSteps, 1, 60)),
      stripSkew: num(s.stripSkew, d.stripSkew, 0.2, 4),
      stripSeed: Math.round(num(s.stripSeed, d.stripSeed, 0, 9999)),
      shadowEnabled: typeof s.shadowEnabled === "boolean" ? s.shadowEnabled : d.shadowEnabled,
      shadowColor: hex(s.shadowColor, d.shadowColor),
      shadowOpacity: num(s.shadowOpacity, d.shadowOpacity, 0, 1),
      shadowX: num(s.shadowX, d.shadowX, -10, 10),
      shadowY: num(s.shadowY, d.shadowY, -10, 10),
      shadowBlur: num(s.shadowBlur, d.shadowBlur, 0, 10),
      ftDots: typeof s.ftDots === "boolean" ? s.ftDots : d.ftDots,
      ftDotsColor: hex(s.ftDotsColor, d.ftDotsColor), ftDotsOpacity: num(s.ftDotsOpacity, d.ftDotsOpacity, 0, 1), ftDotsSize: num(s.ftDotsSize, d.ftDotsSize, 0.5, 6),
      ftKnock: num(s.ftKnock, d.ftKnock, 0, 32), ftRows: Math.round(num(s.ftRows, d.ftRows, 1, 6)), ftCtaRows: Math.round(num(s.ftCtaRows, d.ftCtaRows, 1, 10)), ftCtaSize: num(s.ftCtaSize, d.ftCtaSize, 16, 90), ftCtaLine: num(s.ftCtaLine, d.ftCtaLine, 16, 100), ftSpacer: Math.round(num(s.ftSpacer, d.ftSpacer, 0, 6)), ftIconGap: num(s.ftIconGap, d.ftIconGap, 0, 48),
      ftTextSize: num(s.ftTextSize, d.ftTextSize, 16, 90), ftTextLine: num(s.ftTextLine, d.ftTextLine, 16, 100),
      ftLinkSize: num(s.ftLinkSize, d.ftLinkSize, 10, 28), ftLinkTrack: num(s.ftLinkTrack, d.ftLinkTrack, 0, 0.8), ftSmallSize: num(s.ftSmallSize, d.ftSmallSize, 10, 24),
      ftVerticalGap: num(s.ftVerticalGap, d.ftVerticalGap, 0, 64), ftPad: num(s.ftPad, d.ftPad, 0, 160), ftGap: num(s.ftGap, d.ftGap, 0, 120),
      ftBg: hex(s.ftBg, d.ftBg), ftTextColor: hex(s.ftTextColor, d.ftTextColor),
      ftCtaColor: hex(s.ftCtaColor, d.ftCtaColor), ftStateBg: hex(s.ftStateBg, d.ftStateBg), ftStateText: hex(s.ftStateText, d.ftStateText), ftLinkColor: hex(s.ftLinkColor, d.ftLinkColor), ftHoverColor: hex(s.ftHoverColor, d.ftHoverColor), ftSmallColor: hex(s.ftSmallColor, d.ftSmallColor),
      fmFollow: typeof s.fmFollow === "boolean" ? s.fmFollow : d.fmFollow,
      fmYaw: num(s.fmYaw, d.fmYaw, 0, 90), fmPitch: num(s.fmPitch, d.fmPitch, 0, 60),
      fmReach: num(s.fmReach, d.fmReach, 100, 1200), fmEase: num(s.fmEase, d.fmEase, 0, 600), fmGap: num(s.fmGap, d.fmGap, 0, 24),
      fmColor: hex(s.fmColor, d.fmColor), fmRoughness: num(s.fmRoughness, d.fmRoughness, 0, 1), fmMetalness: num(s.fmMetalness, d.fmMetalness, 0, 1),
      fmLight: num(s.fmLight, d.fmLight, 0, 3), fmStudioRotation: num(s.fmStudioRotation, d.fmStudioRotation, -180, 180), fmKey: num(s.fmKey, d.fmKey, 0, 3),
      fmJawsScale: num(s.fmJawsScale, d.fmJawsScale, 40, 160), fmJawsYaw: num(s.fmJawsYaw, d.fmJawsYaw, -180, 180), fmJawsPitch: num(s.fmJawsPitch, d.fmJawsPitch, -90, 90),
      fmEagleScale: num(s.fmEagleScale, d.fmEagleScale, 40, 160), fmEagleYaw: num(s.fmEagleYaw, d.fmEagleYaw, -180, 180), fmEaglePitch: num(s.fmEaglePitch, d.fmEaglePitch, -90, 90),
      fmTigerScale: num(s.fmTigerScale, d.fmTigerScale, 40, 160), fmTigerYaw: num(s.fmTigerYaw, d.fmTigerYaw, -180, 180), fmTigerPitch: num(s.fmTigerPitch, d.fmTigerPitch, -90, 90),
    })
  } catch { /* keep defaults */ }
}

export function saveGradientSettings(): boolean {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); return true } catch { return false }
}
