"use client"

import Link from "next/link"
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react"
import { useDotGrid } from "./dot-grid"
import { useGradientSettings } from "./gradient-settings"
import RevealText from "./reveal-text"
import { FooterDuty } from "./footer-duty"
import footer from "@/content/footer.json"

/** A link or a plain label: an empty href is shown but not clickable (same rule as the logo strip and the project cards). */
function Item({ href, className, children, button }: { href: string; className?: string; children: ReactNode; button?: boolean }) {
  const target = href.trim()
  // Without a destination a button stays a real <button> (like the navbar's Contact), so it keeps its hover, focus and press states.
  if (!target) return button ? <button type="button" className={className}>{children}</button> : <span className={className}>{children}</span>
  // "#name" is a place on the One page: the navbar opens the About card (if needed) and scrolls to it, like the navbar buttons.
  if (target.startsWith("#")) return <a className={className} href={`/about${target}`} onClick={event => { event.preventDefault(); window.dispatchEvent(new CustomEvent("survivors:go", { detail: target.slice(1) })) }}>{children}</a>
  if (target.startsWith("/")) return <Link className={className} href={target} scroll={false}>{children}</Link>
  return <a className={className} href={target} target="_blank" rel="noopener noreferrer">{children}</a>
}

/**
 * A 1.3px dot on a strip whose top edge sits at a fractional device pixel is smeared over two pixel rows, so that strip reads fainter than its neighbours.
 * Shift each strip's tile origin so the dots always start on a whole device pixel — every row then paints the identical crisp dot.
 */
function snapDots(root: HTMLElement) {
  const dpr = window.devicePixelRatio || 1
  root.querySelectorAll<HTMLElement>(".footer-link-dots, .footer-link-fill").forEach(el => {
    el.style.backgroundPosition = "0 0"
    const r = el.getBoundingClientRect()
    const fx = r.left * dpr, fy = r.top * dpr
    const dx = (Math.ceil(fx - 1e-3) - fx) / dpr, dy = (Math.ceil(fy - 1e-3) - fy) / dpr
    el.style.backgroundPosition = `${dx}px ${dy}px`
  })
}

/** Footer navigation: page link, three-row dot strip, optional social link; one dot pitch between rows. */
export function SiteFooter() {
  const section = useRef<HTMLElement>(null)
  const s = useGradientSettings()
  useDotGrid(section)

  // The height of both halves, in dot rows: the sentence plus the bottom line, rounded up to whole rows, never less than the right half needs.
  useEffect(() => {
    const root = section.current
    const text = root?.querySelector<HTMLElement>(".site-footer-text")
    if (!root || !text) return
    const measure = () => {
      const dot = parseFloat(root.style.getPropertyValue("--dot-h"))
      if (!(dot > 0)) return
      // The gap between rows is whole dot pitches (the panel value, rounded), so the dot lattice runs unbroken from strip to strip at every width.
      const pitch = dot / 2
      const gap = s.ftVerticalGap <= 0 ? 0 : Math.max(1, Math.round(s.ftVerticalGap / pitch)) * pitch
      root.style.setProperty("--ft-row-gap", `${gap}px`)
      // The footer tile has two visible dot rows per layout unit: three dots = 1.5 units, plus seven gaps of one dot pitch.
      const ctaHeight = root.querySelector<HTMLElement>(".site-footer-call")?.getBoundingClientRect().height ?? s.ftCtaLine
      const least = ctaHeight / dot + 6 * 1.5 + Math.max(1.5, s.ftSpacer) + 7 * gap / dot
      const need = Math.ceil((text.getBoundingClientRect().height + s.ftRows * dot) / dot)
      root.style.setProperty("--ft-total-rows", String(Math.max(least, need)))
      snapDots(root)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(text)
    window.addEventListener("resize", measure)
    return () => { ro.disconnect(); window.removeEventListener("resize", measure) }
  }, [s.ftVerticalGap, s.ftCtaLine, s.ftCtaSize, s.ftRows, s.ftSpacer, s.ftTextSize, s.ftTextLine])

  // Every number of the Footer tab in the properties panel, as variables the stylesheet reads.
  const vars = {
    "--ft-bg": s.ftBg, "--ft-knock": `${s.ftKnock}px`, "--ft-rows": s.ftRows, "--ft-cta-rows": s.ftCtaRows, "--ft-cta-size": `${s.ftCtaSize}px`, "--ft-cta-line": `${s.ftCtaLine}px`, "--ft-spacer": s.ftSpacer, "--ft-icon-gap": `${s.ftIconGap}px`,
    "--ft-text-size": `${s.ftTextSize}px`, "--ft-text-line": `${s.ftTextLine}px`,
    "--ft-link-size": `${s.ftLinkSize}px`, "--ft-link-track": `${s.ftLinkTrack}em`, "--ft-small-size": `${s.ftSmallSize}px`,
    "--ft-vertical-gap": `${s.ftVerticalGap}px`, "--ft-pad": `${s.ftPad}px`, "--ft-gap": `${s.ftGap}px`,
    "--ft-text-color": s.ftTextColor, "--ft-link-color": s.ftLinkColor, "--ft-cta-color": s.ftCtaColor, "--ft-state-bg": s.ftStateBg, "--ft-state-text": s.ftStateText, "--ft-hover-color": s.ftHoverColor, "--ft-small-color": s.ftSmallColor,
  } as CSSProperties
  return (
    <><FooterDuty /><footer ref={section} className="site-footer" aria-label="Footer" data-dots={s.ftDots ? undefined : "off"} style={vars}>
      <div className="site-footer-lead">
        <RevealText as="p" className="site-footer-text" text={footer.text} trigger="inView" />
        <p className="site-footer-note">{footer.location}. {footer.copyright}</p>
      </div>
      <div className="footer-link-layout">
        <div className="site-footer-row site-footer-row--cta">
          <Item button href={footer.call.href} className="site-footer-cta site-footer-call">{footer.call.label}</Item>
          <span className="footer-link-dots footer-call-dots" aria-hidden="true" />
        </div>
        <div className="footer-link-fill" aria-hidden="true" />
        <nav aria-label="Footer" className="footer-link-stack">
          {footer.links.map((link, index) => {
            const social = footer.socials.toReversed()[index - (footer.links.length - footer.socials.length)]
            return <div className="footer-link-row" key={link.label}>
              <Item button href={link.href} className="site-footer-cta footer-link-button">{link.label}</Item>
              <span className="footer-link-dots" aria-hidden="true" />
              {social && <Item href={social.href} className="site-footer-cta footer-link-button footer-social-button">{social.label}</Item>}
            </div>
          })}
        </nav>
      </div>
    </footer></>
  )
}
