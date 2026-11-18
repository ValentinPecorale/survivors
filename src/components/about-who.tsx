"use client"

import dynamic from "next/dynamic"
import { useEffect, useRef, useState, type ComponentType } from "react"
import RevealText from "./reveal-text"

// Shader Lab (~1MB gz) is only fetched once this frame is within a screen of the viewport.
const AsciiChrome = dynamic(() => import("./ascii-video").then(m => m.AsciiVideo), { ssr: false })
const AsciiEagle = dynamic(() => import("./ascii-video-eagle").then(m => m.AsciiVideo), { ssr: false })

/** The three slots. The first two are ASCII compositions (Shader Lab: chrome in ascii-video.tsx, eagle in ascii-video-eagle.tsx); the third is still a plain placeholder clip (640×640, ~25KB, no audio): swap the file in /public/videos for the real one. */
const SLOTS: { key: string; src?: string; Ascii?: ComponentType }[] = [
  { key: "chrome", Ascii: AsciiChrome },
  { key: "eagle", Ascii: AsciiEagle },
  { key: "clip-3", src: "/videos/about-3.mp4" },
]
/** Scroll spent on each video's reveal, in screens (svh). All three = 2.1 screens of pinned scrolling, then the page carries on. */
const SCROLL_PER_VIDEO = 70
/** Ease of each video's mask: slow in, slow out, so a video settles fully before the next begins. */
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/**
 * About, third frame (Figma 104:718): three videos across the top, then label · paragraph · closing line on the 6 / 3 / 3 grid.
 *
 * The frame is pinned (sticky) the moment its bottom edge meets the bottom of the viewport. From there, scroll drives the
 * videos in one after another, top to bottom: each is a clip-path mask whose bottom edge sweeps down while the video itself
 * stays still. The next one starts only when the previous is fully visible. Once all three are in, the pin releases and the
 * page keeps scrolling. Phones and reduced-motion: no pin, all three visible.
 */
export function AboutWho({ label, text, tag }: { label: string; text: string; tag: string }) {
  const track = useRef<HTMLDivElement>(null)
  const cells = useRef<(HTMLDivElement | null)[]>([])
  const clips = useRef<(HTMLVideoElement | null)[]>([])
  const [near, setNear] = useState(false)

  useEffect(() => {
    const el = track.current
    const scroller = el?.closest<HTMLElement>(".site-card")
    if (!el || !scroller) return
    const plain = window.matchMedia("(max-width: 700px), (prefers-reduced-motion: reduce)")
    let frame = 0
    const apply = () => {
      frame = 0
      const n = SLOTS.length
      const total = SCROLL_PER_VIDEO * n / 100 * window.innerHeight
      const p = plain.matches ? 1 : clamp01((scroller.scrollTop - el.offsetTop) / total)
      cells.current.forEach((cell, i) => {
        if (!cell) return
        cell.style.clipPath = `inset(0 0 ${(1 - ease(clamp01(p * n - i))) * 100}% 0)`
      })
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(apply) }
    apply()
    scroller.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    plain.addEventListener("change", schedule)

    // Load the ASCII composition once the frame is within a screen of the viewport.
    const nearIo = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setNear(true); nearIo.disconnect() } }, { rootMargin: "100% 0px" })
    nearIo.observe(el)
    // Only decode video while the frame is on screen.
    const io = new IntersectionObserver(([entry]) => {
      clips.current.forEach(v => { if (!v) return; if (entry.isIntersecting) v.play().catch(() => {}); else v.pause() })
    }, { rootMargin: "50% 0px" })
    io.observe(el)
    return () => {
      cancelAnimationFrame(frame); io.disconnect(); nearIo.disconnect()
      scroller.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); plain.removeEventListener("change", schedule)
    }
  }, [])

  return (
    <div ref={track} className="about-who-track" style={{ height: `calc(100svh + ${SCROLL_PER_VIDEO * SLOTS.length}svh)` }}>
      <section className="about-who" aria-label="who we are">
        <div className="about-who-photos" aria-hidden="true">
          {SLOTS.map(({ key, src, Ascii }, i) => (
            <div key={key} ref={node => { cells.current[i] = node }} className="about-who-photo" style={{ clipPath: "inset(0 0 100% 0)" }}>
              {src
                ? <video ref={node => { clips.current[i] = node }} src={src} muted loop playsInline preload="metadata" />
                : near && Ascii && <div className="about-who-ascii"><Ascii /></div>}
            </div>
          ))}
        </div>
        <div className="about-who-text">
          <RevealText as="h2" text={label} trigger="inView" />
          <RevealText text={text} trigger="inView" />
          <RevealText text={tag} trigger="inView" />
        </div>
      </section>
    </div>
  )
}
