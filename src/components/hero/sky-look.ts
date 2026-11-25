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
  /** The step the user has asked for: 0 side view, 1 the searchlight (camera on the lamp, chrome revealed), 2 the sky (lamp lit, camera on the projection). */
  want: 0 as 0 | 1 | 2,
  /** Leaving was asked for by navigation (Home, Esc, a section): skip the retrace and go straight back. */
  skip: false,
}

import { useSyncExternalStore } from "react"

/** The navbar shows Contact as the current place for as long as the sky view is up (target > 0), so it re-renders when that flips. */
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(listener => listener())
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export const useSkyActive = () => useSyncExternalStore(subscribe, () => skyLook.target > 0, () => false)
/** The searchlight lets the sky view go once the way back has finished (see searchlights.tsx). */
export function releaseSkyLook() { skyLook.scrubbing = false; skyLook.target = 0; emit() }

/** Navigation and Contact: straight to the sky (every step plays in order) or straight back, no retrace. */
export const setSkyLook = (on: boolean) => {
  skyLook.scrubbing = false; skyLook.target = on ? 1 : 0
  skyLook.want = on ? 2 : 0; skyLook.skip = !on
  emit()
}
export const toggleSkyLook = () => setSkyLook(skyLook.target < 0.5)
export const skyLooking = () => skyLook.target > 0

/**
 * One scroll gesture = one step. Up: side view -> searchlight -> sky. Down retraces it: sky -> searchlight -> side view.
 * The camera and the effects play the way back in reverse order (see searchlights.tsx, which lets `target` go once the last effect has reversed).
 * Returns whether the gesture was taken.
 */
export function stepSkyView(direction: 1 | -1) {
  if (direction > 0) {
    skyLook.skip = false; skyLook.scrubbing = false
    skyLook.want = Math.min(2, skyLook.want + 1) as 1 | 2
    skyLook.target = 1
    emit()
    return true
  }
  if (skyLook.target === 0) return false
  skyLook.skip = false
  skyLook.want = Math.max(0, skyLook.want - 1) as 0 | 1
  return true
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
