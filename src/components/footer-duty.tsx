"use client"

import Image from "next/image"
import { useEffect, useId, useRef, useState } from "react"
import { MeshGradient } from "./highlight-gradient"
import { useGradientSettings } from "./gradient-settings"

/** Figma 290:966: fluid 1528×150 composition, static on mobile and reduced motion. */
export function FooterDuty() {
  const surface = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const idle = useRef(false)
  const settings = useGradientSettings()
  const uid = useId().replace(/:/g, "")
  const [active, setActive] = useState(false)
  useEffect(() => {
    const el = surface.current
    if (!el) return
    let visible = false
    const fallback = matchMedia("(max-width: 700px), (prefers-reduced-motion: reduce)")
    const update = () => setActive(visible && !fallback.matches && !document.hidden && !el.closest("[inert]"))
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update() })
    observer.observe(el)
    const mutation = new MutationObserver(update)
    const card = el.closest(".site-card")
    if (card) mutation.observe(card, { attributes: true, attributeFilter: ["inert"] })
    fallback.addEventListener("change", update)
    document.addEventListener("visibilitychange", update)
    return () => { observer.disconnect(); mutation.disconnect(); fallback.removeEventListener("change", update); document.removeEventListener("visibilitychange", update) }
  }, [])
  return <div ref={surface} className="footer-duty">
    <div ref={box} className="footer-duty-gradient" aria-hidden="true">
      <Image src="/images/footer/duty-gradient.png" alt="" fill sizes="100vw" />
      {active && <MeshGradient settings={settings} surface={surface} box={box} idle={idle} stretch maxWidth={1536} />}
    </div>
    <svg width="0" height="0" className="footer-duty-defs" aria-hidden="true">
      <filter id={`${uid}-duty-shadow`} colorInterpolationFilters="sRGB">
        <feComponentTransfer in="SourceAlpha" result="inverse"><feFuncA type="table" tableValues="1 0" /></feComponentTransfer>
        <feGaussianBlur in="inverse" stdDeviation="2" result="blur" />
        <feOffset in="blur" dy="4" result="offset" />
        <feFlood floodColor="#000" floodOpacity="0.25" result="tint" />
        <feComposite in="tint" in2="offset" operator="in" result="shade" />
        <feComposite in="shade" in2="SourceAlpha" operator="in" result="inner" />
        <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="inner" /></feMerge>
      </filter>
    </svg>
    <p style={{ filter: `url(#${uid}-duty-shadow)` }}>We are ready for our duty</p>
  </div>
}
