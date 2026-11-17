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

const listeners = new Set<() => void>()
const emit = () => listeners.forEach(listener => listener())
export const subscribeAudio = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export const getAudioPlaying = () => !!ctx && ctx.state === "running" && !gated && !!ambient
export const getServerAudioPlaying = () => false
export function toggleAudio() {
  if (getAudioPlaying()) setAudioGate(true, 0.08, 0.15)
  else { setAudioGate(false, 0.08, 0.15); unlockAudio() }
}
let ctx: AudioContext | null = null
const buffers: Record<string, AudioBuffer | Promise<AudioBuffer | null> | null> = {}

function context() {
  if (typeof window === "undefined") return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
    ctx.addEventListener("statechange", emit)
  }
  return ctx
}

/** Every sound passes through the navbar playback gate. */
let bus: GainNode | null = null
function output(c: AudioContext) {
  if (!bus) { bus = c.createGain(); bus.connect(c.destination) }
  return bus
}

let gated = false
let gateTimer = 0
/**
 * User playback gate: fade down and suspend the shared context on pause.
 * Resume continues at the same audio position across every route.
 */
export function setAudioGate(closed: boolean, fadeOut: number, fadeIn: number) {
  if (closed === gated) return
  gated = closed
  emit()
  const c = ctx
  if (!c) return // nothing has played yet; the flag alone decides whether unlockAudio may start it
  const gain = output(c).gain
  window.clearTimeout(gateTimer)
  if (closed) {
    const now = c.currentTime, seconds = Math.max(0.05, fadeOut)
    gain.cancelScheduledValues(now)
    gain.setValueAtTime(gain.value, now)
    gain.linearRampToValueAtTime(0, now + seconds)
    gateTimer = window.setTimeout(() => { if (gated) void c.suspend() }, seconds * 1000 + 80)
  } else {
    void c.resume().then(() => {
      if (gated) return
      const now = c.currentTime
      gain.cancelScheduledValues(now)
      gain.setValueAtTime(gain.value, now)
      gain.linearRampToValueAtTime(1, now + Math.max(0.05, fadeIn))
    }).catch(() => {})
  }
}

