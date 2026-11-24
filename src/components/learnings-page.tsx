"use client"

import { useEffect, useRef, useState } from "react"
import { DotRule } from "./dot-rule"
import { useDotGrid } from "./dot-grid"
import RevealImage from "./reveal-image"
import RevealText from "./reveal-text"

type Learning = { introHeading: string; introText: string; heading: string; aiLabel: string; tabs: string[]; body: string; images: string[]; sideTitle: string; sideLines: string[] }

/**
 * Learnings. First frame (Figma 201:2388): the title and one grey sentence, bottom-aligned on a full screen, no reveal on the heading (like every H1).
 * Then the article (Figma 202:2477): the article in the left half, a pinned panel in the right half (three images, then the title and two lines).
 * The header row carries the heading (kept for the document outline, transparent as in the design) and the view tabs on the right half's four columns.
 * Only "columns" is designed so far: GRID and ROWS stay inert until they have a layout. AI copies the article (title + body) to the clipboard.
 */
export function LearningsPage({ introHeading, introText, heading, aiLabel, tabs, body, images, sideTitle, sideLines }: Learning) {
  const section = useRef<HTMLElement>(null)
  useDotGrid(section)
  const [copied, setCopied] = useState(false)
  const timer = useRef<number>(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const copy = () => {
    navigator.clipboard?.writeText(`${heading}\n\n${body}`).then(() => {
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1600)
    }).catch(() => {})
  }
  return (
    <>
    <section className="learnings-intro" aria-label="Learnings introduction">
      <h1>{introHeading}</h1>
      <RevealText as="p" className="learnings-intro-text" text={introText} trigger="inView" />
    </section>
    <section ref={section} className="learnings" aria-label="Learnings">
      <div className="learnings-head">
        <h2>{heading}</h2>
        <div className="learnings-tabs" role="tablist" aria-label="View">
          <button type="button" role="tab" aria-selected="true" className="learnings-tab" data-active="true">{tabs[0]}</button>
          {tabs[1] && <button type="button" role="tab" aria-selected="false" aria-disabled="true" className="learnings-tab">{tabs[1]}</button>}
          <button type="button" className="learnings-tab learnings-ai" onClick={copy} aria-label="Copy the article for an AI">
            <span>{copied ? "copied" : aiLabel}</span>
            <img src="/images/learnings/icon-copy.svg" alt="" width={16} height={16} />
          </button>
          {tabs[2] && <button type="button" role="tab" aria-selected="false" aria-disabled="true" className="learnings-tab">{tabs[2]}</button>}
        </div>
      </div>
      <div className="learnings-body">
        <article className="learnings-article">
          <img className="learnings-skull" src="/images/learnings/skull-large.svg" alt="" width={44} height={50} />
          <RevealText as="div" className="learnings-text" text={body} trigger="inView" />
        </article>
        <DotRule surface={section} className="learnings-rule" />
        <aside className="learnings-panel">
          <div className="learnings-images">
            {images.map((src, i) => (
              <div key={i} className="learnings-image"><RevealImage src={src} alt="" trigger="inView" seed={7 + i} style={{ position: "absolute", inset: 0 }} /></div>
            ))}
          </div>
          <DotRule surface={section} className="learnings-rule" />
          <div className="learnings-side">
            <div className="learnings-side-title">
              <img src="/images/learnings/skull-small.svg" alt="" width={21} height={24} />
              <RevealText as="h2" text={sideTitle} trigger="inView" />
            </div>
            {sideLines.map(line => <RevealText key={line} as="p" className="learnings-side-line" text={line} trigger="inView" />)}
          </div>
        </aside>
      </div>
    </section>
    </>
  )
}
