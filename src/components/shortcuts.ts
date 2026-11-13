/**
 * Home, About, Services and Work use the A W S D keyboard cluster.
 * These never type ASCII glyphs.
 */
export const SHORTCUT_KEYS = ["a", "w", "s", "d"] as const

export const isShortcutKey = (key: string) => (SHORTCUT_KEYS as readonly string[]).includes(key.toLowerCase())
