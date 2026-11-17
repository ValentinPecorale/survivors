import { getGradientSettings } from "./gradient-settings"

/**
 * The interactive mesh gradient, used invisibly as the driver of the section lines: a line is white only where the
 * gradient is white. Colour field and cursor point are the same shader as the About word and the footer; here the output
 * is alpha = how white the field is, so the dark parts of the gradient leave the line transparent.
 *
 * One shared WebGL context renders every line (one thin strip each) and copies the strip into that line's own 2D canvas,
 * so three lines cost one context, not three. Each strip evaluates the field in its own coordinates, along the line, so the
 * lines look different from each other (each has its own seed). The loop runs only while a line is on screen.
 */

const vertex = `attribute vec2 position;
void main() { gl_Position = vec4(position, 0., 1.); }`

const fragment = `precision highp float;
uniform vec2 resolution;
uniform float ratio;
uniform float seed;
uniform vec2 cursor;
uniform float phase;
uniform float warp;
uniform float softness;
uniform float size;
uniform float intensity;
uniform float cutoff;
uniform vec3 colors[4];
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y)*2.-1.;
}
vec3 linearize(vec3 c) { return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c)); }
vec3 encode(vec3 c) { return mix(c*12.92,1.055*pow(max(c,0.),vec3(1./2.4))-.055,step(vec3(.0031308),c)); }
void main() {
  // The line is its own little world: x runs along the line (1 unit = 450 css px, centred), y is a constant per line.
  vec2 uv = vec2((gl_FragCoord.x/ratio - resolution.x/ratio*.5)/450., seed*.37);
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
  vec3 rgb=clamp(encode(color),0.,1.);
  float a=smoothstep(cutoff,min(1.,cutoff+.47),dot(rgb,vec3(.2126,.7152,.0722)));
  gl_FragColor=vec4(vec3(a),a);
}`

const rgb = (hex: string) => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)

type Line = { seed: number; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; wrap: HTMLElement; visible: boolean; onFail: () => void }

const REST = { x: -0.537 }
let seeds = 0
const lines = new Set<Line>()
// css px from the viewport's top-left
const cursor = { x: 0, y: 0, tx: 0, ty: 0, seen: false }
let gl: WebGLRenderingContext | null = null
let glCanvas: HTMLCanvasElement | null = null
let uniforms: Record<string, WebGLUniformLocation | null> = {}
let failed = false
let raf = 0, last = 0, phase = 0, listening = false

function init() {
  if (gl || failed) return !failed
  glCanvas = document.createElement("canvas")
  const context = glCanvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: "low-power" })
  if (!context) { failed = true; return false }
  const compile = (type: number, source: string) => {
    const shader = context.createShader(type); if (!shader) return null
    context.shaderSource(shader, source); context.compileShader(shader)
    return context.getShaderParameter(shader, context.COMPILE_STATUS) ? shader : null
  }
  const vs = compile(context.VERTEX_SHADER, vertex), fs = compile(context.FRAGMENT_SHADER, fragment)
  const program = context.createProgram()
  if (!vs || !fs || !program) { failed = true; return false }
  context.attachShader(program, vs); context.attachShader(program, fs); context.linkProgram(program)
  if (!context.getProgramParameter(program, context.LINK_STATUS)) { failed = true; return false }
  context.useProgram(program)
  const buffer = context.createBuffer(); context.bindBuffer(context.ARRAY_BUFFER, buffer)
  context.bufferData(context.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), context.STATIC_DRAW)
  const location = context.getAttribLocation(program, "position"); context.enableVertexAttribArray(location); context.vertexAttribPointer(location, 2, context.FLOAT, false, 0, 0)
  uniforms = Object.fromEntries(["resolution", "ratio", "seed", "cursor", "phase", "warp", "softness", "size", "intensity", "cutoff", "colors[0]"].map(name => [name, context.getUniformLocation(program, name)]))
  glCanvas.addEventListener("webglcontextlost", event => { event.preventDefault(); failed = true; lines.forEach(l => l.onFail()) })
  gl = context
  return true
}

