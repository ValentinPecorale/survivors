"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { useGradientSettings, type GradientSettings } from "./gradient-settings"
import { MeshGradient } from "./highlight-gradient"
import { dotTile } from "./dot-grid"
import RevealText from "./reveal-text"

export type FeaturedProject = { title: string; tag: string; description?: string; date?: string; image: string; href: string }

/** Scroll spent on each incoming card, in screens (svh). Linear, like the "Who we are" frame: no easing. */
const SCROLL_PER_CARD = 70
/** Reading room before every incoming card and after the last one lands. */
const HOLD_PER_CARD = 50
/** Two slots side by side (one on phones); project k lives in slot k % slots, and later projects stack over earlier ones. */
const PHONE = "(max-width: 700px)"
const watchPhone = (notify: () => void) => { const query = window.matchMedia(PHONE); query.addEventListener("change", notify); return () => query.removeEventListener("change", notify) }
const slotsNow = () => (window.matchMedia(PHONE).matches ? 1 : 2)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/**
 * The dot grid on the regular cards is the ASCII effect's own dot field, as it reads over the video slots: one "." per cell, 155 columns over ~917px of
 * composition = 5.92px cells, 12.25px tall (the glyph aspect). Everything about it is in the panel (About → Featured cards · ASCII dots): colour, opacity,
 * columns across a card, row height, dot size. A static field, so it is drawn once into a tiny canvas tile instead of running a second shader per card.
 * The tile is built in DEVICE pixels (cell size rounded to whole device pixels, then sized back in CSS px), so the grid stays perfectly regular at any
 * browser zoom or display scaling: a fractional CSS tile is what made the first dots turn uneven. Cells come from the card width, not from a fixed px.
 */

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
 * the photo is in colour in every state (no grayscale filter); the number sits on the interactive gradient and turns white on hover, when the metadata plate slides in. Instant; pointer cursor. A card links wherever its `href`
 * says (empty = shown but not clickable, same rule as the logo strip). A card with no image shows a dark placeholder block. The photo is a plain image: no reveal effect (the texts keep theirs).
 *
 * Overlap: the frame is pinned with the title and the two slots fixed on screen. Project 3 rises from the bottom over project 1 (which stays where it is
 * underneath); each overlap is preceded by a 50svh reading hold. Linear in scroll, 70svh per card; after a final 50svh hold the pin releases and the
 * page carries on. Each moving card is one transform per frame. Phones and reduced motion: no pin, every card stacked.
 */
