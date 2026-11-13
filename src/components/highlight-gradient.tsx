"use client"

import Image from "next/image"
import { useEffect, useId, useRef, type CSSProperties, type RefObject } from "react"
import { useGradientSettings, type GradientSettings } from "./gradient-settings"

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
uniform vec3 colors[4];
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y)*2.-1.;
}
vec3 linearize(vec3 c) { return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c)); }
vec3 encode(vec3 c) { return mix(c*12.92,1.055*pow(max(c,0.),vec3(1./2.4))-.055,step(vec3(.0031308),c)); }
void main() {
  float aspect = resolution.x/resolution.y;
  vec2 uv = (gl_FragCoord.xy/resolution*2.-1.)*vec2(aspect,1.);
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
function drawPoster(canvas: HTMLCanvasElement, settings: GradientSettings, aspect: number) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  canvas.width = 240; canvas.height = Math.max(1, Math.round(240 / aspect))
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
    let u = ((x + .5) / canvas.width * 2 - 1) * aspect, v = 1 - (y + .5) / canvas.height * 2
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
function MeshGradient({ settings, surface, box, idle }: { settings: GradientSettings; surface: RefObject<HTMLElement | null>; box: RefObject<HTMLElement | null>; idle: { current: boolean } }) {
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
      repaint = requestAnimationFrame(() => drawPoster(poster, live.current, element.clientWidth / Math.max(1, element.clientHeight)))
    }
    const observer = new ResizeObserver(paint); observer.observe(element); paint()
    return () => { observer.disconnect(); cancelAnimationFrame(repaint) }
  }, [box, settings])

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
    const uniforms = Object.fromEntries(["resolution", "cursor", "phase", "warp", "softness", "size", "intensity", "colors[0]"].map(name => [name, gl.getUniformLocation(program, name)]))
    const reduced = matchMedia("(prefers-reduced-motion: reduce)")
    let frame = 0, previous = 0, phase = 0, lost = false, visible = false
    let current = { x: -.537, y: .296 }; const target = { ...current }
    const resize = () => {
      const w = Math.max(1, element.clientWidth), h = Math.max(1, element.clientHeight)
      const ratio = Math.min(devicePixelRatio || 1, 1.5)
      canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio)
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    // The whole frame maps onto the gradient's full range, so the light crosses the word as the mouse crosses the frame.
    const move = (event: PointerEvent) => {
      const rect = stage.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const aspect = canvas.width / Math.max(1, canvas.height)
      target.x = (Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * 2 - 1) * aspect
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
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height)
      gl.uniform2f(uniforms.cursor, current.x, current.y); gl.uniform1f(uniforms.phase, phase)
      gl.uniform1f(uniforms.warp, s.warp); gl.uniform1f(uniforms.softness, s.softness)
      gl.uniform1f(uniforms.size, s.size / 100); gl.uniform1f(uniforms.intensity, s.intensity / 100)
      gl.uniform3fv(uniforms["colors[0]"], new Float32Array([s.highlight, s.shadow, s.slate, s.base].flatMap(rgb)))
      gl.drawArrays(gl.TRIANGLES, 0, 3); canvas.style.opacity = "1"
      frame = requestAnimationFrame(render)
    }
    const start = () => { if (!frame && visible && !lost && !document.hidden) { previous = 0; frame = requestAnimationFrame(render) } }
    const stop = () => { cancelAnimationFrame(frame); frame = 0 }
    const contextLost = (event: Event) => { event.preventDefault(); lost = true; canvas.style.opacity = "0"; stop() }
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
  }, [surface, box, idle])

  return <><canvas ref={posterRef} className="mesh-poster" /><canvas ref={canvasRef} className="mesh-canvas" /></>
}

const smooth = (x: number) => x * x * (3 - 2 * x)

/**
 * Continuous word index (0 … count−1) for scroll progress measured in word steps. Each step is a rest at the
 * centre (`hold` of the step) followed by a smoothstep travel to the next word: zero speed at both ends, so a
 * word settles into the centre instead of stopping dead. The next word never moves while one is resting.
 */
export function wordIndexAt(progress: number, count: number, hold: number) {
  if (count <= 1 || progress <= 0) return 0
  if (progress >= count - 1) return count - 1
  const step = Math.floor(progress), local = progress - step
  return local < hold ? step : step + smooth((local - hold) / (1 - hold))
}

/** 1 while a word is at the centre, falling to 0 once it is 0.2 of a step away: the gradient and shadow only exist on a settled word. */
const settled = (distance: number) => Math.min(1, Math.max(0, 1 - (distance - 0.03) / 0.17))

/**
 * How much of the current word (and its gradient and shadow) is left while the next word rises toward it.
 * `distance` is how far the next word still is from the centre, in steps (1 = just entering at the bottom).
 * The current word does not move: it stays fully there until the newcomer is half a step away, then fades out
 * and is gone by 0.2, before the newcomer arrives, so the two never overlap.
 */
const leaving = (distance: number) => smooth(Math.min(1, Math.max(0, (distance - 0.2) / 0.3)))

/**
 * Figma 27:414, as a pinned sequence. The frame sticks to the screen while the card scrolls, and the centre never
 * scrolls: the current word and its gradient stay exactly where they are. Scrolling brings the next word up from
 * the bottom edge; as it nears the centre the current word and gradient fade out, and once it has landed the
 * gradient appears around it (sized to the word's own width) and it gets its inner shadow. The last word landing
 * on the gradient is the end of the section.
 *
 * One gradient (one WebGL canvas) serves all words: it is resized to whichever word is nearest, and is invisible
 * whenever a word is travelling, so it never has to be in two places at once.
 * The inner shadow is an SVG filter per word (CSS has no inner shadow for text): it inverts the glyph alpha,
 * offsets and blurs it, and keeps only what falls inside the letters. Its opacity follows the same "settled"
 * curve, so a word only has the shadow while it is over the gradient.
 */
