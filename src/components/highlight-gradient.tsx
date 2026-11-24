"use client"

import Image from "next/image"
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react"
import RevealText from "./reveal-text"
import { useGradientSettings, type GradientSettings } from "./gradient-settings"
import { buildTimeline } from "./typewriter-timeline"

/*
 * The interactive mesh gradient from the chrome-gradient exploration, as the backdrop of the About "Websites"
 * word. One fragment shader (rung 5 — the effect is per-pixel colour mixing that no transform can do) on a
 * canvas only ~190×50 css px, so it costs next to nothing; it renders only while the frame is on screen.
 *
 * Differences from the exploration:
 *  - The cursor is tracked over the whole frame and mapped across the gradient's full range, so moving the
 *    mouse anywhere in the frame sweeps the light across the word (the box alone is a tiny target).
 *  - The loop runs only while the frame is visible (IntersectionObserver) and the tab is shown.
 *  - Settings are read from the shared store (panel → Gradient tab), not component state.
 */

const vertex = `attribute vec2 position;
void main() { gl_Position = vec4(position, 0., 1.); }`

// Normalized inverse-distance colour field over warped coordinates: one blended field, not composited layers.
const fragment = `precision highp float;
uniform vec2 resolution;
uniform vec2 cursor;
uniform float phase;
uniform float warp;
uniform float softness;
uniform float size;
uniform float intensity;
uniform float stretch;
uniform vec3 colors[4];
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y)*2.-1.;
}
vec3 linearize(vec3 c) { return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c)); }
vec3 encode(vec3 c) { return mix(c*12.92,1.055*pow(max(c,0.),vec3(1./2.4))-.055,step(vec3(.0031308),c)); }
void main() {
  // Anchored to the box's left edge at a fixed scale (1 unit = half the box height), not stretched to the box width:
  // when the word grows or shrinks the field stays put and the box only reveals more or less of it.
  // stretch = 1 (wide boxes like the Featured Projects title): the whole box width maps onto the field, 7.6 units (a normal word box is ~7.6 units wide).
  vec2 uv = vec2(mix(gl_FragCoord.x/(resolution.y*.5), gl_FragCoord.x/resolution.x*7.6, stretch)-3.5, gl_FragCoord.y/resolution.y*2.-1.);
  vec2 n = uv*(.55+warp*.6+.1*1.6) + 70.3*73.7;
  vec2 flow = vec2(cos(phase),sin(phase))*.16;
  uv += warp*.75*vec2(noise(n+flow),noise(n+vec2(13.7,7.1)+flow));
  vec2 points[4];
  points[0]=cursor;
  points[1]=vec2(1.22,.587);
  points[2]=vec2(.443,-.371);
  points[3]=vec2(-1.089,-.654);
  vec3 color=vec3(0.); float total=0.;
  float core=.08+softness*.22;
  float falloff=4.6-softness*3.4;
  for(int i=0;i<4;i++) {
    float index=float(i+1);
    float harmonic=mod(float(i),2.)<.5?1.:2.;
    vec2 drift=vec2(sin(phase+index*1.3),cos(phase*harmonic+index*2.1)*.8)*.41;
    vec2 delta=uv-points[i]-drift;
    float d=sqrt(dot(delta,delta)+core*core);
    float influence=i==0?1.2*size*size*intensity:(i==2?.9:1.);
    float weight=influence/max(pow(d,falloff),.0001);
    color+=linearize(colors[i])*weight; total+=weight;
  }
  color/=max(total,.0001);
  float luma=dot(color,vec3(.2126,.7152,.0722));
  color+=vec3(smoothstep(0.,1.,luma));
  gl_FragColor=vec4(clamp(encode(color),0.,1.),1.);
}`

const rgb = (hex: string) => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)
const linear = (v: number) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4
const encode = (v: number) => v <= .0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - .055

