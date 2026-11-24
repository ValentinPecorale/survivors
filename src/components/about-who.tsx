"use client"

import dynamic from "next/dynamic"
import { useEffect, useId, useRef, useState, type ComponentType, type RefObject } from "react"
import { useGradientSettings } from "./gradient-settings"
import { MeshGradient } from "./highlight-gradient"
import RevealText from "./reveal-text"

// Shader Lab (~1MB gz) is only fetched once the first composition is about to mount.
const AsciiChrome = dynamic(() => import("./ascii-video").then(m => m.AsciiVideo), { ssr: false })
const AsciiEagle = dynamic(() => import("./ascii-video-eagle").then(m => m.AsciiVideo), { ssr: false })
const AsciiOrca = dynamic(() => import("./ascii-video-orca").then(m => m.AsciiVideo), { ssr: false })

/** The three slots, left to right: ASCII compositions (Shader Lab) on the shared cheap runtime. A slot can also take a plain clip with `src`. */
const SLOTS: { key: string; badge: string; src?: string; Ascii?: ComponentType }[] = [
  { key: "chrome", badge: "Braves", Ascii: AsciiChrome },
  { key: "eagle", badge: "Curious", Ascii: AsciiEagle },
  { key: "orca", badge: "Strategists", Ascii: AsciiOrca },
]
/** Scroll spent on each video's reveal, in screens (svh): all three videos = 2.1 screens, then the frame stays pinned for the hold (panel setting, 70svh by default), then the pin releases. */
const SCROLL_PER_VIDEO = 70
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
/** A slot mounts when the previous slot's reveal is this far along (the first one when the frame is within a screen), so it is ready when its own reveal starts. */
const MOUNT_AHEAD = 0.4

/**
 * About, third frame (Figma 104:718): the three videos across the screen, with the paragraph · closing line · label under them (6 / 3 / 3 columns, label last on the right). The texts are part of this
 * frame and always visible; the videos take the rest of the height. The Featured projects have their own text under their cards: see featured-projects.tsx.
 *
 * The frame is pinned (sticky) the moment its bottom edge meets the bottom of the viewport. At that point the video row
 * fills the whole screen. Scroll then drives the videos in one after another, top to bottom: each is a clip-path mask whose
 * bottom edge sweeps down while the video itself stays still, and the next one starts only when the previous is fully
 * visible. Everything is linear in scroll (no easing): one pixel of scroll moves every mask by a fixed amount. Once all three are in, the pin
 * releases and the page keeps scrolling. Phones and reduced-motion: no pin, everything visible.
 *
 * Cost: a composition is only mounted shortly before its own reveal begins (so nothing decodes or renders while it is still
 * masked out), and the runtime pauses it whenever it is off screen.
 */
