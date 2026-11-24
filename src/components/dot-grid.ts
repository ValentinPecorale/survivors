import { useEffect, type RefObject } from "react"
import { useGradientSettings, type GradientSettings } from "./gradient-settings"

/** The dot grid's tile: one dot in a tiny canvas, sized in whole DEVICE pixels (see the note in featured-projects.tsx). */
export function dotTile(g: GradientSettings, cardWidth: number) {
  const dpr = window.devicePixelRatio || 1
  const cellW = Math.max(2, cardWidth / g.dotsColumns), cellH = cellW * g.dotsRatio
  const w = Math.max(2, Math.round(cellW * dpr)), h = Math.max(2, Math.round(cellH * dpr))
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  const [r, gr, bl] = [1, 3, 5].map(i => parseInt(g.dotsColor.slice(i, i + 2), 16))
  ctx.fillStyle = `rgba(${r},${gr},${bl},${g.dotsOpacity})`
  const d = g.dotsSize * dpr
  ctx.fillRect(Math.round(w / 2 - d / 2), Math.round(h / 2 - d / 2), d, d) // origin on a whole device pixel, like the separators' canvas: the same crisp dot everywhere
  return { url: canvas.toDataURL(), w: w / dpr, h: h / dpr }
}

/**
 * The same dot grid for any page: publishes --strip-dots (fully opaque tile, to mask a gradient), --grey-dots (the footer tile), --dot-w and --dot-h on `target`, computed for a card-wide cell
 * (the width of one of the two Featured Projects cards, so the pitch is identical everywhere). Rebuilt on resize, zoom and panel changes.
 */
export function useDotGrid(target: RefObject<HTMLElement | null>) {
  const { dotsColumns, dotsRatio, dotsSize, ftDotsColor, ftDotsOpacity, ftDotsSize } = useGradientSettings()
  useEffect(() => {
    const el = target.current
    if (!el) return
    let query: MediaQueryList | null = null
    const build = () => {
      query?.removeEventListener("change", build)
      query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      query.addEventListener("change", build)
      const root = getComputedStyle(document.documentElement)
      const margin = parseFloat(root.getPropertyValue("--page-margin")) || 32, gutter = parseFloat(root.getPropertyValue("--page-gutter")) || 20
      const phone = window.matchMedia("(max-width: 700px)").matches
      const card = phone ? document.documentElement.clientWidth - 2 * margin : (document.documentElement.clientWidth - 2 * margin - gutter) / 2
      // The layout unit (--dot-w × --dot-h: the footer's text bands are whole numbers of these rows) comes from the grid's own cell shape...
      const tile = card > 0 ? dotTile({ dotsColor: "#FFFFFF", dotsOpacity: 1, dotsColumns, dotsRatio, dotsSize } as GradientSettings, card) : null
      // ...but the dots themselves are painted on SQUARE cells, half a layout row apart, so every grid on the site (cards, footer, rules) shows the same dense grid.
      const square = card > 0 ? dotTile({ dotsColor: "#FFFFFF", dotsOpacity: 1, dotsColumns, dotsRatio: 1, dotsSize } as GradientSettings, card) : null
      // The plain grid of the footer (its dot colour and opacity from the panel; the designs use #8E8E8E), for fields that do not carry a gradient.
      const grey = card > 0 ? dotTile({ dotsColor: ftDotsColor, dotsOpacity: ftDotsOpacity, dotsColumns, dotsRatio: 1, dotsSize: ftDotsSize } as GradientSettings, card) : null
      // The same dots, pure white and fully opaque: laid over a footer row while its button is hovered.
      const white = card > 0 ? dotTile({ dotsColor: "#FFFFFF", dotsOpacity: 1, dotsColumns, dotsRatio: 1, dotsSize: ftDotsSize } as GradientSettings, card) : null
      if (!tile || !square) return
      if (white) el.style.setProperty("--white-dots", `url(${white.url})`)
      if (grey) el.style.setProperty("--grey-dots", `url(${grey.url})`)
      el.style.setProperty("--strip-dots", `url(${square.url})`)
      el.style.setProperty("--dot-w", `${tile.w}px`)
      // One layout row = exactly two square dot cells, so the painted grid (dot-w × dot-h/2) is the tile at its natural size: whole device pixels, never resampled.
      el.style.setProperty("--dot-h", `${square.h * 2}px`)
    }
    build()
    window.addEventListener("resize", build)
    return () => { window.removeEventListener("resize", build); query?.removeEventListener("change", build) }
  }, [target, dotsColumns, dotsRatio, dotsSize, ftDotsColor, ftDotsOpacity, ftDotsSize])
}