/** CPU-rendered poster of the same field: shown before WebGL starts, without WebGL, and after context loss. */
function drawPoster(canvas: HTMLCanvasElement, settings: GradientSettings, aspect: number, stretch = false) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  if (!(aspect > 0) || !Number.isFinite(aspect)) return // empty text: the box has no width
  canvas.width = Math.max(1, Math.round(240 * Math.min(1, aspect))); canvas.height = Math.max(1, Math.round(240 / Math.max(1, aspect)))
  const image = ctx.createImageData(canvas.width, canvas.height)
  const colors = [settings.highlight, settings.shadow, settings.slate, settings.base].map(hex => rgb(hex).map(linear))
  const points = [[-.537, .296], [1.22, .587], [.443, -.371], [-1.089, -.654]]
  const weights = [1.2 * (settings.size / 100) ** 2 * settings.intensity / 100, 1, .9, 1]
  const hash = (x: number, y: number) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v) }
  const noise = (x: number, y: number) => {
    const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
    const a = hash(ix, iy) * (1 - fx) + hash(ix + 1, iy) * fx
    const b = hash(ix, iy + 1) * (1 - fx) + hash(ix + 1, iy + 1) * fx
    return (a * (1 - fy) + b * fy) * 2 - 1
  }
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    let u = stretch ? (x + .5) / canvas.width * 7.6 - 3.5 : (x + .5) / canvas.height * 2 - 3.5, v = 1 - (y + .5) / canvas.height * 2
    const scale = .71 + settings.warp * .6, nx = u * scale + 70.3 * 73.7, ny = v * scale + 70.3 * 73.7
    u += settings.warp * .75 * noise(nx + .16, ny)
    v += settings.warp * .75 * noise(nx + 13.7 + .16, ny + 7.1)
    let total = 0; const result = [0, 0, 0]
    points.forEach(([px, py], i) => {
      const dx = u - px - Math.sin((i + 1) * 1.3) * .41
      const dy = v - py - Math.cos((i + 1) * 2.1) * .8 * .41
      const d = Math.sqrt(dx * dx + dy * dy + (.08 + settings.softness * .22) ** 2)
      const w = weights[i] / Math.max(d ** (4.6 - settings.softness * 3.4), .0001)
      total += w; result.forEach((_, c) => result[c] += colors[i][c] * w)
    })
    result.forEach((_, c) => result[c] /= total)
    const luma = result[0] * .2126 + result[1] * .7152 + result[2] * .0722
    const glow = luma * luma * (3 - 2 * luma)
    const offset = (y * canvas.width + x) * 4
    result.forEach((value, c) => image.data[offset + c] = Math.min(255, encode(value + glow) * 255))
    image.data[offset + 3] = 255
  }
  ctx.putImageData(image, 0, 0)
}

