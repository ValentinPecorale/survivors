/**
 * The whole typewriter animation as a pure function of an integer step. Ported from the DeleteWrite
 * exploration (its timeline only: no input handling, no caret, no looping).
 *
 * For words [A, B, C]:
 *   step 0            "A" fully written (rest state)
 *   `hold` steps      "A" stays fully written: time to read it
 *   A.length steps    one letter deleted per step, until ""
 *   `beat` steps      empty
 *   B.length steps    one letter typed per step
 *   ...and so on; the last word fully typed is the end (step === total).
 * Because the state is derived, scrolling backwards is free: it just undoes keypresses.
 */

export type TypePhase = "idle" | "deleting" | "empty" | "typing"

export interface TypeState {
  text: string
  wordIndex: number
  phase: TypePhase
}

export interface Timeline {
  /** Number of keypresses from the first word fully written to the last word fully written. */
  total: number
  stateAt: (step: number) => TypeState
}

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null

/** User-perceived characters, so an emoji or an accented letter is one keypress. */
const graphemes = (word: string): string[] => segmenter ? Array.from(segmenter.segment(word), s => s.segment) : Array.from(word)

export function buildTimeline(rawWords: readonly string[], rawBeat: number, rawHold = 0): Timeline {
  const words = rawWords.map(graphemes).filter(w => w.length > 0)
  const n = words.length
  const beat = Math.max(0, Math.floor(rawBeat))
  const hold = Math.max(0, Math.floor(rawHold))
  if (n === 0) {
    const none: TypeState = { text: "", wordIndex: 0, phase: "idle" }
    return { total: 0, stateAt: () => none }
  }

  const segStart: number[] = []
  const segLen: number[] = []
  let total = 0
  for (let k = 0; k < n - 1; k++) {
    const len = hold + words[k].length + beat + words[k + 1].length
    segStart.push(total); segLen.push(len); total += len
  }

  const stateAt = (raw: number): TypeState => {
    const step = Math.min(Math.max(Math.floor(raw), 0), total)
    if (total === 0 || step >= total) return { text: words[n - 1].join(""), wordIndex: n - 1, phase: "idle" }
    let k = n - 2
    for (let i = 0; i < segStart.length; i++) if (step < segStart[i] + segLen[i]) { k = i; break }
    const o = step - segStart[k]
    const cur = words[k], next = words[k + 1]
    if (o <= hold) return { text: cur.join(""), wordIndex: k, phase: "idle" }
    const d = o - hold // keypresses since the rest ended
    if (d <= cur.length) return { text: cur.slice(0, cur.length - d).join(""), wordIndex: k, phase: cur.length - d === 0 ? "empty" : "deleting" }
    if (d <= cur.length + beat) return { text: "", wordIndex: k, phase: "empty" }
    return { text: next.slice(0, d - cur.length - beat).join(""), wordIndex: k + 1, phase: "typing" }
  }

  return { total, stateAt }
}
