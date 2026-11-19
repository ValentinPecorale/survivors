"use client"

import dynamic from "next/dynamic"
import { useEffect, useRef, useState, type ComponentType } from "react"
import RevealText from "./reveal-text"

// Shader Lab (~1MB gz) is only fetched once the first composition is about to mount.
const AsciiChrome = dynamic(() => import("./ascii-video").then(m => m.AsciiVideo), { ssr: false })
const AsciiEagle = dynamic(() => import("./ascii-video-eagle").then(m => m.AsciiVideo), { ssr: false })
const AsciiOrca = dynamic(() => import("./ascii-video-orca").then(m => m.AsciiVideo), { ssr: false })

/** The three slots, left to right: ASCII compositions (Shader Lab) on the shared cheap runtime. A slot can also take a plain clip with `src`. */
const SLOTS: { key: string; src?: string; Ascii?: ComponentType }[] = [
  { key: "chrome", Ascii: AsciiChrome },
  { key: "eagle", Ascii: AsciiEagle },
  { key: "orca", Ascii: AsciiOrca },
]
/** Scroll spent on each video's reveal, in screens (svh): all three videos = 2.1 screens. */
const SCROLL_PER_VIDEO = 70
/** Then the text arrives over this much scroll (svh), growing into the layout and pushing the videos up. Total pinned scroll = 2.8 screens, then the page carries on. */
const SCROLL_TEXT = 70
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
/** A slot mounts when the previous slot's reveal is this far along (the first one when the frame is within a screen), so it is ready when its own reveal starts. */
const MOUNT_AHEAD = 0.4

/**
 * About, third frame (Figma 104:718): three videos across the top, then paragraph · closing line · label on the 6 / 3 / 3 grid (label last, on the right).
 *
 * The frame is pinned (sticky) the moment its bottom edge meets the bottom of the viewport. At that point the video row
 * fills the whole screen. Scroll then drives the videos in one after another, top to bottom: each is a clip-path mask whose
 * bottom edge sweeps down while the video itself stays still, and the next one starts only when the previous is fully
 * visible. Everything is linear in scroll (no easing): one pixel of scroll moves every mask and the text block by a fixed amount. Once all three are in, the text block grows in from the bottom (its wrapper height goes from 0 to its natural
 * height), pushing the video row up so it shrinks; the final screen shows every video and every text layer. Then the pin
 * releases and the page keeps scrolling. Phones and reduced-motion: no pin, everything visible.
 *
 * Cost: a composition is only mounted shortly before its own reveal begins (so nothing decodes or renders while it is still
 * masked out), and the runtime pauses it whenever it is off screen.
 */
export function AboutWho({ label, text, tag }: { label: string; text: string; tag: string }) {
  const track = useRef<HTMLDivElement>(null)
  const cells = useRef<(HTMLDivElement | null)[]>([])
  const clips = useRef<(HTMLVideoElement | null)[]>([])
  const textWrap = useRef<HTMLDivElement>(null)
  const textInner = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState<boolean[]>(() => SLOTS.map(() => false))
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
    const apply = () => {
      frame = 0
      const n = SLOTS.length
      // Scroll since the pin began, in screens (svh).
      const s = plain.matches ? Infinity : (scroller.scrollTop - el.offsetTop) / window.innerHeight * 100
      cells.current.forEach((cell, i) => {
        if (!cell) return
        const local = clamp01((s - i * SCROLL_PER_VIDEO) / SCROLL_PER_VIDEO)
        cell.style.clipPath = `inset(0 0 ${(1 - local) * 100}% 0)`
        if (i > 0 && (s - i * SCROLL_PER_VIDEO) / SCROLL_PER_VIDEO > -MOUNT_AHEAD) mount(i)
      })
      const wrap = textWrap.current, inner = textInner.current
      if (wrap && inner) {
        if (plain.matches) wrap.style.height = ""
        else wrap.style.height = `${Math.round(inner.offsetHeight * clamp01((s - n * SCROLL_PER_VIDEO) / SCROLL_TEXT))}px`
      }
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(apply) }
    apply()
    scroller.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    plain.addEventListener("change", schedule)

    // The text block's natural height changes with the width (and when its copy is revealed): re-measure.
    const measure = textInner.current ? new ResizeObserver(schedule) : null
    if (textInner.current) measure?.observe(textInner.current)
    // The first composition mounts once the frame is within a screen of the viewport.
    const nearIo = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { mount(0); nearIo.disconnect() } }, { rootMargin: "100% 0px" })
    nearIo.observe(el)
    // Plain clips only decode while the frame is on screen.
    const io = new IntersectionObserver(([entry]) => {
      clips.current.forEach(v => { if (!v) return; if (entry.isIntersecting) v.play().catch(() => {}); else v.pause() })
    }, { rootMargin: "50% 0px" })
    io.observe(el)
    return () => {
      cancelAnimationFrame(frame); io.disconnect(); nearIo.disconnect(); measure?.disconnect()
      scroller.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); plain.removeEventListener("change", schedule)
    }
  }, [])

  return (
    <div ref={track} className="about-who-track" style={{ height: `calc(100svh + ${SCROLL_PER_VIDEO * SLOTS.length + SCROLL_TEXT}svh)` }}>
      <section className="about-who" aria-label="who we are">
        <div className="about-who-photos" aria-hidden="true">
          {SLOTS.map(({ key, src, Ascii }, i) => (
            <div key={key} ref={node => { cells.current[i] = node }} className="about-who-photo" style={{ clipPath: "inset(0 0 100% 0)" }}>
              {src
                ? <video ref={node => { clips.current[i] = node }} src={src} muted loop playsInline preload="metadata" />
                : mounted[i] && Ascii && <div className="about-who-ascii"><Ascii /></div>}
            </div>
          ))}
        </div>
        <div ref={textWrap} className="about-who-text-wrap">
          <div ref={textInner} className="about-who-text">
            <RevealText text={text} trigger="inView" />
            <RevealText text={tag} trigger="inView" />
            <RevealText as="h2" text={label} trigger="inView" />
          </div>
        </div>
      </section>
    </div>
  )
}