/** `idle.current` true = the gradient is invisible right now (between words), so skip drawing it. */
export function MeshGradient({ settings, surface, box, idle, stretch = false, maxWidth = Infinity }: { settings: GradientSettings; surface: RefObject<HTMLElement | null>; box: RefObject<HTMLElement | null>; idle: { current: boolean }; stretch?: boolean; maxWidth?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const posterRef = useRef<HTMLCanvasElement>(null)
  const live = useRef(settings)
  useEffect(() => { live.current = settings }, [settings])

  // Poster: redrawn when a setting or the box size changes.
  useEffect(() => {
    const poster = posterRef.current, element = box.current
    if (!poster || !element) return
    let repaint = 0
    const paint = () => {
      cancelAnimationFrame(repaint)
      repaint = requestAnimationFrame(() => {
        if (canvasRef.current?.style.opacity === "1") return // WebGL is drawing over it: nothing to show, nothing to spend
        drawPoster(poster, live.current, element.clientWidth / Math.max(1, element.clientHeight), stretch)
      })
    }
    const observer = new ResizeObserver(paint); observer.observe(element); paint()
    return () => { observer.disconnect(); cancelAnimationFrame(repaint) }
  }, [box, settings, stretch])

  useEffect(() => {
    const canvas = canvasRef.current, element = box.current, stage = surface.current
    if (!canvas || !element || !stage) return
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" })
    if (!gl) return
    const shaders: WebGLShader[] = []
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type); if (!shader) return null
      shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader)
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null
    }
    const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment)
    const program = gl.createProgram()
    if (!vs || !fs || !program) { shaders.forEach(shader => gl.deleteShader(shader)); return }
    gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { shaders.forEach(shader => gl.deleteShader(shader)); gl.deleteProgram(program); return }
    gl.useProgram(program)
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const location = gl.getAttribLocation(program, "position"); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0)
    const uniforms = Object.fromEntries(["resolution", "cursor", "phase", "warp", "softness", "size", "intensity", "stretch", "colors[0]"].map(name => [name, gl.getUniformLocation(program, name)]))
    const reduced = matchMedia("(prefers-reduced-motion: reduce)")
    let frame = 0, previous = 0, phase = 0, lost = false, visible = false
    let current = { x: -.537, y: .296 }; const target = { ...current }
    /** Draws the current state (uniforms + one triangle). Time is advanced by render(), not here. */
    const paint = () => {
      const s = live.current
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height)
      gl.uniform2f(uniforms.cursor, current.x, current.y); gl.uniform1f(uniforms.phase, phase)
      gl.uniform1f(uniforms.warp, s.warp); gl.uniform1f(uniforms.softness, s.softness)
      gl.uniform1f(uniforms.size, s.size / 100); gl.uniform1f(uniforms.intensity, s.intensity / 100); gl.uniform1f(uniforms.stretch, stretch ? 1 : 0)
      gl.uniform3fv(uniforms["colors[0]"], new Float32Array([s.highlight, s.shadow, s.slate, s.base].flatMap(rgb)))
      gl.drawArrays(gl.TRIANGLES, 0, 3); canvas.style.opacity = "1"
    }
    const resize = () => {
      const w = Math.max(1, element.clientWidth), h = Math.max(1, element.clientHeight)
      const ratio = Math.min(devicePixelRatio || 1, 1.5, maxWidth / w)
      canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio)
      gl.viewport(0, 0, canvas.width, canvas.height)
      // Setting canvas.width clears it. The typewriter resizes the box on every keypress, so redraw right here:
      // a ResizeObserver callback runs before the browser paints, which means no blank frame ever reaches the screen
      // (waiting for the next animation frame left one blank, visible as a flicker).
      if (!lost) paint()
    }
    // The whole frame maps onto the gradient's full range, so the light crosses the word as the mouse crosses the frame.
    const move = (event: PointerEvent) => {
      const rect = stage.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      // Same fixed horizontal range whatever the word's width (the field no longer depends on it).
      target.x = (Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * 2 - 1) * 3.5
      target.y = 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) * 2
    }
    const render = (time: number) => {
      frame = 0
      if (lost || !visible || document.hidden) return
      if (idle.current) { previous = 0; frame = requestAnimationFrame(render); return }
      const dt = previous ? Math.min(time - previous, 50) : 16.67; previous = time
      const s = live.current
      const ease = reduced.matches || s.smoothing === 0 ? 1 : 1 - Math.exp(-dt / (s.smoothing / 3))
      current = { x: current.x + (target.x - current.x) * ease, y: current.y + (target.y - current.y) * ease }
      if (!s.paused && !reduced.matches) phase += dt / 1000 * s.speed * Math.PI * 2 / 7.766667
      paint()
      frame = requestAnimationFrame(render)
    }
    const start = () => { if (!frame && visible && !lost && !document.hidden) { previous = 0; frame = requestAnimationFrame(render) } }
    const stop = () => { cancelAnimationFrame(frame); frame = 0 }
    const contextLost = (event: Event) => {
      event.preventDefault(); lost = true; canvas.style.opacity = "0"; stop()
      if (posterRef.current) drawPoster(posterRef.current, live.current, element.clientWidth / Math.max(1, element.clientHeight), stretch)
    }
    const visibility = () => { stop(); start() }
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) start(); else stop() })
    const observer = new ResizeObserver(resize); observer.observe(element); resize()
    intersection.observe(stage)
    // On the window, not the frame: the full-width nav bar and the panel sit over parts of it and would swallow the events.
    window.addEventListener("pointermove", move, { passive: true }); window.addEventListener("pointerdown", move, { passive: true })
    canvas.addEventListener("webglcontextlost", contextLost); document.addEventListener("visibilitychange", visibility)
    return () => {
      stop(); observer.disconnect(); intersection.disconnect()
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerdown", move)
      canvas.removeEventListener("webglcontextlost", contextLost); document.removeEventListener("visibilitychange", visibility)
      gl.deleteBuffer(buffer); gl.deleteProgram(program); shaders.forEach(shader => gl.deleteShader(shader))
    }
  }, [surface, box, idle, stretch, maxWidth])

  return <><canvas ref={posterRef} className="mesh-poster" /><canvas ref={canvasRef} className="mesh-canvas" /></>
}

/** One word or phrase per line, blanks dropped. */
const parseWords = (text: string) => text.split("\n").map(w => w.trim()).filter(Boolean)

/**
 * Figma 27:414, as a pinned typewriter. The frame sticks to the screen while the card scrolls, and every
 * `typeSensitivity` px of scroll is one keypress (see typewriter-timeline.ts): the current word is deleted
 * letter by letter, then the next is typed; scrolling back undoes it. The last word fully typed is the end of
 * the card, so the section ends exactly there.
 *
 * The gradient (one WebGL canvas) is a percentage of the word's own box, which hugs the text, so it grows and
 * shrinks with every keypress and is gone while the field is empty. The inner shadow is an SVG filter on the
 * text only (CSS has no inner shadow for text): it inverts the glyph alpha, offsets and blurs it, and keeps
 * only what falls inside the letters.
 */
