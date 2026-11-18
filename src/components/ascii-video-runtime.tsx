"use client"

/**
 * Shared runtime for the ASCII video compositions (chrome, eagle, orca). It is the "cheap" engine from the playground's
 * newest export, used for all of them:
 *  - ShaderLabCanvasSource renders into one canvas. The layout size is the composition (960×540); the bitmap is that times a pixel
 *    ratio chosen from how big the canvas is actually shown (1× up to `maxPixelRatio`, 1.5 by default), so the glyphs are drawn
 *    sharp instead of a 960×540 picture stretched to 1400px. 1.5× at 12 fps costs about what 1× at 30 fps did.
 *  - capped at 12 fps by default (the stop-motion look; a composition can ask for another rate with `fps`), and not drawn at all while the host is off screen (the videos are paused too)
 *  - phones, weak CPUs (≤ 4 cores), reduced-motion and browsers without WebGPU get two plain <video>s instead: no ASCII, no GPU work
 * Each composition keeps its own config and clips in its own file; this file holds everything they share.
 */

import { useEffect, useRef, useState } from "react"
import { ShaderLabCanvasSource, type ShaderLabConfig } from "@basementstudio/shader-lab"
import { getGradientSettings } from "./gradient-settings"
import { HOVER_REGISTRY, type HoverUniforms } from "./ascii-hover-layer"

const DEFAULT_FPS = 12

// Shader Lab runs one private looping <video> per layer and never aligns them. Every <video> created while a composition is
// alive is recorded once, here; each instance picks its own by src, re-seeks the second whenever it drifts more than 0.05s
// from the first (the master clock), and can pause/resume them when off screen. The createElement patch is reference counted,
// so several compositions can be mounted at once and unmount in any order.
const created = new Set<HTMLVideoElement>()
let patches = 0
let originalCreate: typeof document.createElement | null = null
function acquire() {
  if (patches++ > 0) return
  originalCreate = document.createElement.bind(document)
  document.createElement = ((tag: string, o?: ElementCreationOptions) => {
    const el = originalCreate!(tag, o)
    if (typeof tag === "string" && tag.toLowerCase() === "video") created.add(el as HTMLVideoElement)
    return el
  }) as typeof document.createElement
}
function release() {
  if (--patches > 0 || !originalCreate) return
  document.createElement = originalCreate
  originalCreate = null
}

/** The <video> Shader Lab created for a clip, if it is alive. */
function findVideo(src: string) {
  const abs = new URL(src, location.href).href
  for (const v of created) { if (v.getAttribute("src") && v.src === abs) return v }
  return null
}

/**
 * What a mounted composition hands back to its slot: `glyphAt` answers "is an ASCII glyph drawn under this screen point?",
 * `setHover` tells it where the cursor is (null = left) so the local black/white point follows it.
 */
export type SlotApi = {
  glyphAt: (clientX: number, clientY: number) => boolean
  setHover: (clientX: number | null, clientY: number | null) => void
}
export type ProbeSetter = (api: SlotApi | null) => void

