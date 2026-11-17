"use client"

import dynamic from "next/dynamic"
import Image from "next/image"
import Link from "next/link"
import { MeshGradient } from "./footer-shape/mesh-gradient"
import { footerShape } from "./footer-shape/shape-source"
import { useGradientSettings } from "./gradient-settings"
import { useEffect, useMemo, useRef, useState } from "react"

const GradientCube = dynamic(() => import("./footer-shape/gradient-cube"), { ssr: false })
const settings = { highlight: "#eef6fd", shadow: "#000101", slate: "#58646a", base: "#1a242d", speed: 1, smoothing: 600, size: 100, intensity: 100, warp: 1, softness: 0 }
const dims = { x: 1.6, y: 1.6, z: 1.6 }
const defaultSurface = { fill: "solid" as const, color: "#000000", finish: "metal" as const, texture: "smooth" as const, roughness: 0.31, strength: 0.3 }

export function SectionFooter() {
  const g = useGradientSettings()
  const { footerBg, footerShapeColor } = g
  const surface = useMemo(() => ({ ...defaultSurface, color: footerShapeColor, finish: g.footerFinish, roughness: g.footerRoughness }), [footerShapeColor, g.footerFinish, g.footerRoughness])
  const shape = useMemo(() => ({ ...footerShape, depth: g.footerDepth, bevel: g.footerBevel }), [g.footerDepth, g.footerBevel])
  const motion = useMemo(() => ({ enabled: g.footerMotion, horizontal: g.footerHorizontal, vertical: g.footerVertical, settling: g.footerSettling, idle: g.footerIdle, invert: g.footerInvert }), [g.footerMotion, g.footerHorizontal, g.footerVertical, g.footerSettling, g.footerIdle, g.footerInvert])
  const lighting = useMemo(() => ({ keyIntensity: g.footerKey, keyColor: g.footerKeyColor, azimuth: g.footerAzimuth, elevation: g.footerElevation, fillIntensity: g.footerFill, fillColor: g.footerFillColor, ambient: g.footerAmbient, reflections: g.footerReflections }), [g.footerKey, g.footerKeyColor, g.footerAzimuth, g.footerElevation, g.footerFill, g.footerFillColor, g.footerAmbient, g.footerReflections])
  const cameraOptions = useMemo(() => ({ projection: g.footerProjection, zoom: g.footerZoom, fov: g.footerFov, offsetX: g.footerOffsetX, offsetY: g.footerOffsetY }), [g.footerProjection, g.footerZoom, g.footerFov, g.footerOffsetX, g.footerOffsetY])
  const root = useRef<HTMLElement>(null)
  const gradientSource = useRef<HTMLDivElement>(null)
  const nav = useRef<HTMLElement>(null)
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
  return <footer ref={root} className="section-footer" style={{ background: footerBg }}>
    <div className="footer-grid">
      <div className="footer-shape" aria-hidden="true">
        <div className="footer-cube-fallback" style={{ color: footerShapeColor }}><span /></div>
        {active && <GradientCube svg={shape} settings={settings} dims={dims} paused={false} motion={motion} recenter={0} surface={surface} lighting={lighting} cameraOptions={cameraOptions} />}
      </div>
      <div className="footer-spacer" aria-hidden="true" />
      <nav ref={nav} className="footer-links" aria-label="Footer">
        {active && <div ref={gradientSource} className="footer-gradient-source"><MeshGradient settings={settings} paused={false} surface={gradientSource} mirrors={nav} interactionSurface={root} /></div>}
        <Link href="/" scroll={false}><ButtonChrome />Home</Link>
        <Link href="/services" scroll={false}><ButtonChrome />Services</Link>
        <Link href="/work" scroll={false}><ButtonChrome />Work</Link>
        <Link href="/about#clients" onNavigate={event => { event.preventDefault(); window.dispatchEvent(new Event("survivors:show-clients")) }}><ButtonChrome />Clients</Link>
        <button type="button" disabled title="Contact details coming soon"><ButtonChrome />Contact</button>
      </nav>
    </div>
    <div className="footer-caption">
      <p>Survivors is more than a brand. It&apos;s a mindset.<br />Built for those who keep moving, push boundaries, and refuse to give up. No matter the odds, we survive.<br />Stay alive. Stay different. Stay a survivor.<br />© 2026 Survivors. All rights reserved.</p>
      <div className="footer-socials">
        {([ ["linkedin", 14], ["instagram", 14], ["discord", 10.5] ] as const).map(([name, height]) => <button type="button" key={name} disabled aria-label={`${name} — coming soon`}><Image src={`/images/footer/${name}.svg`} alt="" width={14} height={height} /></button>)}
      </div>
    </div>
  </footer>
}

function ButtonChrome() { return <span className="footer-button-chrome" aria-hidden="true"><canvas data-footer-chrome width={256} height={64} /></span> }
