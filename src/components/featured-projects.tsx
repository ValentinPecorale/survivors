"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef } from "react"
import { useGradientSettings } from "./gradient-settings"
import { MeshGradient } from "./highlight-gradient"
import RevealText from "./reveal-text"

export type FeaturedProject = { title: string; tag: string; image: string; href: string }

/** Scroll spent on each incoming card, in screens (svh). Linear, like the "Who we are" frame: no easing. */
const SCROLL_PER_CARD = 70
/** Two slots side by side; project k lives in slot k % 2, and later projects stack over earlier ones. */
const SLOTS = 2
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/**
 * About, fourth frame (Figma 163:2614): "FEATURED PROJECTS" across the full width, then two project cards. One screen tall.
 *
 * Title: the Figma letters are 16 pieces; they are merged into one alpha mask (public/images/featured/featured-projects-mask.png, 2748×202,
 * the exact 13.6 : 1 shape) and the interactive mesh gradient (the one behind "Websites") is painted through it with a CSS mask. The box
 * keeps that ratio, so the title always spans the full width and scales with it. The gradient is stretched across the whole word (not
 * anchored to one edge) and follows the cursor anywhere in the frame, like the other one.
 * Cost: one small WebGL canvas (~1374×101 css px), drawn only while the frame is on screen.
 *
 * Cards (Figma 162:2459): label (Space Grotesk 15px, caps, 0.3em tracking, numbered "1." "2." in a 22.5px gutter like a list marker) · image · category
 * (Geist 26px, #8E8E8E). The image takes whatever height is left, so the frame is always exactly one screen. States (Figma 164:2670, inverted as asked):
 * regular = black-and-white photo + dot grid; hover = colour photo + underlined name, no dots. Instant; pointer cursor. A card links wherever its `href`
 * says (empty = shown but not clickable, same rule as the logo strip). A card with no image shows a dark placeholder block.
 *
 * Overlap: the frame is pinned with the title and the two slots fixed on screen. Project 3 rises from the bottom over project 1 (which stays where it is
 * underneath); when it has landed, project 4 rises over project 2. Linear in scroll, 70svh per card; when the last one is in place the pin releases and the
 * page carries on. Each moving card is one transform per frame. Phones and reduced motion: no pin, every card stacked.
 */
export function FeaturedProjects({ projects }: { projects: readonly FeaturedProject[] }) {
  const g = useGradientSettings()
  const surface = useRef<HTMLElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const layers = useRef<(HTMLDivElement | null)[]>([])
  const idle = useRef(false)
  const incoming = Math.max(0, projects.length - SLOTS)

  useEffect(() => {
    const el = track.current
    const scroller = el?.closest<HTMLElement>(".site-card")
    if (!el || !scroller) return
    const plain = window.matchMedia("(max-width: 700px), (prefers-reduced-motion: reduce)")
    let frame = 0
    const apply = () => {
      frame = 0
      // Scroll since the pin began, in screens (svh).
      const s = plain.matches ? Infinity : (scroller.scrollTop - el.offsetTop) / window.innerHeight * 100
      layers.current.forEach((layer, k) => {
        if (!layer || k < SLOTS) return
        const p = plain.matches ? 1 : clamp01((s - (k - SLOTS) * SCROLL_PER_CARD) / SCROLL_PER_CARD)
        layer.style.transform = plain.matches ? "" : `translateY(${(1 - p) * 100}%)`
      })
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(apply) }
    apply()
    scroller.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    plain.addEventListener("change", schedule)
    return () => { cancelAnimationFrame(frame); scroller.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); plain.removeEventListener("change", schedule) }
  }, [projects.length])

  if (!projects.length) return null
  return (
    <div ref={track} className="featured-track" style={{ height: `calc(100svh + ${incoming * SCROLL_PER_CARD}svh)` }}>
      <section ref={surface} className="featured" aria-label="Featured projects">
        <h2 className="visually-hidden">Featured projects</h2>
        <div ref={box} className="featured-title" aria-hidden="true">
          <MeshGradient settings={g} surface={surface} box={box} idle={idle} stretch />
        </div>
        <ul className="featured-cards">
          {Array.from({ length: Math.min(SLOTS, projects.length) }, (_, slot) => (
            <li key={slot} className="featured-slot">
              {projects.map((project, k) => k % SLOTS === slot && (
                <div key={`${k}-${project.title}`} ref={node => { layers.current[k] = node }} className="featured-layer" style={{ zIndex: k, order: k, transform: k >= SLOTS ? "translateY(100%)" : undefined }}>
                  <Card project={project} number={k + 1} />
                </div>
              ))}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Card({ project, number }: { project: FeaturedProject; number: number }) {
  const body = (
    <>
      <span className="featured-card-title">
        <span className="featured-card-num"><RevealText as="span" text={`${number}.`} trigger="inView" /></span>
        <RevealText as="span" text={project.title} trigger="inView" />
      </span>
      <span className="featured-card-image">
        {project.image
          ? <Image src={project.image} alt="" fill sizes="(max-width: 700px) 100vw, 50vw" />
          : <span className="featured-card-placeholder" />}
      </span>
      <span className="featured-card-tag"><RevealText as="span" text={project.tag} trigger="inView" /></span>
    </>
  )
  const href = project.href.trim()
  if (!href) return <span className="featured-card">{body}</span>
  if (href.startsWith("/")) return <Link className="featured-card" href={href}>{body}</Link>
  return <a className="featured-card" href={href} target="_blank" rel="noopener noreferrer">{body}</a>
}
