/**
 * Synthesised tiger footfall: no audio asset to download, so zero bytes and no decode cost.
 * Two layers per step, like a real paw landing on dry ground:
 *   body  – sine that drops ~90Hz → 45Hz over 140ms (the weight)
 *   pad   – lowpassed noise burst, 70ms (the fur/dust texture)
 * Pitch and level are randomised a little per step so the loop never sounds like a machine.
 */

/** The GLB's camera dip bottoms out once per stride: 0.375s, then every 0.5417s (20 per 10.83s loop). */
export const STEP_FIRST = 0.375
export const STEP_PERIOD = 10.833333 / 20
export const STEPS_PER_LOOP = 20

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noise: AudioBuffer | null = null

/** Must be called from a user gesture the first time (the panel toggle) or browsers keep it suspended. */
export function unlockStepSound() {
  if (typeof window === "undefined") return
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    ctx = new Ctor()
    master = ctx.createGain()
    master.connect(ctx.destination)
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.1), ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  if (ctx.state === "suspended") void ctx.resume()
}

export function playStep(volume: number) {
  if (!ctx || !master || !noise || ctx.state !== "running" || volume <= 0) return
  const t = ctx.currentTime
  const pitch = 0.92 + Math.random() * 0.16
  const level = volume * (0.85 + Math.random() * 0.3)
  master.gain.value = 1

  const body = ctx.createOscillator()
  const bodyGain = ctx.createGain()
  body.type = "sine"
  body.frequency.setValueAtTime(90 * pitch, t)
  body.frequency.exponentialRampToValueAtTime(45 * pitch, t + 0.14)
  bodyGain.gain.setValueAtTime(0.0001, t)
  bodyGain.gain.exponentialRampToValueAtTime(level * 0.5, t + 0.008)
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
  body.connect(bodyGain).connect(master)
  body.start(t); body.stop(t + 0.18)

  const pad = ctx.createBufferSource()
  const padFilter = ctx.createBiquadFilter()
  const padGain = ctx.createGain()
  pad.buffer = noise
  padFilter.type = "lowpass"
  padFilter.frequency.value = 420 * pitch
  padGain.gain.setValueAtTime(0.0001, t)
  padGain.gain.exponentialRampToValueAtTime(level * 0.35, t + 0.005)
  padGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)
  pad.connect(padFilter).connect(padGain).connect(master)
  pad.start(t); pad.stop(t + 0.1)
}