export function AboutWho({ label, text, tag }: { label: string; text: string; tag: string }) {
  const hold = useGradientSettings().whoHold // extra pinned scroll after the last video is fully in (panel: Who we are → Videos scroll)
  const track = useRef<HTMLDivElement>(null)
  const cells = useRef<(HTMLDivElement | null)[]>([])
  const clips = useRef<(HTMLVideoElement | null)[]>([])
  const section = useRef<HTMLElement>(null)
  const textBlock = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState<boolean[]>(() => SLOTS.map(() => false))
  // A badge appears (with the text reveal) once its slot is 100% revealed, and stays.
  const [shown, setShown] = useState<boolean[]>(() => SLOTS.map(() => false))
  const shownRef = useRef<boolean[]>(SLOTS.map(() => false))
  const mountedRef = useRef<boolean[]>(SLOTS.map(() => false))

  useEffect(() => {
    const el = track.current
    const scroller = el?.closest<HTMLElement>(".site-card")
    if (!el || !scroller) return
    const plain = window.matchMedia("(max-width: 700px), (prefers-reduced-motion: reduce)")
    let frame = 0
    const mount = (i: number) => {
      if (mountedRef.current[i]) return
      mountedRef.current[i] = true
      setMounted([...mountedRef.current])
    }
    const showBadge = (i: number) => {
      if (shownRef.current[i]) return
      shownRef.current[i] = true
      setShown([...shownRef.current])
    }
    const apply = () => {
      frame = 0
      // Scroll since the pin began, in screens (svh).
      const s = plain.matches ? Infinity : (scroller.scrollTop - el.offsetTop) / window.innerHeight * 100
      cells.current.forEach((cell, i) => {
        if (!cell) return
        const local = clamp01((s - i * SCROLL_PER_VIDEO) / SCROLL_PER_VIDEO)
        cell.style.clipPath = `inset(0 0 ${(1 - local) * 100}% 0)`
        if (local >= 1) showBadge(i)
        if (i > 0 && (s - i * SCROLL_PER_VIDEO) / SCROLL_PER_VIDEO > -MOUNT_AHEAD) mount(i)
      })
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(apply) }
    apply()
    scroller.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    plain.addEventListener("change", schedule)
    // The first composition mounts once the frame is within a screen of the viewport.
    const nearIo = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { mount(0); nearIo.disconnect() } }, { rootMargin: "100% 0px" })
    nearIo.observe(el)
    // Plain clips only decode while the frame is on screen.
    const io = new IntersectionObserver(([entry]) => {
      clips.current.forEach(v => { if (!v) return; if (entry.isIntersecting) v.play().catch(() => {}); else v.pause() })
    }, { rootMargin: "50% 0px" })
    io.observe(el)
    return () => {
      cancelAnimationFrame(frame); io.disconnect(); nearIo.disconnect()
      scroller.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); plain.removeEventListener("change", schedule)
    }
  }, [])

  // The videos are sized for the room the texts leave: publish the texts' height (the composition is scaled for the slot at its tallest, see --full-h).
  useEffect(() => {
    const block = textBlock.current, frame = section.current
    if (!block || !frame) return
    const measure = () => frame.style.setProperty("--text-h", `${Math.ceil(block.offsetHeight)}px`)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(block)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={track} className="about-who-track" style={{ height: `calc(100svh + ${SCROLL_PER_VIDEO * SLOTS.length + hold}svh)` }}>
      <section ref={section} className="about-who" aria-label="who we are">
        <div className="about-who-photos" aria-hidden="true">
          {SLOTS.map(({ key, badge, src, Ascii }, i) => (
            <div key={key} ref={node => { cells.current[i] = node }} className="about-who-photo" style={{ clipPath: "inset(0 0 100% 0)" }}>
              {src
                ? <video ref={node => { clips.current[i] = node }} src={src} muted loop playsInline preload="metadata" />
                : mounted[i] && Ascii && <div className="about-who-ascii"><Ascii /></div>}
              {shown[i] && <Badge label={badge} surface={section} />}
            </div>
          ))}
        </div>
        <div ref={textBlock} className="about-who-text">
          <RevealText text={text} trigger="inView" />
          <RevealText text={tag} trigger="inView" />
          <RevealText as="h2" text={label} trigger="inView" />
        </div>
      </section>
    </div>
  )
}

/**
 * Slot badge: the interactive mesh gradient as a plate, with the label on it in the colour of the About word (typeColor) and with the same inner shadow (an SVG filter on
 * the text only: it inverts the glyph alpha, offsets and blurs it, and keeps it inside the letters). The shadow comes from the About tab's settings, scaled from that word's
 * size to the badge's 26px. Mounted only once its slot is fully in; its label comes in with the text reveal (random order, no glyph phase; timing, steps, skew, seed and letter/word from the panel's Who we are tab) the moment the badge mounts, and replays when one of those values changes.
 */
const IDLE = { current: false }
const BADGE_SIZE = 26
function Badge({ label, surface }: { label: string; surface: RefObject<HTMLElement | null> }) {
  const g = useGradientSettings()
  const uid = useId().replace(/:/g, "")
  const plate = useRef<HTMLSpanElement>(null)
  const k = BADGE_SIZE / g.typeSize
  return (
    <span className="about-who-badge">
      <svg className="about-who-badge-defs" width="0" height="0" aria-hidden="true" focusable="false">
        <filter id={`${uid}-shadow`} colorInterpolationFilters="sRGB">
          <feComponentTransfer in="SourceAlpha" result="inverse"><feFuncA type="table" tableValues="1 0" /></feComponentTransfer>
          <feGaussianBlur in="inverse" stdDeviation={g.shadowBlur * k} result="blurred" />
          <feOffset in="blurred" dx={g.shadowX * k} dy={g.shadowY * k} result="offset" />
          <feFlood floodColor={g.shadowColor} floodOpacity={g.shadowOpacity} result="tint" />
          <feComposite in="tint" in2="offset" operator="in" result="shade" />
          <feComposite in="shade" in2="SourceAlpha" operator="in" result="inner" />
          <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="inner" /></feMerge>
        </filter>
      </svg>
      <span ref={plate} className="about-who-badge-plate"><MeshGradient settings={g} surface={surface} box={plate} idle={IDLE} /></span>
      <span style={{ color: g.typeColor, filter: g.shadowEnabled ? `url(#${uid}-shadow)` : undefined }}><RevealText as="span" text={label} unit={g.badgeUnit} duration={g.badgeDuration} steps={g.badgeSteps} skew={g.badgeSkew} seed={g.badgeSeed} trigger="load" replayKey={`${g.badgeUnit}-${g.badgeDuration}-${g.badgeSteps}-${g.badgeSkew}-${g.badgeSeed}`} /></span>
    </span>
  )
}