/** Call from a user gesture (panel toggle, or the first click/key afterwards) or browsers keep audio suspended. */
export function unlockAudio() {
  const c = context()
  if (c && c.state === "suspended" && !gated) void c.resume().catch(() => {})
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
  emit()
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
      source.connect(gain).connect(output(c))
      source.start()
      ambient = { id: def.url, source, gain }
      emit()
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
  source.connect(gain).connect(output(c))
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
  out.connect(output(c))
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

// ─── Hover sound (plays only while the cursor is moving over a plant) ──────
/** Selectable hover sounds. `url` ones are samples; the rest are synthesised. `avoid` is a stretch of the file never played. */
export const HOVER_SOUNDS = {
  digital: { label: "Soft digital process", url: "/audio/soft-digital-process.mp3", lift: 14, avoid: null },
  laboratory: { label: "Futuristic laboratory", url: "/audio/futuristic-laboratory.mp3", lift: 14, avoid: [1.1, 1.35] }, // one loud transient at ~1.2s
  rustle: { label: "Leaf rustle (synth)", url: null, lift: 1, avoid: null },
} as const
export type HoverSoundId = keyof typeof HOVER_SOUNDS

/** Pitch per kind of plant: grass high, undergrowth natural, trees low. */
const HOVER_RATE = { ear: 1.3, grove: 1.0, tree: 0.8 } as const
type HoverKind = keyof typeof HOVER_RATE
const SEGMENT = 0.6 // seconds of sample per segment
const OVERLAP = 0.1 // crossfade between segments
const SILENCE_AFTER = 110 // ms without pointer movement before the sound releases

/** Start fetching/decoding the chosen sample so the first hover is not silent. */
export function preloadHover(id: string) {
  const def = HOVER_SOUNDS[id as HoverSoundId]
  if (def?.url) load(def.url)
}

type HoverVoice = { master: GainNode; panner: StereoPannerNode; nextAt: number; lastMove: number; timer: number; kind: HoverKind; buffer: AudioBuffer; avoid: readonly [number, number] | null }
let hoverVoice: HoverVoice | null = null
let lastRustle = 0

function releaseHover() {
  const c = ctx
  if (!hoverVoice || !c) return
  const voice = hoverVoice
  hoverVoice = null
  window.clearInterval(voice.timer)
  voice.master.gain.cancelScheduledValues(c.currentTime)
  voice.master.gain.setTargetAtTime(0.0001, c.currentTime, 0.04)
  // Segments already scheduled finish silently behind the closed master gain; clean up after the longest one.
  window.setTimeout(() => { voice.master.disconnect(); voice.panner.disconnect() }, (SEGMENT + OVERLAP) * 1000 + 300)
}

/** Random start offset in the file that keeps a segment clear of the avoid stretch. */
function segmentOffset(duration: number, span: number, avoid: readonly [number, number] | null) {
  const max = Math.max(0, duration - span - 0.05)
  if (!avoid) return Math.random() * max
  const before = Math.max(0, avoid[0] - span)
  const after = Math.max(0, max - avoid[1])
  if (before <= 0 && after <= 0) return Math.random() * max
  return Math.random() * (before + after) < before ? Math.random() * before : avoid[1] + Math.random() * after
}

function scheduleSegments(c: AudioContext, voice: HoverVoice) {
  const rate = HOVER_RATE[voice.kind]
  const span = SEGMENT * rate
  while (voice.nextAt < c.currentTime + 0.25) {
    const start = Math.max(voice.nextAt, c.currentTime)
    const source = c.createBufferSource()
    const gain = c.createGain()
    source.buffer = voice.buffer
    source.playbackRate.value = rate * (0.97 + Math.random() * 0.06)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.linearRampToValueAtTime(1, start + OVERLAP)
    gain.gain.setValueAtTime(1, start + SEGMENT - OVERLAP)
    gain.gain.linearRampToValueAtTime(0.0001, start + SEGMENT)
    source.connect(gain).connect(voice.master)
    source.start(start, segmentOffset(voice.buffer.duration, span, voice.avoid), span + 0.05)
    voice.nextAt = start + SEGMENT - OVERLAP
  }
}

/**
 * Call on every pointer movement. `over` is the plant under the cursor (or null). The sound runs only while
 * the pointer is moving over a plant: it fades in within ~30ms, follows cursor speed (slow = quiet,
 * fast = full), and releases ~110ms after the pointer stops or leaves the plant.
 * `speed` is cursor speed in px/s; `pan` is −1…1.
 */
export function hoverMove(id: string, over: HoverKind | null, volume: number, pan: number, speed: number) {
  const c = context()
  if (!c || c.state !== "running" || !over || volume <= 0) { releaseHover(); return }
  const def = HOVER_SOUNDS[id as HoverSoundId] ?? HOVER_SOUNDS.digital
  const now = performance.now()
  if (!def.url) { // synthesised rustle: re-trigger its grains while moving
    if (now - lastRustle > 140) { lastRustle = now; playRustle(over, volume, pan) }
    return
  }
  const buffer = load(def.url)
  if (!buffer) return
  const level = volume * volume * def.lift * (0.3 + 0.7 * Math.min(1, speed / 900))
  if (hoverVoice && hoverVoice.buffer !== buffer) releaseHover() // sound changed in the panel
  if (!hoverVoice) {
    const master = c.createGain()
    const panner = c.createStereoPanner()
    master.gain.value = 0.0001
    master.connect(panner).connect(output(c))
    const voice: HoverVoice = { master, panner, nextAt: c.currentTime, lastMove: now, timer: 0, kind: over, buffer, avoid: def.avoid }
    // Keeps segments coming between pointer events, and releases once the pointer has been still.
    voice.timer = window.setInterval(() => {
      if (performance.now() - voice.lastMove > SILENCE_AFTER) releaseHover()
      else scheduleSegments(c, voice)
    }, 80)
    hoverVoice = voice
  }
  const voice = hoverVoice
  voice.kind = over
  voice.lastMove = now
  voice.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), c.currentTime, 0.05)
  voice.master.gain.setTargetAtTime(level, c.currentTime, 0.03)
  scheduleSegments(c, voice)
}

/** Cursor left the scene or hover was switched off. */
export function hoverStop() { releaseHover() }
