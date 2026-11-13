/**
 * Two layers, both Web Audio (one shared AudioContext):
 *
 *  Ambient   – "night in the sea cave", 156s, plain loop with fades in/out.
 *  Footsteps – the recorded run, kept locked to the tiger's stride rather than free-running.
 *
 * Footstep sync: the recording has a strong beat every 0.5s (16 beats between 0.565s and 8.565s, so that
 * slice loops seamlessly). The tiger strides every 0.5417s (20 per 10.83s loop). We play the slice at
 * rate = 0.5 / 0.5417 × animation speed so one beat is one stride, then compare beat phase to the clip
 * clock every frame; if it drifts more than 40ms (seek, pause, tab switch) the source is crossfaded to
 * the right position over 25ms.
 */

const FOOT_URL = "/audio/tiger-footsteps.mp3"
const AMBIENT_URL = "/audio/sea-cave.mp3"

export const STRIDE = 10.833333 / 20
/** Strong beat in the recording: first at 0.565s, every 0.5s. Loop slice = 16 whole beats. */
const BEAT = 0.5
const ANCHOR = 0.565
const LOOP_START = ANCHOR
const LOOP_END = ANCHOR + 16 * BEAT
/** The recording peaks at −24dB; this lifts it so the panel's 0–1 slider spans a useful range. */
const FOOT_LIFT = 8
/** First paw contact in each stride (hind-left, measured from the GLB). The strong beat is aligned to it. */
const STRIDE_HIT = 0.104

let ctx: AudioContext | null = null
const buffers: Record<string, AudioBuffer | Promise<AudioBuffer | null> | null> = {}

function context() {
  if (typeof window === "undefined") return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  return ctx
}

/** Call from a user gesture (panel toggle, or the first click/key afterwards) or browsers keep audio suspended. */
export function unlockAudio() {
  const c = context()
  if (c && c.state === "suspended") void c.resume()
}

/** Returns the decoded buffer, or null while it is still downloading/decoding (the next call picks it up). */
function load(url: string): AudioBuffer | null {
  const c = context()
  if (!c) return null
  const cached = buffers[url]
  if (cached instanceof AudioBuffer) return cached
  if (cached === undefined) {
    buffers[url] = fetch(url).then(r => r.arrayBuffer()).then(data => c.decodeAudioData(data)).then(buffer => { buffers[url] = buffer; return buffer }).catch(() => { buffers[url] = null; return null })
  }
  return null
}

// ─── Ambient ───────────────────────────────────────────────────────────────
let ambient: { source: AudioBufferSourceNode; gain: GainNode } | null = null

export function updateAmbient(enabled: boolean, volume: number) {
  const c = context()
  if (!c || c.state !== "running") return
  if (enabled && volume > 0) {
    if (!ambient) {
      const buffer = load(AMBIENT_URL)
      if (!buffer) return
      const source = c.createBufferSource()
      const gain = c.createGain()
      source.buffer = buffer; source.loop = true
      gain.gain.value = 0.0001
      source.connect(gain).connect(c.destination)
      source.start()
      ambient = { source, gain }
    }
    ambient.gain.gain.setTargetAtTime(volume * volume, c.currentTime, 0.5) // squared: the slider feels even in loudness
  } else if (ambient) {
    const { source, gain } = ambient
    ambient = null
    gain.gain.setTargetAtTime(0.0001, c.currentTime, 0.4)
    source.stop(c.currentTime + 2)
  }
}

// ─── Footsteps ─────────────────────────────────────────────────────────────
type Run = { source: AudioBufferSourceNode; gain: GainNode; pos: number; last: number; rate: number }
let run: Run | null = null

const wrapLoop = (pos: number) => pos < LOOP_START ? pos : LOOP_START + ((pos - LOOP_START) % (LOOP_END - LOOP_START))
/** → [-0.5, 0.5) */
const wrap01 = (x: number) => x - Math.floor(x + 0.5)

function stopRun(c: AudioContext, fade = 0.06) {
  if (!run) return
  const old = run
  run = null
  old.gain.gain.cancelScheduledValues(c.currentTime)
  old.gain.gain.setTargetAtTime(0.0001, c.currentTime, fade / 3)
  old.source.stop(c.currentTime + fade * 2)
}

function startRun(c: AudioContext, buffer: AudioBuffer, pos: number, rate: number, level: number) {
  const source = c.createBufferSource()
  const gain = c.createGain()
  source.buffer = buffer; source.loop = true
  source.loopStart = LOOP_START; source.loopEnd = LOOP_END
  source.playbackRate.value = rate
  gain.gain.setValueAtTime(0.0001, c.currentTime)
  gain.gain.linearRampToValueAtTime(level, c.currentTime + 0.025)
  source.connect(gain).connect(c.destination)
  source.start(0, pos)
  run = { source, gain, pos, last: c.currentTime, rate }
}

/** Call every frame with the tiger clip's time. */
export function updateSteps(o: { enabled: boolean; playing: boolean; volume: number; speed: number; clipTime: number; offset: number }) {
  const c = context()
  if (!c || c.state !== "running") return
  if (!o.enabled || !o.playing || o.volume <= 0 || o.speed <= 0) { stopRun(c); return }
  const buffer = load(FOOT_URL)
  if (!buffer) return
  const rate = (BEAT / STRIDE) * o.speed
  const level = o.volume * o.volume * FOOT_LIFT
  // Where the strong beat should be right now, as a fraction of a stride.
  const target = (o.clipTime - STRIDE_HIT - o.offset) / STRIDE
  const posFor = (phase: number) => wrapLoop(ANCHOR + (phase - Math.floor(phase)) * BEAT + 8 * BEAT)

  if (!run) { startRun(c, buffer, posFor(target), rate, level); return }
  const now = c.currentTime
  run.pos = wrapLoop(run.pos + (now - run.last) * run.rate); run.last = now
  const have = (run.pos - ANCHOR) / BEAT
  const error = wrap01(target - have)
  if (Math.abs(error * STRIDE) > 0.04) {
    const next = wrapLoop(run.pos + error * BEAT)
    stopRun(c, 0.025)
    startRun(c, buffer, next, rate, level)
    return
  }
  if (Math.abs(run.rate - rate) > 1e-3) { run.source.playbackRate.setTargetAtTime(rate, now, 0.03); run.rate = rate }
  run.gain.gain.setTargetAtTime(level, now, 0.05)
}
