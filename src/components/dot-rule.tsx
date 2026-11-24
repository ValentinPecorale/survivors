"use client"

import { useRef, type RefObject } from "react"
import { useGradientSettings } from "./gradient-settings"
import { MeshGradient } from "./highlight-gradient"

/**
 * A vertical rule of the Featured Projects dot grid: one column of the same dots, masking the same live gradient (it follows the cursor over `surface`).
 * The tile comes from useDotGrid on that surface (--strip-dots, --dot-w, --dot-h), so pitch and look match the strip under the cards exactly.
 */
export function DotRule({ surface, className }: { surface: RefObject<HTMLElement | null>; className?: string }) {
  const g = useGradientSettings()
  const box = useRef<HTMLSpanElement>(null)
  const idle = useRef(false)
  return (
    <span ref={box} className={`dot-rule${className ? " " + className : ""}`} aria-hidden="true">
      <MeshGradient settings={g} surface={surface} box={box} idle={idle} />
    </span>
  )
}
