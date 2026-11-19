"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useGradientSettings, type GradientSettings } from "./gradient-settings"
import { MeshGradient } from "./highlight-gradient"
import RevealImage from "./reveal-image"
import RevealText from "./reveal-text"

export type FeaturedProject = { title: string; tag: string; description?: string; date?: string; image: string; href: string }

/** Scroll spent on each incoming card, in screens (svh). Linear, like the "Who we are" frame: no easing. */
const SCROLL_PER_CARD = 70
/** Two slots side by side; project k lives in slot k % 2, and later projects stack over earlier ones. */
const SLOTS = 2
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/**
 * The dot grid on the regular cards is the ASCII effect's own dot field, as it reads over the video slots: one "." per cell, 155 columns over ~917px of
 * composition = 5.92px cells, 12.25px tall (the glyph aspect). Everything about it is in the panel (About → Featured cards · ASCII dots): colour, opacity,
 * columns across a card, row height, dot size. A static field, so it is drawn once into a tiny canvas tile instead of running a second shader per card.
 * The tile is built in DEVICE pixels (cell size rounded to whole device pixels, then sized back in CSS px), so the grid stays perfectly regular at any
 * browser zoom or display scaling: a fractional CSS tile is what made the first dots turn uneven. Cells come from the card width, not from a fixed px.
 */
function dotTile(g: GradientSettings, cardWidth: number) {
  const dpr = window.devicePixelRatio || 1
  const cellW = Math.max(2, cardWidth / g.dotsColumns), cellH = cellW * g.dotsRatio
  const w = Math.max(2, Math.round(cellW * dpr)), h = Math.max(2, Math.round(cellH * dpr))
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  const [r, gr, bl] = [1, 3, 5].map(i => parseInt(g.dotsColor.slice(i, i + 2), 16))
  ctx.fillStyle = `rgba(${r},${gr},${bl},${g.dotsOpacity})`
  const d = g.dotsSize * dpr
  ctx.fillRect(w / 2 - d / 2, h / 2 - d / 2, d, d)
  return { url: canvas.toDataURL(), w: w / dpr, h: h / dpr }
}

/**
 * The card photos arrive with RevealImage: a tinted symbol grid fills the box (36 columns, 400ms), holds 50ms, then the photo lands in 32px cells (900ms, 16 steps,
 * random order). Starts when 30% of the photo is in view (a card that rises over another starts as it appears). About 1.35s in total. The canvas replaces the <img>,
 * so it is drawn at the display's resolution (capped at 2×) from the 1400px-wide WebP.
 */
const IMAGE_REVEAL = { glyphCols: 36, glyphDuration: 400, hold: 50, cell: 32, duration: 900, steps: 16, order: "random", cycle: 60, charset: "symbols", tint: true } as const

/** The label's reveal when a card is hovered: the ASCII phase (hidden → random symbol → letter), quick enough for a hover. */
const HOVER_REVEAL = { duration: 700, steps: 14, scramble: 360, cycle: 88, charset: "symbols" } as const

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
 * regular = black-and-white photo + the ASCII dot grid; hover = colour photo + underlined name, no dots. Instant; pointer cursor. A card links wherever its `href`
 * says (empty = shown but not clickable, same rule as the logo strip). A card with no image shows a dark placeholder block. The photo is revealed with RevealImage (see IMAGE_REVEAL).
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
  const list = useRef<HTMLUListElement>(null)
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

  // Dot grid tile: rebuilt when a panel value, the card width or the display scaling changes.
  const { dotsEnabled, dotsColor, dotsOpacity, dotsColumns, dotsRatio, dotsSize } = g
  useEffect(() => {
    const el = surface.current, ul = list.current
    if (!el || !ul) return
    let query: MediaQueryList | null = null
    const build = () => {
      query?.removeEventListener("change", build)
      query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      query.addEventListener("change", build)
      const slot = ul.firstElementChild as HTMLElement | null
      const width = (slot && slot.clientWidth) || ul.clientWidth // phones: one column, the slots have no box of their own
      const tile = width ? dotTile({ dotsEnabled, dotsColor, dotsOpacity, dotsColumns, dotsRatio, dotsSize } as GradientSettings, width) : null
      if (tile) {
        el.style.setProperty("--dots", dotsEnabled ? `url(${tile.url})` : "linear-gradient(transparent, transparent)")
        // Same raster, device-pixel rounding and pitch as the image grid; separators stay grey and visible.
        const metadataTile = dotTile({ dotsColor: "#8E8E8E", dotsOpacity, dotsColumns, dotsRatio, dotsSize } as GradientSettings, width)
        el.style.setProperty("--metadata-dots", metadataTile ? `url(${metadataTile.url})` : "none")
        el.style.setProperty("--dot-w", `${tile.w}px`)
        el.style.setProperty("--dot-h", `${tile.h}px`)
      }
    }
    build()
    const resize = new ResizeObserver(build); resize.observe(ul)
    return () => { resize.disconnect(); query?.removeEventListener("change", build) }
  }, [projects.length, dotsEnabled, dotsColor, dotsOpacity, dotsColumns, dotsRatio, dotsSize])

  if (!projects.length) return null
  return (
    <div ref={track} className="featured-track" style={{ height: `calc(100svh + ${incoming * SCROLL_PER_CARD}svh)` }}>
      <section ref={surface} className="featured" aria-label="Featured projects">
        <h2 className="visually-hidden">Featured projects</h2>
        <div ref={box} className="featured-title" aria-hidden="true">
          <MeshGradient settings={g} surface={surface} box={box} idle={idle} stretch />
        </div>
        <ul ref={list} className="featured-cards">
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
  // Each hover (or keyboard focus) replays the label's reveal with the ASCII phase.
  const [replay, setReplay] = useState(0)
  const hover = { onPointerEnter: () => setReplay(n => n + 1), onFocus: () => setReplay(n => n + 1) }
  const reveal = replay > 0 ? HOVER_REVEAL : {}
  const body = (
    <>
      <span className="featured-card-title">
        <span className="featured-card-num"><RevealText as="span" text={`${number}.`} trigger="inView" replayKey={replay} {...reveal} /></span>
        <RevealText as="span" text={project.title} trigger="inView" replayKey={replay} {...reveal} />
      </span>
      <span className="featured-card-image">
        {project.image
          ? <RevealImage src={project.image} alt={`${project.title}, ${project.tag}`} trigger="inView" glyphLayer="draw" style={{ position: "absolute", inset: 0 }} {...IMAGE_REVEAL} />
          : <span className="featured-card-placeholder" />}
      </span>
      <span className="featured-card-meta">
        <MetadataRule />
        <span className="featured-card-description"><RevealText as="span" text={project.description ?? ""} trigger="inView" /></span>
        <MetadataRule />
        <span className="featured-card-details">
          <span><RevealText as="span" text={project.tag} trigger="inView" /></span>
          <MetadataRule />
          <span><RevealText as="span" text={project.date ?? ""} trigger="inView" /></span>
        </span>
        <MetadataRule />
      </span>
    </>
  )
  const href = project.href.trim()
  if (!href) return <span className="featured-card" {...hover}>{body}</span>
  if (href.startsWith("/")) return <Link className="featured-card" href={href} {...hover}>{body}</Link>
  return <a className="featured-card" href={href} target="_blank" rel="noopener noreferrer" {...hover}>{body}</a>
}

function MetadataRule() {
  return <span className="featured-meta-rule" aria-hidden="true" />
}