export function HighlightFrame({ id, words }: { id: string; words: readonly string[] }) {
  const g = useGradientSettings()
  const uid = useId().replace(/:/g, "")
  const track = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLSpanElement>(null)
  const items = useRef<(HTMLDivElement | null)[]>([])
  const floods = useRef<(SVGFEFloodElement | null)[]>([])
  const idle = useRef(false)
  const live = useRef(g)
  const apply = useRef<() => void>(() => {})
  const count = words.length
  const hold = Math.min(0.6, Math.max(0, g.wordHold / 100))
  const steps = count > 1 ? count - 1 + hold : 0

  // Settings changed in the panel: re-run the layout with the new numbers.
  useEffect(() => { live.current = g; apply.current() }, [g])

  useEffect(() => {
    const trackEl = track.current, frameEl = frame.current, stageEl = stage.current
    const scroller = trackEl?.closest<HTMLElement>(".site-card")
    if (!trackEl || !frameEl || !stageEl || !scroller) return
    let raf = 0
    const run = () => {
      raf = 0
      const s = live.current
      const h = Math.min(0.6, Math.max(0, s.wordHold / 100))
      const height = frameEl.clientHeight
      const progress = (scroller.scrollTop - trackEl.offsetTop) / Math.max(1, scroller.clientHeight * s.wordScroll / 100)
      const t = wordIndexAt(progress, count, h)
      // Nothing ever travels upward. A word below the centre rises to it; a word at or past the centre stays put
      // and fades out when the next word gets close. `strength` is its gradient/shadow (and, once it is the
      // current word, its own opacity).
      let active = 0, glow = 0
      for (let i = 0; i < count; i++) {
        const item = items.current[i]
        if (!item) continue
        const ahead = i - t // steps still to rise (> 0), or 0 once it has arrived
        const strength = ahead > 0 ? settled(ahead) : i < count - 1 ? leaving(i + 1 - t) : 1
        const alpha = ahead > 0 ? 1 : strength
        item.style.visibility = ahead >= 1.02 || alpha <= 0.001 ? "hidden" : "visible"
        item.style.opacity = alpha.toFixed(3)
        item.style.transform = `translate(-50%, -50%) translateY(${(Math.max(ahead, 0) * height).toFixed(1)}px)`
        const shade = s.shadowEnabled ? strength : 0
        const text = item.firstElementChild as HTMLElement | null
        if (text) text.style.filter = shade > 0.01 ? `url(#${uid}-shadow-${i})` : "none"
        floods.current[i]?.setAttribute("flood-opacity", (s.shadowOpacity * shade).toFixed(3))
        if (strength > glow) { glow = strength; active = i }
      }
      // One gradient serves every word: it takes the size of whichever word is strongest right now.
      const label = items.current[active]?.firstElementChild as HTMLElement | null
      if (label) { stageEl.style.width = `${label.offsetWidth}px`; stageEl.style.height = `${label.offsetHeight}px` }
      stageEl.style.opacity = glow.toFixed(3)
      stageEl.style.visibility = glow > 0.001 ? "visible" : "hidden"
      idle.current = glow <= 0.001
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(run) }
    apply.current = run
    run()
    scroller.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    const observer = new ResizeObserver(schedule) // word widths change when the font loads
    items.current.forEach(el => el && observer.observe(el))
    void document.fonts?.ready.then(schedule)
    return () => {
      cancelAnimationFrame(raf); observer.disconnect()
      scroller.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule)
      apply.current = () => {}
    }
  }, [count, uid])

  return (
    <div ref={track} className="section-feature-track" style={{ height: `calc(100svh + ${(steps * g.wordScroll).toFixed(1)}svh)` }}>
      <section ref={frame} className="section-feature" aria-label={`${id} highlight`}>
        <svg className="section-feature-defs" width="0" height="0" aria-hidden="true" focusable="false">
          {words.map((_, i) => (
            <filter key={i} id={`${uid}-shadow-${i}`} colorInterpolationFilters="sRGB">
              <feComponentTransfer in="SourceAlpha" result="inverse"><feFuncA type="table" tableValues="1 0" /></feComponentTransfer>
              <feGaussianBlur in="inverse" stdDeviation={g.shadowBlur} result="blurred" />
              <feOffset in="blurred" dx={g.shadowX} dy={g.shadowY} result="offset" />
              <feFlood ref={el => { floods.current[i] = el }} floodColor={g.shadowColor} result="tint" />
              <feComposite in="tint" in2="offset" operator="in" result="shade" />
              <feComposite in="shade" in2="SourceAlpha" operator="in" result="inner" />
              <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="inner" /></feMerge>
            </filter>
          ))}
        </svg>
        <p className="visually-hidden">{words.join(", ")}</p>
        {/* Centred, sized to the nearest word by the layout effect; the gradient bleeds past it on every side. */}
        <div ref={stage} className="section-feature-stage" aria-hidden="true">
          <span ref={box} className="section-feature-bg">
            <Image src="/images/about-websites.webp" alt="" fill sizes="240px" />
            <MeshGradient settings={g} surface={frame} box={box} idle={idle} />
          </span>
        </div>
        {words.map((word, i) => (
          <div key={word + i} ref={el => { items.current[i] = el }} className="section-feature-word" aria-hidden="true" style={{ "--i": i } as CSSProperties}>
            <p>{word}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
