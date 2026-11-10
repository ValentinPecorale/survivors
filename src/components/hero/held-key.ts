"use client"

import { useEffect, useState } from "react"

/** Elements where typing is for the user, not for the ASCII glyphs. */
function isEditable(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
}

/**
 * The printable character currently held down, or null. With several keys
 * held the most recent wins; releasing it falls back to the one still held.
 * Shortcuts (ctrl/meta/alt), space and typing inside form fields are ignored.
 */
export function useHeldKey(): string | null {
  const [held, setHeld] = useState<string[]>([])

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isEditable(event.target)) return
      const key = event.key
      if (key.length !== 1 || key === " ") return
      setHeld(current => (current[current.length - 1] === key ? current : [...current.filter(k => k !== key), key]))
    }
    const up = (event: KeyboardEvent) => {
      // Shift can change event.key between down and up (q / Q), so match case-insensitively.
      setHeld(current => current.filter(k => k.toLowerCase() !== event.key.toLowerCase()))
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
