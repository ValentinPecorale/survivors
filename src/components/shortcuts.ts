/**
 * Home, About, Services and Work use the A W S D keyboard cluster; M toggles the sound.
 * These never type ASCII glyphs.
 */
export const SHORTCUT_KEYS = ["a", "w", "s", "d"] as const

/** Learnings opens with L (the cluster keys are taken). */
export const LEARNINGS_KEY = "l"

/** Sound on/off (the navbar speaker button shows it as [M]). */
export const SOUND_KEY = "m"

export const isShortcutKey = (key: string) => (SHORTCUT_KEYS as readonly string[]).includes(key.toLowerCase()) || key.toLowerCase() === SOUND_KEY || key.toLowerCase() === LEARNINGS_KEY