function frame(now: number) {
  raf = 0
  const active = [...lines].filter(l => l.visible)
  if (!active.length || !gl || !glCanvas) return
  const s = getGradientSettings()
  const dt = Math.min(now - last, 50); last = now
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const k = s.lineDelay <= 0 || reduced ? 1 : 1 - Math.exp(-dt / s.lineDelay)
  cursor.x += (cursor.tx - cursor.x) * k; cursor.y += (cursor.ty - cursor.y) * k
  if (!s.linePaused && !reduced) phase += dt / 1000 * s.lineSpeed * Math.PI * 2 / 7.766667
  const ratio = Math.min(devicePixelRatio || 1, 1.5)
  const vh = window.innerHeight
  const softness = Math.min(1, Math.max(0, s.lineFeather / 230))
  for (const line of active) {
    const r = line.wrap.getBoundingClientRect()
    if (r.bottom < -50 || r.top > vh + 50 || !r.width) continue
    const w = Math.max(1, Math.round(r.width * ratio)), h = Math.max(1, Math.round(r.height * ratio))
    if (glCanvas.width !== w || glCanvas.height !== h) { glCanvas.width = w; glCanvas.height = h }
    if (line.canvas.width !== w || line.canvas.height !== h) { line.canvas.width = w; line.canvas.height = h }
    gl.viewport(0, 0, w, h)
    // The white point works on its own: it rests where the gradient starts until the cursor moves it left or right
    // along the line. The cursor never reveals anything, it only repositions the white point.
    const cx = cursor.seen ? (cursor.x - r.left - r.width / 2) / 450 : REST.x
    gl.uniform2f(uniforms.resolution, w, h); gl.uniform1f(uniforms.ratio, ratio); gl.uniform1f(uniforms.seed, line.seed)
    gl.uniform2f(uniforms.cursor, cx, line.seed * 0.37); gl.uniform1f(uniforms.phase, phase + line.seed * 2.3)
    gl.uniform1f(uniforms.warp, s.lineWarp); gl.uniform1f(uniforms.softness, softness)
    gl.uniform1f(uniforms.size, s.lineRadius / 400); gl.uniform1f(uniforms.intensity, s.lineIntensity / 100); gl.uniform1f(uniforms.cutoff, s.lineCutoff)
    gl.uniform3fv(uniforms["colors[0]"], new Float32Array([s.lineHighlight, s.lineShadow, s.lineSlate, s.lineBase].flatMap(rgb)))
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    line.ctx.clearRect(0, 0, w, h); line.ctx.drawImage(glCanvas, 0, 0)
  }
  raf = requestAnimationFrame(frame)
}

const wake = () => { if (!raf && lines.size) { last = performance.now(); raf = requestAnimationFrame(frame) } }

function listen() {
  if (listening) return
  listening = true
  window.addEventListener("pointermove", event => {
    cursor.tx = event.clientX; cursor.ty = event.clientY
    if (!cursor.seen) { cursor.seen = true; cursor.x = cursor.tx; cursor.y = cursor.ty }
  }, { passive: true })
}

/** Register a line. Returns a cleanup. onFail is called when WebGL is unavailable, so the line can fall back to plain white. */
export function registerLine(wrap: HTMLElement, canvas: HTMLCanvasElement, onFail: () => void) {
  const ctx = canvas.getContext("2d")
  if (!ctx || !init()) { onFail(); return () => {} }
  const line: Line = { seed: seeds++, canvas, ctx, wrap, visible: false, onFail }
  lines.add(line); listen()
  const io = new IntersectionObserver(([entry]) => { line.visible = entry.isIntersecting; if (line.visible) wake() }, { rootMargin: "100px 0px" })
  io.observe(wrap)
  return () => { io.disconnect(); lines.delete(line) }
}
