"use client"

/**
 * Shared runtime for the ASCII video compositions (chrome, eagle, orca). It is the "cheap" engine from the playground's
 * newest export, used for all of them:
 *  - ShaderLabCanvasSource renders into one canvas. The layout size is the composition (960×540); the bitmap is that times a pixel
 *    ratio chosen from how big the canvas is actually shown (1× up to `maxPixelRatio`, 1.5 by default), so the glyphs are drawn
 *    sharp instead of a 960×540 picture stretched to 1400px. 1.5× costs about 2.25× the pixels of 1×.
 *  - capped at 30 fps by default (a composition can ask for another rate with `fps`; 12 gives a stop-motion look), and not drawn at all while the host is off screen (the videos are paused too)
 *  - phones, weak CPUs (≤ 4 cores), reduced-motion and browsers without WebGPU get two plain <video>s instead: no ASCII, no GPU work
 * Each composition keeps its own config and clips in its own file; this file holds everything they share.
 */

import { useEffect, useRef, useState } from "react"
import { ShaderLabCanvasSource, type ShaderLabConfig } from "@basementstudio/shader-lab"

const DEFAULT_FPS = 30

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
function Fallback({ sources }: { sources: readonly string[] }) {
  return (
    <>
      {sources.map((src, i) => <video key={src} src={src} autoPlay muted loop playsInline preload="metadata" style={i === 0 ? FILL : { ...FILL, mixBlendMode: "screen" }} />)}
    </>
  )
}

/**
 * @param config       the Shader Lab composition (composition size is the render size)
 * @param sources      the clip(s) the composition plays: one, or two to keep in sync (the first is the master clock)
 * @param fps          render rate cap (default 30). Lower values step the picture, e.g. 12 for stop-motion
 * @param maxPixelRatio  highest render scale relative to the composition size (default 1.5; 2 is sharper on retina but 1.8× the GPU work)
 * @param allowMobile  run the WebGPU effect on phones too (default: plain videos)
 */
export function AsciiVideoRuntime({ config, sources, className, fps = DEFAULT_FPS, maxPixelRatio = 1.5, allowMobile = false }: {
  config: ShaderLabConfig
  sources: readonly string[]
  className?: string
  fps?: number
  maxPixelRatio?: number
  allowMobile?: boolean
}) {
  const host = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<"pending" | "gpu" | "fallback">("pending")
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
        const tick = (now: number) => {
          if (cancelled) return
          raf = requestAnimationFrame(tick)
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
  }, [mode, config, sources, W, H, fps, maxPixelRatio])

  return (
    <div
      ref={host}
      className={className}
      style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", overflow: "hidden" }}
    >
      {mode === "fallback" && <Fallback sources={sources} />}
    </div>
  )
}
