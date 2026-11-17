"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { registerLine } from "./line-gradient"
import { useGradientSettings } from "./gradient-settings"

/**
 * A 1px white line across the whole page. Its own interactive gradient (line-gradient.ts) runs behind it, unseen, and the line
 * is white only where that gradient is white. It works on its own: the white point drifts by itself and the cursor only moves
 * it, it does not reveal anything. Opacity and every gradient setting are in the panel, About tab, Section lines.
 * Browsers without WebGL show the plain white line.
 */
export function SectionLine({ className, style }: { className?: string; style?: CSSProperties }) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [plain, setPlain] = useState(false)
  const { lineOpacity } = useGradientSettings()
  useEffect(() => {
    const w = wrap.current, c = canvas.current
    if (!w || !c) return
    return registerLine(w, c, () => setPlain(true))
  }, [])
  return (
    <div ref={wrap} className={`section-line${plain ? " section-line--plain" : ""}${className ? " " + className : ""}`} style={{ ...style, opacity: lineOpacity }} aria-hidden="true">
      <canvas ref={canvas} />
    </div>
  )
}
