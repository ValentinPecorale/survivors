"use client"

import dynamic from "next/dynamic"
import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"
import { useGradientSettings } from "./gradient-settings"
import type { SkullBridge } from "./skull-canvas"

// Three.js, the GLB and the HDR load only when a skull is within one screen of the viewport (the same chunk the About skull uses).
const SkullCanvas = dynamic(() => import("./skull-canvas").then(m => m.SkullCanvas), { ssr: false })

const webglAvailable = () => {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")) } catch { return false }
}

/**
 * One of the two rotating chrome skulls on the ends of the logo strip (Figma 145:1481, 122×142).
 * Same GLB, material and lens as the About skull, spinning at its idle speed (Cards panel → skullSpeed, 3 rpm). `direction` sets
 * the turn: the left skull turns one way and the right one the other, so the pair mirror each other.
 * Cost: a demand-rendered canvas that draws only while on screen. No WebGL (or reduced motion): the still poster stays.
 */
export function LogoSkull({ side, direction }: { side: "left" | "right"; direction: 1 | -1 }) {
  const g = useGradientSettings()
  const box = useRef<HTMLDivElement>(null)
  const bridge = useRef<SkullBridge>({ angle: 0, direction, velocity: 0, scrollTime: 0, active: false, invalidate: () => {} })
  const [mount, setMount] = useState(false)
  const [ready, setReady] = useState(false)
  const onReady = useCallback(() => setReady(true), [])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const shared = bridge.current
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    let visible = false
    const sync = () => { shared.active = visible && !document.hidden && !reduced.matches; shared.invalidate() }
    const near = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      near.disconnect()
      if (webglAvailable()) setMount(true)
    }, { rootMargin: "100% 0px" })
    const seen = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync() })
    near.observe(el); seen.observe(el)
    document.addEventListener("visibilitychange", sync)
    reduced.addEventListener("change", sync)
    return () => { shared.active = false; near.disconnect(); seen.disconnect(); document.removeEventListener("visibilitychange", sync); reduced.removeEventListener("change", sync) }
  }, [])

  return (
    <div ref={box} className={`logo-skull logo-skull-${side}`} data-ready={ready} aria-hidden="true">
      <Image src="/images/skull-poster.webp" alt="" fill sizes="122px" priority={false} />
      {mount && <SkullCanvas settings={g} bridge={bridge} onReady={onReady} />}
    </div>
  )
}