export function FeaturedProjects({ projects, title, intro }: { projects: readonly FeaturedProject[]; title: string; intro: string }) {
  const g = useGradientSettings()
  const surface = useRef<HTMLElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const layers = useRef<(HTMLDivElement | null)[]>([])
  const slots = useSyncExternalStore(watchPhone, slotsNow, () => 2)
  const incoming = Math.max(0, projects.length - slots)

  useEffect(() => {
    const el = track.current
    const scroller = el?.closest<HTMLElement>(".site-card")
    if (!el || !scroller) return
    const plain = window.matchMedia("(prefers-reduced-motion: reduce)") // phones pin too, with one project at a time
    let frame = 0
    const apply = () => {
      frame = 0
      // Scroll since the pin began, in screens (svh).
      const s = plain.matches ? Infinity : (scroller.scrollTop - el.offsetTop) / window.innerHeight * 100
      layers.current.forEach((layer, k) => {
        if (!layer || k < slots) return
        const p = plain.matches ? 1 : clamp01((s - HOLD_PER_CARD - (k - slots) * (SCROLL_PER_CARD + HOLD_PER_CARD)) / SCROLL_PER_CARD)
        layer.style.transform = plain.matches ? "" : `translateY(${(1 - p) * 102}%)`
      })
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(apply) }
    apply()
    scroller.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    plain.addEventListener("change", schedule)
    return () => { cancelAnimationFrame(frame); scroller.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); plain.removeEventListener("change", schedule) }
  }, [projects.length, slots])

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
        el.style.setProperty("--dot-w", `${tile.w}px`)
        el.style.setProperty("--dot-h", `${tile.h}px`)
      }
    }
    build()
    const resize = new ResizeObserver(build); resize.observe(ul)
    return () => { resize.disconnect(); query?.removeEventListener("change", build) }
  }, [projects.length, slots, dotsEnabled, dotsColor, dotsOpacity, dotsColumns, dotsRatio, dotsSize])

  if (!projects.length) return null
  return (
    <div ref={track} className="featured-track" style={{ height: `calc(100svh + ${incoming * SCROLL_PER_CARD + (incoming + 1) * HOLD_PER_CARD}svh)` }}>
      <section ref={surface} className="featured" aria-label="Featured projects">
        <div className="featured-main">
          <ul ref={list} className="featured-cards">
            {Array.from({ length: Math.min(slots, projects.length) }, (_, slot) => (
              <li key={slot} className="featured-slot">
                {projects.map((project, k) => k % slots === slot && (
                  <div key={`${k}-${project.title}`} ref={node => { layers.current[k] = node }} className="featured-layer" style={{ zIndex: k, order: k, transform: k >= slots ? "translateY(102%)" : undefined }}>
                    <Card project={project} number={k + 1} />
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </div>
        {(title || intro) && (
          <div className="about-who-text featured-text">
            <RevealText as="h2" className="who-title" text={title} trigger="inView" />
            <RevealText className="who-intro" text={intro} trigger="inView" />
          </div>
        )}
      </section>
    </div>
  )
}

function Card({ project, number }: { project: FeaturedProject; number: number }) {
  // Each hover (or keyboard focus) replays the label's reveal with the ASCII phase.
  const [replay, setReplay] = useState(0)
  // The number sits on the interactive gradient by default; while the card is hovered or focused its background is plain white (the gradient is hidden and stops drawing).
  const [active, setActive] = useState(false)
  const idle = useRef(false)
  useEffect(() => { idle.current = active }, [active])
  const g = useGradientSettings()
  const card = useRef<HTMLElement | null>(null)
  const numBox = useRef<HTMLSpanElement>(null)
  const enter = () => { setReplay(n => n + 1); setActive(true) }
  const hover = { onPointerEnter: enter, onFocus: enter, onPointerLeave: () => setActive(false), onBlur: () => setActive(false) }
  const body = (
    <>
      <span className="featured-card-title">
        <span ref={numBox} className="featured-card-num" data-active={active ? "" : undefined}>
          <span className="featured-num-gradient" aria-hidden="true"><MeshGradient settings={g} surface={card} box={numBox} idle={idle} /></span>
          <RevealText as="span" text={`${number}.`} trigger="inView" />
        </span>
        <span className="featured-card-name"><RevealText as="span" text={project.title} trigger="inView" /></span>
      </span>
      <span className="featured-card-image">
        {project.image
          ? <Image className="featured-card-photo" src={project.image} alt={`${project.title}, ${project.tag}`} fill sizes="(max-width: 700px) 100vw, 50vw" quality={90} draggable={false} />
          : <span className="featured-card-placeholder" />}
      </span>
      <span className="featured-meta-reveal"><span className="featured-meta-clip">
      <span className="featured-card-meta">
        <MetadataRule replay={replay} seed={1} />
        <span className="featured-card-description"><RevealText as="span" text={project.description ?? ""} trigger="inView" replayKey={replay} {...HOVER_REVEAL} /></span>
        <MetadataRule replay={replay} seed={2} />
        <span className="featured-card-details">
          <span><RevealText as="span" text={project.tag} trigger="inView" replayKey={replay} {...HOVER_REVEAL} /></span>
          <MetadataRule replay={replay} seed={3} />
          <span><RevealText as="span" text={project.date ?? ""} trigger="inView" replayKey={replay} {...HOVER_REVEAL} /></span>
        </span>
        <MetadataRule replay={replay} seed={4} />
      </span>
      </span></span>
    </>
  )
  const href = project.href.trim()
  if (!href) return <span ref={node => { card.current = node }} className="featured-card" tabIndex={0} {...hover}>{body}</span>
  if (href.startsWith("/")) return <Link ref={node => { card.current = node }} className="featured-card" href={href} {...hover}>{body}</Link>
  return <a ref={node => { card.current = node }} className="featured-card" href={href} target="_blank" rel="noopener noreferrer" {...hover}>{body}</a>
}

/**
 * The dotted separators in the metadata are drawn by this canvas: square cells, dot size / opacity / color from the panel, and the same random reveal. Every dot gets a stable random rank (seeded); dots switch on, and stay on, in rank order over the
 * duration in the steps set in the Properties panel (About → Featured cards · title dots reveal), with the skew moving when most of them land. No dot is ever cut: the strip is
 * a separator is one column with its rows spread top to bottom, so no dot is ever cut. Replays on every hover or focus (the card's replay counter).
 * Touch screens (no hover) and reduced motion get the finished dots at once.
 */
function DotCanvas({ replay, mode, seed = 0 }: { replay: number; mode: "strip" | "rule"; seed?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const last = useRef({ sig: "", replay: 0 })
  const { stripSize, stripOpacity, stripColor, stripDuration, stripSteps, stripSkew, stripSeed } = useGradientSettings()
  useEffect(() => {
    const canvas = ref.current, parent = canvas?.parentElement
    const ctx = canvas?.getContext("2d")
    if (!canvas || !parent || !ctx) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")
    const touch = window.matchMedia("(hover: none)")
    const total = stripDuration
    // A change in the panel (not a hover) previews the reveal on the strips: the dots show and replay for a moment, so the sliders can be judged without hovering a card.
    const sig = [stripSize, stripOpacity, stripColor, stripDuration, stripSteps, stripSkew, stripSeed].join()
    const preview = mode === "strip" && last.current.sig !== "" && last.current.sig !== sig && last.current.replay === replay
    last.current = { sig, replay }
    const settled = mode === "rule" && touch.matches // separators on a touch screen are always on screen: finished dots, no hover to wait for
    const start = replay > 0 || preview ? performance.now() : -1
    let hide = 0
    if (preview) { canvas.dataset.preview = ""; hide = window.setTimeout(() => { delete canvas.dataset.preview }, total + 700) }
    let raf = 0
    const draw = (now: number) => {
      raf = 0
      const w = parent.clientWidth, h = parent.clientHeight
      if (!w || !h) return
      const dpr = window.devicePixelRatio || 1
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr) }
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (start < 0 && !settled) return
      const elapsed = reduce.matches || settled ? total : now - start
      // Square cells: the strip is 5 rows tall, a separator is one cell wide.
      // The same vertical pitch as the footer grid: half a layout row (--dot-h / 2), so every grid on the site has the same dots.
      const pitch = mode === "rule" ? (parseFloat(getComputedStyle(parent).getPropertyValue("--dot-h")) || w * 2) / 2 : h / 5
      const rows = mode === "strip" ? 5 : Math.max(1, Math.floor(h / pitch))
      const cols = mode === "strip" ? Math.max(1, Math.floor(w / (h / 5))) : 1
      const count = rows * cols
      // Stable shuffled rank of every dot.
      const order = Array.from({ length: count }, (_, i) => i)
      let state = (Math.imul(stripSeed + seed * 131 + 1, 2654435761) >>> 0) || 1
      for (let i = count - 1; i > 0; i--) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0
        const j = state % (i + 1)
        ;[order[i], order[j]] = [order[j], order[i]]
      }
      const side = stripSize * dpr // not rounded: the slider scales smoothly (a fractional size just covers its last pixel partly, the same way for every dot)
      ctx.fillStyle = stripColor
      ctx.globalAlpha = stripOpacity
      for (let rank = 0; rank < count; rank++) {
        const fraction = Math.pow(rank / count, stripSkew)
        const delay = stripSteps > 1 ? Math.floor(fraction * (stripSteps - 1)) / (stripSteps - 1) * stripDuration : 0
        if (elapsed < delay) continue
        const index = order[rank]
        const row = Math.floor(index / cols), col = index % cols
        ctx.fillRect(Math.round((col + 0.5) * (w / cols) * dpr - side / 2), Math.round((row + 0.5) * pitch * dpr - side / 2), side, side) // origin on a whole device pixel: every dot looks identical
      }
      if (elapsed < total) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    const ro = new ResizeObserver(() => { if (!raf) raf = requestAnimationFrame(draw) })
    ro.observe(parent)
    return () => { cancelAnimationFrame(raf); clearTimeout(hide); ro.disconnect() }
  }, [replay, mode, seed, stripSize, stripOpacity, stripColor, stripDuration, stripSteps, stripSkew, stripSeed])
  return <canvas ref={ref} className={mode === "strip" ? "featured-title-dots" : "featured-rule-dots"} aria-hidden="true" />
}

/** The dotted separator between the metadata columns: one column of the same dots, same reveal. */
function MetadataRule({ replay, seed }: { replay: number; seed: number }) {
  return <span className="featured-meta-rule" aria-hidden="true"><DotCanvas replay={replay} mode="rule" seed={seed} /></span>
}
