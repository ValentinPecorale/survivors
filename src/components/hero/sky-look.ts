/**
 * The hero camera has three views along one scroll axis:
 *
 *   scroll up   ← SKY  ·  SIDE (start)  ·  ZENITH →  scroll down (scrollCamera in card-settings.ts, with the About card)
 *
 * The sky is a pitch about the camera's own horizontal axis, applied last on top of the framing. `target` is the position on the
 * sky half of the axis (0 = side view, 1 = sky). Scrolling drives it 1:1 like the zenith side; Contact sends it there on a slower glide.
 * Mutable on purpose, like scrollCamera: no React render per frame.
 */
export const skyLook = {
  /** 0 = side view, 1 = looking at the sky. */
  target: 0,
  /** Where the camera is now, following `target`. */
  progress: 0,
  /** How far the camera pitches up at 1. 68° clears the tree line and leaves the horizon just out of frame. */
  pitchDeg: 68,
  /** Follow time constant while Contact / Home move it: ~95% of the way in 3τ ≈ 1.5s, a head lifting. */
  glideSeconds: 0.5,
  /** Follow time constant while scrolling: ~90ms, only enough to smooth wheel notches (same as the card scrub). */
  scrubSeconds: 0.09,
  /** Which constant is live. */
  scrubbing: false,
}

export const setSkyLook = (on: boolean) => { skyLook.scrubbing = false; skyLook.target = on ? 1 : 0 }
export const toggleSkyLook = () => setSkyLook(skyLook.target < 0.5)
export const skyLooking = () => skyLook.target > 0

/** Scroll input in sky units (1 = the full move). Positive looks further up. */
export const scrubSky = (amount: number) => {
  skyLook.scrubbing = true
  skyLook.target = Math.min(1, Math.max(0, skyLook.target + amount))
}

/** Advance toward the target by `delta` seconds; returns the amount (0..1). */
export function stepSky(delta: number, instant: boolean) {
  if (instant) skyLook.progress = skyLook.target
  else {
    const tau = skyLook.scrubbing ? skyLook.scrubSeconds : skyLook.glideSeconds
    skyLook.progress += (skyLook.target - skyLook.progress) * (1 - Math.exp(-Math.min(delta, 0.1) / tau))
    if (Math.abs(skyLook.target - skyLook.progress) < 0.0005) skyLook.progress = skyLook.target
  }
  return skyLook.progress
}