function startVideoSync(sources: readonly string[]) {
  acquire()
  const mine = () => {
    const out: HTMLVideoElement[] = []
    for (const src of sources) {
      const abs = new URL(src, location.href).href
      for (const v of created) {
        if (!v.getAttribute("src")) { created.delete(v); continue }
        if (v.src === abs) out.push(v)
      }
    }
    return out
  }
  let raf = 0
  let active = true
  const tick = () => {
    const [m, ...slaves] = mine()
    if (active && m && m.readyState >= 2 && !m.paused) {
      for (const s of slaves) {
        if (s.readyState < 1 || s.seeking || !s.duration) continue
        const dur = Math.min(m.duration, s.duration)
        let d = m.currentTime - s.currentTime
        if (Number.isFinite(dur)) { if (d > dur / 2) d -= dur; else if (d < -dur / 2) d += dur }
        if (Math.abs(d) > 0.05) s.currentTime = m.currentTime % s.duration
      }
    }
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return {
    setActive(on: boolean) {
      active = on
      for (const v of mine()) on ? void v.play().catch(() => {}) : v.pause()
    },
    stop() { cancelAnimationFrame(raf); release() },
  }
}

const FILL = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" } as const

// Cheap path: two plain <video>s. No ASCII, no GPU work.
function Fallback({ sources, cutoutRef }: { sources: readonly [string, string]; cutoutRef: { current: HTMLVideoElement | null } }) {
  return (
    <>
      <video src={sources[0]} autoPlay muted loop playsInline preload="metadata" style={FILL} />
      <video ref={cutoutRef} src={sources[1]} autoPlay muted loop playsInline preload="metadata" style={{ ...FILL, mixBlendMode: "screen" }} />
    </>
  )
}

/**
 * @param config       the Shader Lab composition (composition size is the render size)
 * @param sources      [with-background clip (master clock), black-background cutout clip]
 * @param fps          render rate cap (default 12, stop-motion). Higher values smooth the picture, e.g. 30
 * @param hoverId      key of this composition's glyph-hover shader uniforms (see ascii-hover-layer.ts)
 * @param onProbe      receives the slot API (null on unmount): glyphAt for the hover sound, setHover for the local black/white point
 * @param maxPixelRatio  highest render scale relative to the composition size (default 1.5; 2 is sharper on retina but 1.8× the GPU work)
 * @param allowMobile  run the WebGPU effect on phones too (default: plain videos)
 */
export function AsciiVideoRuntime({ config, sources, className, fps = DEFAULT_FPS, maxPixelRatio = 1.5, allowMobile = false, onProbe, hoverId }: {
  config: ShaderLabConfig
  sources: readonly [string, string]
  className?: string
  fps?: number
  maxPixelRatio?: number
  allowMobile?: boolean
  onProbe?: ProbeSetter
  hoverId?: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<"pending" | "gpu" | "fallback">("pending")
  const fallbackCutout = useRef<HTMLVideoElement | null>(null)
  // Cursor for the local black/white point: composition uv (origin bottom-left), the css→composition px scale, and the target strength.
  const hover = useRef({ x: 0.5, y: 0.5, scale: 1, target: 0 })
  const W = config.composition?.width ?? 960
  const H = config.composition?.height ?? 540

  useEffect(() => {
    const weak =
      !("gpu" in navigator) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      (!allowMobile &&
        (window.matchMedia("(max-width: 768px)").matches ||
          (navigator.hardwareConcurrency ?? 8) <= 4))
    setMode(weak ? "fallback" : "gpu")
  }, [allowMobile])

  useEffect(() => {
    const el = host.current
    if (mode !== "gpu" || !el) return

    // Render scale from the size the canvas is shown at (its largest, which is when it mounts), in quarter steps, between 1 and the cap.
    const shown = el.getBoundingClientRect().width * Math.min(window.devicePixelRatio || 1, 2)
    const pixelRatio = Math.min(maxPixelRatio, Math.max(1, Math.round(shown / W * 4) / 4))
    const source = new ShaderLabCanvasSource(config, { width: W, height: H, pixelRatio })
    const canvas = source.element
    canvas.style.cssText = "display:block;width:100%;height:100%"
    el.appendChild(canvas)
    const sync = startVideoSync(sources)

    let cancelled = false
    let raf = 0
    let last = 0
    let visible = false
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting
        sync.setActive(visible)
      },
      { rootMargin: "120px" }
    )
    io.observe(el)

    source
      .initialize()
      .then(() => {
        if (cancelled) return
        let lastU = 0, strength = 0
        const uniforms = () => (hoverId ? (globalThis as unknown as Record<string, Record<string, HoverUniforms> | undefined>)[HOVER_REGISTRY]?.[hoverId] : undefined)
        const tick = (now: number) => {
          if (cancelled) return
          raf = requestAnimationFrame(tick)
          // Every frame, cheap: ease the hover strength and push the panel's levels into the shader uniforms (no recompile).
          const u = visible ? uniforms() : undefined
          if (u) {
            const g = getGradientSettings(), h = hover.current
            const k = lastU ? 1 - Math.exp(-(now - lastU) / 90) : 1
            lastU = now
            strength += ((g.glyphHoverOn ? h.target : 0) - strength) * k
            u.strength.value = strength
            u.center.value.set(h.x, h.y)
            u.levels.value.set(g.glyphHoverBlack, g.glyphHoverWhite, g.glyphHoverRadius * h.scale, g.glyphHoverFeather * h.scale)
          }
          if (!visible || now - last < 1000 / fps - 2) return
          const dt = (now - last) / 1000
          last = now
          source.update(now / 1000, dt)
        }
        raf = requestAnimationFrame(tick)
      })
      .catch(() => !cancelled && setMode("fallback"))

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      io.disconnect()
      sync.stop()
      source.dispose()
      canvas.remove()
    }
  }, [mode, config, sources, W, H, fps, maxPixelRatio, hoverId])

  // Glyph probe. A glyph is drawn wherever the black-background clip is bright (the ASCII layer is built from it), so instead
  // of reading pixels back from the WebGL canvas (which stalls the GPU) this samples one ASCII cell's worth of that clip into
  // a hidden 8×8 canvas: well under a millisecond, and only when asked (while the pointer moves).
  useEffect(() => {
    if (!onProbe) return
    const el = host.current
    if (!el) return
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 8
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    const ascii = config.layers.find(l => l.type === "ascii")?.params as { columns?: number; signalBlackPoint?: number; signalWhitePoint?: number } | undefined
    const columns = ascii?.columns ?? 80
    const black = ascii?.signalBlackPoint ?? 0, white = ascii?.signalWhitePoint ?? 1
    // The first character of the ramp is a blank: a glyph shows once the normalised signal passes 1/10 of the way to the white point.
    // Floor at 0.03 so compression noise in the black background never counts.
    const threshold = Math.max(0.03, black + 0.1 * (white - black))
    const glyphAt = (x: number, y: number) => {
      const video = mode === "gpu" ? findVideo(sources[1]) : fallbackCutout.current
      if (!ctx || !video || video.readyState < 2 || !video.videoWidth) return false
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) return false
      const u = x - r.left, v = y - r.top
      if (u < 0 || v < 0 || u > r.width || v > r.height) return false
      // "cover" fit of the clip into the 16:9 box: one uniform scale, centred, cropped on the long side.
      const scale = Math.max(r.width / video.videoWidth, r.height / video.videoHeight)
      const vx = (u - r.width / 2) / scale + video.videoWidth / 2
      const vy = (v - r.height / 2) / scale + video.videoHeight / 2
      const cell = r.width / columns / scale // one ASCII cell, in clip pixels
      try {
        ctx.drawImage(video, vx - cell / 2, vy - cell / 2, cell, cell, 0, 0, 8, 8)
        const d = ctx.getImageData(0, 0, 8, 8).data
        let sum = 0
        for (let i = 0; i < d.length; i += 4) sum += (d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722) / 255
        return sum / 64 >= threshold
      } catch { return false }
    }
    const setHover = (x: number | null, y: number | null) => {
      const h = hover.current
      if (x === null || y === null) { h.target = 0; return }
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) return
      h.x = (x - r.left) / r.width
      h.y = 1 - (y - r.top) / r.height // uv origin is bottom-left
      h.scale = W / r.width // css px → composition px
      h.target = 1
    }
    onProbe({ glyphAt, setHover })
    return () => onProbe(null)
  }, [mode, config, sources, onProbe])

  return (
    <div
      ref={host}
      className={className}
      style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", overflow: "hidden" }}
    >
      {mode === "fallback" && <Fallback sources={sources} cutoutRef={fallbackCutout} />}
    </div>
  )
}
