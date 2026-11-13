/**
 * Two layers, both Web Audio (one shared AudioContext):
 *
 *  Music     – selectable track (Sleepy cowboy / Night in the sea cave), plain loop with fades in/out.
 *  Footsteps – the recorded run, kept locked to the tiger's stride rather than free-running.
 *
 * Footstep sync: the recording has a strong beat every 0.5s (16 beats between 0.565s and 8.565s, so that
 * slice loops seamlessly). The tiger strides every 0.5417s (20 per 10.83s loop). We play the slice at
 * rate = 0.5 / 0.5417 × animation speed so one beat is one stride, then compare beat phase to the clip
 * clock every frame; if it drifts more than 40ms (seek, pause, tab switch) the source is crossfaded to
 * the right position over 25ms.
 */

const FOOT_URL = "/audio/tiger-footsteps.mp3"
/** Music tracks. `trim` evens out loudness between files so the volume slider means the same thing for each. */
export const TRACKS = {
  cowboy: { label: "Sleepy cowboy", url: "/audio/sleepy-cowboy.mp3", trim: 0.55 },
  cave: { label: "Night in the sea cave", url: "/audio/sea-cave.mp3", trim: 1 },
} as const
export type TrackId = keyof typeof TRACKS

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
let ambient: { id: string; source: AudioBufferSourceNode; gain: GainNode } | null = null

function fadeOutAmbient(c: AudioContext) {
  if (!ambient) return
  const { source, gain } = ambient
  ambient = null
  gain.gain.cancelScheduledValues(c.currentTime)
  gain.gain.setTargetAtTime(0.0001, c.currentTime, 0.4)
  source.stop(c.currentTime + 2)
}

export function updateAmbient(enabled: boolean, volume: number, track: string) {
  const c = context()
  if (!c || c.state !== "running") return
  const def = TRACKS[track as TrackId] ?? TRACKS.cowboy
  if (enabled && volume > 0) {
    if (ambient && ambient.id !== def.url) fadeOutAmbient(c) // song changed: old one fades while the new one fades in
    if (!ambient) {
      const buffer = load(def.url)
      if (!buffer) return
      const source = c.createBufferSource()
      const gain = c.createGain()
      source.buffer = buffer; source.loop = true
      gain.gain.value = 0.0001
      source.connect(gain).connect(c.destination)
      source.start()
      ambient = { id: def.url, source, gain }
    }
    ambient.gain.gain.setTargetAtTime(volume * volume * def.trim, c.currentTime, 0.5) // squared: the slider feels even in loudness
  } else fadeOutAmbient(c)
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

// ─── Plant hover rustle ────────────────────────────────────────────────────
let rustleNoise: AudioBuffer | null = null

const RUSTLE = {
  // centre frequency of the band, Q, grain length (s), number of crackle grains
  ear: { freq: 5400, q: 0.9, length: 0.14, grains: 3, gain: 0.7 },   // grass heads: light, high swish
  grove: { freq: 3300, q: 0.7, length: 0.2, grains: 4, gain: 0.9 },  // undergrowth: leafy crackle
  tree: { freq: 1700, q: 0.6, length: 0.3, grains: 4, gain: 1.0 },   // canopy: lower, longer
} as const

/**
 * Synthesised leaf rustle: a few overlapping bandpassed noise grains with random timing, level and pitch, so
 * no two hovers sound alike. `pan` is −1…1 (where the plant is on screen).
 */
export function playRustle(kind: keyof typeof RUSTLE, volume: number, pan: number) {
  const c = context()
  if (!c || c.state !== "running" || volume <= 0) return
  if (!rustleNoise) {
    rustleNoise = c.createBuffer(1, c.sampleRate, c.sampleRate)
    const data = rustleNoise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  const r = RUSTLE[kind]
  const t = c.currentTime
  const out = c.createStereoPanner()
  out.pan.value = Math.max(-1, Math.min(1, pan))
  out.connect(c.destination)
  for (let i = 0; i < r.grains; i++) {
    const start = t + i * (r.length * 0.45) + Math.random() * 0.02
    const length = r.length * (0.7 + Math.random() * 0.6)
    const source = c.createBufferSource()
    const band = c.createBiquadFilter()
    const gain = c.createGain()
    source.buffer = rustleNoise
    band.type = "bandpass"
    band.Q.value = r.q
    band.frequency.setValueAtTime(r.freq * (0.85 + Math.random() * 0.3), start)
    band.frequency.exponentialRampToValueAtTime(r.freq * 0.7, start + length)
    const peak = volume * volume * r.gain * (0.5 + Math.random() * 0.5) * 1.4
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(peak, start + length * 0.2)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
    source.connect(band).connect(gain).connect(out)
    source.start(start, Math.random() * 0.6, length + 0.05)
  }
}
