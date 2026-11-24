"use client"

import dynamic from "next/dynamic"
import Image from "next/image"
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react"
import { useGradientSettings } from "./gradient-settings"
import RevealText from "./reveal-text"
import type { SkullBridge } from "./skull-canvas"

// Three.js and the GLB are only fetched when this frame is within a screen of the viewport.
const SkullCanvas = dynamic(() => import("./skull-canvas").then(m => m.SkullCanvas), { ssr: false })

const webglAvailable = () => {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")) } catch { return false }
}

/** Chrome skull with continuous rotation and scroll acceleration. */
export function SkullFrame({ id, clients }: { id: string; clients: readonly string[] }) {
  const g = useGradientSettings()
  const track = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLElement>(null)
  const bridge = useRef<SkullBridge>({ angle: 0, direction: 1, velocity: 0, scrollTime: 0, active: false, invalidate: () => {} })
  const [mount, setMount] = useState(false)
  const [ready, setReady] = useState(false)
  const onReady = useCallback(() => setReady(true), [])

  // Keep motion outside React state; only the visible frame requests animation frames.
  useEffect(() => {
    const el = frame.current
    const scroller = el?.closest<HTMLElement>(".site-card")
    if (!el || !scroller) return
    const shared = bridge.current
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    let visible = false
    let lastTop = scroller.scrollTop
    let lastTime = performance.now()
    const sync = () => {
      shared.active = visible && !document.hidden && !reduced.matches
      shared.velocity = 0
      lastTop = scroller.scrollTop
      lastTime = performance.now()
      shared.invalidate()
    }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync() })
    observer.observe(el)
    const scroll = () => {
      const now = performance.now()
      if (shared.active) {
        const distance = scroller.scrollTop - lastTop
        if (distance !== 0) shared.direction = distance > 0 ? 1 : -1
        shared.velocity = Math.min(3000, Math.abs(distance) / Math.max(16, now - lastTime) * 1000)
        shared.scrollTime = now
        shared.invalidate()
      }
      lastTop = scroller.scrollTop
      lastTime = now
    }
    scroller.addEventListener("scroll", scroll, { passive: true })
    document.addEventListener("visibilitychange", sync)
    reduced.addEventListener("change", sync)
    return () => {
      shared.active = false
      observer.disconnect()
      scroller.removeEventListener("scroll", scroll)
      document.removeEventListener("visibilitychange", sync)
      reduced.removeEventListener("change", sync)
    }
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
      <section id="clients" ref={frame} className="skull-frame" aria-label={`${id} clients`}
        style={{ background: g.listBg, "--list-size": `${g.listSize}px`, "--list-color": g.listColor, "--list-hover": g.listHover, "--list-line": g.listLine, "--list-fade": `${g.listFade}ms` } as CSSProperties}>
        <ul className="client-list">
          {clients.map(name => <li key={name}><RevealText as="span" text={name} trigger="inView" /></li>)}
        </ul>
        <div className="skull-stage" data-ready={ready} aria-hidden="true">
          <Image src="/images/skull-poster.webp" alt="" fill sizes="329px" priority={false} />
          {mount && <SkullCanvas settings={g} bridge={bridge} onReady={onReady} />}
        </div>
      </section>
    </div>
  )
}
