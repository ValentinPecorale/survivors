"use client"

import { useEffect, useState } from "react"
import { isShortcutKey } from "../shortcuts"

/** Elements where typing is for the user, not for the ASCII glyphs. */
function isEditable(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || /^(TEXTAREA|SELECT)$/.test(target.tagName) || (target instanceof HTMLInputElement && !/^(range|checkbox|radio|color|button)$/.test(target.type)))
}

/** Each key gets one random colour the first time it is pressed and keeps it for the session (q and Q share one). */
const keyColors = new Map<string, string>()

/** Random but always legible on black: any hue, strong saturation, mid-high lightness. */
function randomColor() {
  const h = Math.random() * 360, s = 0.85, l = 0.62
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l - (s * Math.min(l, 1 - l)) * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255).toString(16).padStart(2, "0")
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function colorFor(key: string) {
  const id = key.toLowerCase()
  let color = keyColors.get(id)
  if (!color) { color = randomColor(); keyColors.set(id, color) }
  return color
}

export type HeldKey = { key: string; color: string }

/**
 * The printable character currently held down, with its colour, or null. With
 * several keys held the most recent wins; releasing it falls back to the one
 * still held. Nav shortcuts (A W S), ctrl/meta/alt, space and typing inside
 * form fields are ignored.
 */
export function useHeldKey(): HeldKey | null {
  const [held, setHeld] = useState<HeldKey[]>([])

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isEditable(event.target)) return
      const key = event.key
      if (key.length !== 1 || key === " " || isShortcutKey(key)) return
      setHeld(current => (current[current.length - 1]?.key === key ? current : [...current.filter(k => k.key !== key), { key, color: colorFor(key) }]))
    }
    const up = (event: KeyboardEvent) => {
      // Shift can change event.key between down and up (q / Q), so match case-insensitively.
      setHeld(current => current.filter(k => k.key.toLowerCase() !== event.key.toLowerCase()))
    }
    const clear = () => setHeld([])
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", clear)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", clear)
    }
  }, [])

  return held[held.length - 1] ?? null
}