export function HighlightFrame({ id, words: contentWords, label, text, heading, intro }: { id: string; words: readonly string[]; label?: string; text?: string; heading?: string; intro?: string }) {
  const g = useGradientSettings()
  const uid = useId().replace(/:/g, "")
  // The panel can override the words (one per line); empty means the About content.
  const words = useMemo(() => { const custom = parseWords(g.typeWords); return custom.length ? custom : contentWords }, [g.typeWords, contentWords])
  const timeline = useMemo(() => buildTimeline(words, g.typeBeat, g.typeHold), [words, g.typeBeat, g.typeHold])
  const [step, setStep] = useState(0)
  const track = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLElement>(null)
  const box = useRef<HTMLSpanElement>(null)
  const introEl = useRef<HTMLDivElement>(null)
  // Height of the intro text block; the spacer above the pinned frame is a screen minus this, so the intro sits at the bottom of the first screen.
  const [introH, setIntroH] = useState(220)
  const idle = useRef(false)
  const live = useRef({ total: timeline.total, sensitivity: g.typeSensitivity, reversible: g.typeReversible })
  const peak = useRef(0) // furthest step reached, for "not reversible"
  const apply = useRef<() => void>(() => {})

  // Scroll position → keypress count. Native scrolling: no input is captured, the card keeps its own scroll.
  useEffect(() => { peak.current = 0 }, [timeline])
  useEffect(() => { live.current = { total: timeline.total, sensitivity: g.typeSensitivity, reversible: g.typeReversible }; apply.current() }, [timeline.total, g.typeSensitivity, g.typeReversible])
  useEffect(() => {
    const trackEl = track.current
    const scroller = trackEl?.closest<HTMLElement>(".site-card")
    if (!trackEl || !scroller) return
    const run = () => {
      const { total, sensitivity, reversible } = live.current
      let next = Math.min(total, Math.max(0, Math.floor((scroller.scrollTop - trackEl.offsetTop) / sensitivity)))
      if (!reversible) next = Math.max(next, peak.current)
      peak.current = Math.max(peak.current, next)
      setStep(prev => prev === next ? prev : next)
    }
    apply.current = run
    run()
    scroller.addEventListener("scroll", run, { passive: true })
    window.addEventListener("resize", run)
    return () => { scroller.removeEventListener("scroll", run); window.removeEventListener("resize", run); apply.current = () => {} }
  }, [])

  useEffect(() => {
    const el = introEl.current
    if (!el) return
    const measure = () => setIntroH(Math.round(el.getBoundingClientRect().height))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [heading, intro])

  const state = timeline.stateAt(step)
  useEffect(() => { idle.current = state.text.length === 0 }, [state.text])

  return (
    <>
    {heading && <div className="section-feature-spacer" aria-hidden="true" style={{ "--intro-h": `${introH}px`, background: g.typeBg } as CSSProperties} />}
    <div ref={track} className="section-feature-track" style={{ height: `calc(100svh + ${timeline.total * g.typeSensitivity}px)` }}>
      <section ref={frame} className="section-feature" aria-label={`${id} highlight`} style={{ background: g.typeBg, "--type-size": `${g.typeSize}px` } as CSSProperties}>
        <svg className="section-feature-defs" width="0" height="0" aria-hidden="true" focusable="false">
          <filter id={`${uid}-shadow`} colorInterpolationFilters="sRGB">
            <feComponentTransfer in="SourceAlpha" result="inverse"><feFuncA type="table" tableValues="1 0" /></feComponentTransfer>
            <feGaussianBlur in="inverse" stdDeviation={g.shadowBlur} result="blurred" />
            <feOffset in="blurred" dx={g.shadowX} dy={g.shadowY} result="offset" />
            <feFlood floodColor={g.shadowColor} floodOpacity={g.shadowOpacity} result="tint" />
            <feComposite in="tint" in2="offset" operator="in" result="shade" />
            <feComposite in="shade" in2="SourceAlpha" operator="in" result="inner" />
            <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="inner" /></feMerge>
          </filter>
        </svg>
        <p className="visually-hidden">{words.join(", ")}</p>
        {heading && <div ref={introEl} className="section-feature-intro"><h1>{heading}</h1>{intro && <p>{intro}</p>}</div>}
        {label && <RevealText className="section-feature-label" text={label} trigger="inView" />}
        <div className="section-feature-main">
        <div className="section-feature-word" aria-hidden="true">
          <div className="section-feature-stage">
            <span ref={box} className="section-feature-bg">
              <Image src="/images/about-websites.webp" alt="" fill sizes="240px" />
              <MeshGradient settings={g} surface={frame} box={box} idle={idle} />
            </span>
          </div>
          <p style={{ filter: g.shadowEnabled ? `url(#${uid}-shadow)` : undefined, color: g.typeColor, fontWeight: g.typeWeight, letterSpacing: `${g.typeTracking / 100}em`, textTransform: g.typeCase }}>{state.text || "\u200b"}</p>
        </div>
        {text && <RevealText className="section-feature-text" text={text} trigger="inView" />}
        </div>
        {g.typeHud && <div className="section-feature-hud" aria-hidden="true">{String(step).padStart(3, "0")} / {String(timeline.total).padStart(3, "0")}  {state.phase}</div>}
      </section>
    </div>
    </>
  )
}
