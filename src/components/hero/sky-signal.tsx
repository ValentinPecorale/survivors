"use client"

import { useEffect, useId, useRef } from "react"
import { skyLook } from "./sky-look"

/**
 * The signal: a disc of light on the clouds with an "S" cut out of it, visible only while the camera looks up (skyLook.progress).
 * A crisp overlay above the ASCII scene (a flat shape: no 3D, no extra render pass). The disc is a circle seen at an angle, so it is an
 * ellipse (2:1) and the letter is squashed with it. It rises from below the frame as the camera tilts, like a sky object passing into view.
 *
 * Motion is written straight to the element every frame from skyLook.progress (no React renders), only when the value moved.
 */
const RISE_FROM_VH = 58     // % of the screen below centre where the disc starts, out of frame
const RISE_TO_VH = -6       // % of the screen where it rests when the camera is fully up (just above centre)
const FADE_START = 0.25     // progress where it begins to appear
const FADE_END = 0.8        // progress where it is fully lit

const smooth = (a: number, b: number, v: number) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t) }

export function SkySignal() {
  const box = useRef<HTMLDivElement>(null)
  const id = useId().replace(/:/g, "")

  useEffect(() => {
    const el = box.current
    if (!el) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let raf = 0, shown = -1
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const p = skyLook.progress
      if (p === shown) return
      shown = p
      const lit = smooth(FADE_START, FADE_END, p)
      el.style.opacity = String(lit)
      el.style.visibility = lit > 0.002 ? "visible" : "hidden"
      const rise = reduced ? RISE_TO_VH : RISE_FROM_VH + (RISE_TO_VH - RISE_FROM_VH) * smooth(0, 1, p)
      el.style.transform = `translate3d(-50%, calc(-50% + ${rise}vh), 0)`
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div ref={box} className="sky-signal" aria-hidden="true" style={{ opacity: 0, visibility: "hidden" }}>
      <svg viewBox="0 0 1000 560" width="100%" focusable="false">
        <defs>
          <radialGradient id={`${id}-disc`} cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.97" />
            <stop offset="0.7" stopColor="#e6f0f8" stopOpacity="0.9" />
            <stop offset="1" stopColor="#c9d8e4" stopOpacity="0.75" />
          </radialGradient>
          <radialGradient id={`${id}-haze`} cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#dbe9f5" stopOpacity="0.32" />
            <stop offset="1" stopColor="#dbe9f5" stopOpacity="0" />
          </radialGradient>
          {/* Soft edge: the light is thrown on cloud, it does not end on a line. */}
          <filter id={`${id}-soft`} x="-20%" y="-30%" width="140%" height="160%"><feGaussianBlur stdDeviation="9" /></filter>
          <mask id={`${id}-cut`} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="560">
            <rect width="1000" height="560" fill="#fff" />
            <text transform="translate(500 292) scale(1 0.5)" textAnchor="middle" dominantBaseline="central" fill="#000" fontSize="620" fontWeight="800"
              style={{ fontFamily: "var(--font-geist-sans), Arial, sans-serif" }}>S</text>
          </mask>
        </defs>
        <ellipse cx="500" cy="280" rx="500" ry="280" fill={`url(#${id}-haze)`} />
        <g mask={`url(#${id}-cut)`}>
          <ellipse cx="500" cy="280" rx="400" ry="200" fill={`url(#${id}-disc)`} filter={`url(#${id}-soft)`} />
        </g>
      </svg>
    </div>
  )
}
