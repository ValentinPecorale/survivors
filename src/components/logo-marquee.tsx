import Link from "next/link"
import { LogoSkull } from "./logo-skull"
import RevealText from "./reveal-text"

/**
 * Client logo strip (Figma 145:1481): an infinite horizontal marquee, in the page's grey (#8E8E8E, baked into the SVGs).
 *
 * Pure CSS: the track holds four identical copies of the set and slides left by exactly one copy (translateX(-25%)) forever, so
 * the loop has no seam and the strip stays full on very wide screens. Nothing runs in JS. Each logo is a link: set the href in the
 * content (Keystatic → About → Logo strip, or about.json); while a link is empty the logo is shown but not clickable. Links that
 * start with "/" stay in the site; anything else opens in a new tab. The copies after the first are hidden from assistive tech and
 * from the tab order. The strip never stops, not even on hover; logos show the alias cursor.
 *
 * The logos are clipped by a frame inset 32px + 61px each side; a rotating chrome skull is centred on each edge of that frame (LogoSkull), so logos vanish behind it and the "Trusted by" label sits under the strip, starting at the centre line.
 *
 * Sizes are the Figma ones (px at desktop); phones scale the whole strip down (see .logo-marquee in globals.css).
 */
export type LogoItem = { id: string; name: string; href: string }

type Part = { src: string; w: number; h: number; x: number; y: number }
type Mark = { w: number; h: number; parts: Part[] }

const MARKS: Record<string, Mark> = {
  obera: {
    w: 148.623, h: 60.931, // the wordmark with its tagline under it
    parts: [
      { src: "/images/logos/obera.svg", w: 148.623, h: 44.444, x: 0, y: 0 },
      { src: "/images/logos/obera-tagline.svg", w: 141.32, h: 12.181, x: 7.07, y: 48.75 },
    ],
  },
  tpg: { w: 83.136, h: 64.891, parts: [{ src: "/images/logos/tpg.svg", w: 83.136, h: 64.891, x: 0, y: 0 }] },
  posada: { w: 114.77, h: 62.887, parts: [{ src: "/images/logos/posada.svg", w: 114.77, h: 62.887, x: 0, y: 0 }] },
  becerro: { w: 252.51, h: 51.184, parts: [{ src: "/images/logos/becerro.svg", w: 252.51, h: 51.184, x: 0, y: 0 }] },
  quiero: { w: 164.032, h: 53.53, parts: [{ src: "/images/logos/quiero.svg", w: 164.032, h: 53.53, x: 0, y: 0 }] },
}

const COPIES = 4
const pct = (n: number, of: number) => `${(n / of) * 100}%`

function Logo({ logo, hidden }: { logo: LogoItem; hidden: boolean }) {
  const mark = MARKS[logo.id]
  if (!mark) return null
  const art = (
    <span className="logo-mark" style={{ "--w": mark.w, "--h": mark.h } as React.CSSProperties}>
      {mark.parts.map(p => (
        // eslint-disable-next-line @next/next/no-img-element -- plain SVG with fixed proportions, nothing to optimise
        <img key={p.src} src={p.src} alt="" width={p.w} height={p.h} draggable={false}
          style={{ left: pct(p.x, mark.w), top: pct(p.y, mark.h), width: pct(p.w, mark.w), height: pct(p.h, mark.h) }} />
      ))}
    </span>
  )
  const href = logo.href.trim()
  if (!href) return <span className="logo-link" title={hidden ? undefined : `${logo.name} (link coming soon)`}>{art}</span>
  const label = hidden ? undefined : logo.name
  if (href.startsWith("/")) return <Link className="logo-link" href={href} aria-label={label} tabIndex={hidden ? -1 : undefined}>{art}</Link>
  return <a className="logo-link" href={href} target="_blank" rel="noopener noreferrer" aria-label={label} tabIndex={hidden ? -1 : undefined}>{art}</a>
}

export function LogoMarquee({ logos, label }: { logos: readonly LogoItem[]; label?: string }) {
  if (!logos.length) return null
  return (
    <section className="logo-marquee" aria-label="Clients">
      <div className="logo-marquee-clip">
      <div className="logo-marquee-track">
        {Array.from({ length: COPIES }, (_, copy) => (
          <ul key={copy} className="logo-marquee-set" aria-hidden={copy > 0 || undefined}>
            {logos.map(logo => <li key={logo.id}><Logo logo={logo} hidden={copy > 0} /></li>)}
          </ul>
        ))}
      </div>
      </div>
      <LogoSkull side="left" direction={1} />
      <LogoSkull side="right" direction={-1} />
      {label && <p className="logo-marquee-title"><RevealText as="span" text={label} trigger="inView" /></p>}
    </section>
  )
}
