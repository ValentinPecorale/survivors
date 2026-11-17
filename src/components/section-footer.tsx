"use client"

import Image from "next/image"
import Link from "next/link"
import { MeshGradient } from "./footer-shape/mesh-gradient"
import { useEffect, useId, useRef, useState } from "react"

const settings = { highlight: "#eef6fd", shadow: "#000101", slate: "#58646a", base: "#1a242d", speed: 1, smoothing: 600, size: 100, intensity: 100, warp: 1, softness: 0 }

export function SectionFooter() {
  const root = useRef<HTMLElement>(null)
  const gradient = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)
  useEffect(() => {
    const el = root.current
    if (!el) return
    let visible = false
    const probe = document.createElement("canvas")
    const context = probe.getContext("webgl2")
    const supported = !!context
    context?.getExtension("WEBGL_lose_context")?.loseContext()
    const mobile = matchMedia("(max-width: 700px), (prefers-reduced-motion: reduce)")
    const update = () => setActive(supported && visible && !document.hidden && !mobile.matches && !el.closest("[inert]"))
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update() })
    observer.observe(el)
    const card = el.closest(".site-card")
    const mutation = new MutationObserver(update)
    if (card) mutation.observe(card, { attributes: true, attributeFilter: ["inert"] })
    document.addEventListener("visibilitychange", update)
    mobile.addEventListener("change", update)
    return () => { observer.disconnect(); mutation.disconnect(); document.removeEventListener("visibilitychange", update); mobile.removeEventListener("change", update) }
  }, [])
  return <footer ref={root} className="section-footer">
    <div className="footer-nav-space" aria-hidden="true" />
    <div className="footer-top">
      <p className="footer-tagline">Survivors is more than a brand. It&apos;s a mindset.<br />Built for those who keep moving, push boundaries, and refuse to give up. No matter the odds, we survive.<br />Stay alive. Stay different. Stay a survivor.</p>
    </div>
    <div ref={gradient} className="footer-gradient">
      {/* The poster canvas always paints (mobile / no WebGL fallback); the live WebGL layer only runs while the footer is on screen. */}
      <MeshGradient settings={settings} paused={false} surface={gradient} staticOnly={!active} interactionSurface={gradient} />
      <div className="footer-grid">
        <div className="footer-shape" aria-hidden="true">
          <div className="footer-cube-fallback"><span /></div>
        </div>
        <div className="footer-spacer" aria-hidden="true" />
        <div className="footer-aside">
          <nav className="footer-links" aria-label="Footer">
            <Link href="/" scroll={false}><Label>Home</Label></Link>
            <Link href="/services" scroll={false}><Label>Services</Label></Link>
            <Link href="/work" scroll={false}><Label>Work</Label></Link>
            <Link href="/about#clients" onNavigate={event => { event.preventDefault(); window.dispatchEvent(new Event("survivors:show-clients")) }}><Label>Clients</Label></Link>
            <button type="button" disabled title="Contact details coming soon"><Label>Contact</Label></button>
          </nav>
          <div className="footer-legal">
            <div className="footer-socials">
              {([ ["linkedin", 18, 18], ["instagram", 28, 28], ["discord", 18, 13.5] ] as const).map(([name, width, height]) => <button type="button" key={name} disabled aria-label={`${name} — coming soon`}><Image src={`/images/footer/${name}.svg`} alt="" width={width} height={height} /></button>)}
            </div>
            <p className="type-body">© 2026 Survivors. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  </footer>
}

/** Button label plus its hover bar: a black rectangle with the word cut out of it, so the gradient behind the footer shows through the letters. */
function Label({ children }: { children: string }) {
  const id = "bar" + useId().replace(/[^a-zA-Z0-9]/g, "")
  return <>
    <span className="footer-bar" aria-hidden="true">
      <svg width="100%" height="22">
        <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="22">
          <rect width="100%" height="22" fill="#fff" />
          <text x="7" y="11" dominantBaseline="central" fill="#000">{children}</text>
        </mask>
        <rect width="100%" height="22" fill="#000" mask={`url(#${id})`} />
      </svg>
    </span>
    {children}
  </>
}
