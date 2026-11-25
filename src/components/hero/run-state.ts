/**
 * Shared between the forest (hero-scene) and the tiger while the sky view is up. The forest and the searchlights stop (their clip
 * slows to a halt with skyLook.progress); the tiger keeps running, and since the ground no longer moves under it, it travels at the
 * ground's old speed along its run direction until it leaves the frame. Mutable on purpose: no React render per frame.
 */
export const runState = {
  /** The forest clip's time, so the tiger can re-sync its gait while it is off-screen. */
  forestTime: 0,
  /** Distance the tiger has run ahead of its resting place, in world units (negative = still behind it, coming back in). */
  travel: 0,
  /** Ground speed of the forest treadmill: the searchlights move 68.75 units per 10.83 s loop. */
  groundSpeed: 68.75 / 10.833333333333334,
}
