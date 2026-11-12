/**
 * Letters that open a nav card. Ordered like the keyboard cluster (A W S D);
 * three buttons use A, W, S and D stays free. These never type ASCII glyphs.
 */
export const SHORTCUT_KEYS = ["a", "w", "s"] as const

export const isShortcutKey = (key: string) => (SHORTCUT_KEYS as readonly string[]).includes(key.toLowerCase())
