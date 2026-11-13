"use client"

import dynamic from "next/dynamic"
import Image from "next/image"
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react"
import { useGradientSettings } from "./gradient-settings"
import type { SkullBridge } from "./skull-canvas"

// Three.js and the GLB are only fetched when this frame is within a screen of the viewport.
const SkullCanvas = dynamic(() => import("./skull-canvas").then(m => m.SkullCanvas), { ssr: false })

const webglAvailable = () => {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")) } catch { return false }
}

/**
 * Figma 8:261 — the client list with the chrome skull in the middle.
 *
 * The frame is pinned (sticky) for `skullScroll` vh of scrolling, and the skull turns `skullTurns` full turns over
 * that distance: scroll down to spin it round once, scroll up to spin it back. The end of this pinned stretch is
 * the end of the About section.
 *
 * Layering, back to front: regular names (grey) → skull → the name under the cursor. A hovered name turns white,
 * gets its full-width line, and comes in front of the skull; leaving puts it back behind. The skull canvas has
 * pointer-events: none, so the names under it stay hoverable.
 */
export function SkullFrame({ id, clients }: { id: string; clients: readonly string[] }) {
  const g = useGradientSettings()
  const track = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLElement>(null)
  const bridge = useRef<SkullBridge>({ angle: 0, invalidate: () => {} })
  const live = useRef({ scroll: g.skullScroll, turns: g.skullTurns })
  const apply = useRef<() => void>(() => {})
  const [mount, setMount] = useState(false)
  const [ready, setReady] = useState(false)
  const onReady = useCallback(() => setReady(true), [])

  // Scroll position → rotation. Native scrolling, no input captured.
  useEffect(() => { live.current = { scroll: g.skullScroll, turns: g.skullTurns }; apply.current() }, [g.skullScroll, g.skullTurns])
  useEffect(() => {
    const trackEl = track.current
    const scroller = trackEl?.closest<HTMLElement>(".site-card")
    if (!trackEl || !scroller) return
    const run = () => {
      const { scroll, turns } = live.current
      const progress = Math.min(1, Math.max(0, (scroller.scrollTop - trackEl.offsetTop) / Math.max(1, scroller.clientHeight * scroll / 100)))
      bridge.current.angle = progress * turns * Math.PI * 2
      bridge.current.invalidate()
    }
    apply.current = run
    run()
    scroller.addEventListener("scroll", run, { passive: true })
    window.addEventListener("resize", run)
    return () => { scroller.removeEventListener("scroll", run); window.removeEventListener("resize", run); apply.current = () => {} }
  }, [])

  // Mount the canvas (and fetch Three.js, the GLB and the HDR) once the frame is within one screen.
  useEffect(() => {
    const el = track.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      io.disconnect()
      if (webglAvailable()) setMount(true) // no WebGL: the poster stays
    }, { rootMargin: "100% 0px" })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={track} className="skull-track" style={{ height: `calc(100svh + ${g.skullScroll}svh)` }}>
      <section ref={frame} className="skull-frame" aria-label={`${id} clients`}
        style={{ background: g.listBg, "--list-size": `${g.listSize}px`, "--list-color": g.listColor, "--list-hover": g.listHover, "--list-line": g.listLine, "--list-fade": `${g.listFade}ms` } as CSSProperties}>
        <ul className="client-list">
          {clients.map(name => <li key={name}>{name}</li>)}
        </ul>
        <div className="skull-stage" data-ready={ready} aria-hidden="true">
          <Image src="/images/skull-poster.webp" alt="" fill sizes="329px" priority={false} />
          {mount && <SkullCanvas settings={g} bridge={bridge} onReady={onReady} />}
        </div>
      </section>
    </div>
  )
}
