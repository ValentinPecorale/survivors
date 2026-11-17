"use client";

import { useEffect, useRef, type RefObject } from "react";

export interface MeshSettings {
  highlight: string; shadow: string; slate: string; base: string;
  speed: number; smoothing: number; size: number; intensity: number;
  warp: number; softness: number;
}

const vertex = `attribute vec2 position;
void main() { gl_Position = vec4(position, 0., 1.); }`;

// Normalized inverse-distance color field, evaluated over warped coordinates.
// This is one blended field, rather than composited gradient layers.
export const fragment = `precision highp float;
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
}`;

export const rgb = (hex: string) => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
const linear = (v: number) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
const encode = (v: number) => v <= .0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - .055;

/** CPU-rendered mesh poster for browsers without WebGL and context loss. */
function drawPoster(canvas: HTMLCanvasElement, settings: MeshSettings, aspect: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = 240; canvas.height = Math.max(1, Math.round(240 / aspect));
  const image = ctx.createImageData(canvas.width, canvas.height);
  const colors = [settings.highlight, settings.shadow, settings.slate, settings.base].map(hex => rgb(hex).map(linear));
  const points = [[-.537, .296], [1.22, .587], [.443, -.371], [-1.089, -.654]];
  const weights = [1.2 * (settings.size / 100) ** 2 * settings.intensity / 100, 1, .9, 1];
  const hash = (x: number, y: number) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
  const noise = (x: number, y: number) => {
    const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy) * (1 - fx) + hash(ix + 1, iy) * fx;
    const b = hash(ix, iy + 1) * (1 - fx) + hash(ix + 1, iy + 1) * fx;
    return (a * (1 - fy) + b * fy) * 2 - 1;
  };
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    let u = ((x + .5) / canvas.width * 2 - 1) * aspect, v = 1 - (y + .5) / canvas.height * 2;
    const scale = .71 + settings.warp * .6, nx = u * scale + 70.3 * 73.7, ny = v * scale + 70.3 * 73.7;
    u += settings.warp * .75 * noise(nx + .16, ny);
    v += settings.warp * .75 * noise(nx + 13.7 + .16, ny + 7.1);
    let total = 0; const result = [0, 0, 0];
    points.forEach(([px, py], i) => {
      const dx = u - px - Math.sin((i + 1) * 1.3) * .41;
      const dy = v - py - Math.cos((i + 1) * 2.1) * .8 * .41;
      const d = Math.sqrt(dx * dx + dy * dy + (.08 + settings.softness * .22) ** 2);
      const w = weights[i] / Math.max(d ** (4.6 - settings.softness * 3.4), .0001);
      total += w; result.forEach((_, c) => result[c] += colors[i][c] * w);
    });
    result.forEach((_, c) => result[c] /= total);
    const luma = result[0] * .2126 + result[1] * .7152 + result[2] * .0722;
    const glow = luma * luma * (3 - 2 * luma);
    const offset = (y * canvas.width + x) * 4;
    result.forEach((value, c) => image.data[offset + c] = Math.min(255, encode(value + glow) * 255));
    image.data[offset + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

export function MeshGradient({ settings, paused, surface, staticOnly = false, mirrors, interactionSurface }: { settings: MeshSettings; paused: boolean; surface: RefObject<HTMLElement | null>; staticOnly?: boolean; mirrors?: RefObject<HTMLElement | null>; interactionSurface?: RefObject<HTMLElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const posterRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ settings, paused });
  useEffect(() => { live.current = { settings, paused }; }, [settings, paused]);

  useEffect(() => {
    const canvas = canvasRef.current, poster = posterRef.current, element = surface.current;
    if (!canvas || !poster || !element) return;
    let repaint = 0;
    const paint = () => {
      cancelAnimationFrame(repaint);
      repaint = requestAnimationFrame(() => drawPoster(poster, live.current.settings, element.clientWidth / element.clientHeight));
    };
    const observer = new ResizeObserver(paint); observer.observe(element); paint();
    return () => { observer.disconnect(); cancelAnimationFrame(repaint); };
  }, [surface, settings]);

  useEffect(() => {
    const canvas = canvasRef.current, element = surface.current;
    if (!canvas || !element) return;
    if (staticOnly) { canvas.style.opacity = "0"; return; }
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" });
    if (!gl) return;
    const shaders: WebGLShader[] = [];
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type); if (!shader) return null;
      shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
    };
    const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
    const program = gl.createProgram();
    if (!vs || !fs || !program) { shaders.forEach(shader => gl.deleteShader(shader)); return; }
    gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { shaders.forEach(shader => gl.deleteShader(shader)); gl.deleteProgram(program); return; }
    gl.useProgram(program);
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    const location = gl.getAttribLocation(program, "position"); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    const uniforms = Object.fromEntries(["resolution", "cursor", "phase", "warp", "softness", "size", "intensity", "colors[0]"].map(name => [name, gl.getUniformLocation(program, name)]));
    const mirrorTargets = [...(mirrors?.current?.querySelectorAll<HTMLCanvasElement>("canvas[data-footer-chrome]") ?? [])].map(canvas => ({ canvas, context: canvas.getContext("2d") }));
    const pointerSurface = interactionSurface?.current ?? element;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, previous = 0, phase = 0, lost = false;
    let current = { x: -.537, y: .296 }; const target = { ...current };
    const resize = () => {
      const w = element.clientWidth, h = element.clientHeight;
      const budget = w <= 640 ? 1_000_000 : 2_000_000;
      const ratio = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(budget / (w * h)), 1024 / Math.max(w, h));
      canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const move = (event: PointerEvent) => {
      if (!interactionSurface && event.target instanceof Element && event.target.closest("button, a, .settings-panel")) return;
      const rect = pointerSurface.getBoundingClientRect();
      target.x = (Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * 2 - 1) * rect.width / rect.height;
      target.y = 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) * 2;
    };
    const render = (time: number) => {
      if (lost) return;
      const dt = previous ? Math.min(time - previous, 50) : 16.67; previous = time;
      const { settings: s, paused: stop } = live.current;
      const ease = reduced.matches || s.smoothing === 0 ? 1 : 1 - Math.exp(-dt / (s.smoothing / 3));
      current = { x: current.x + (target.x - current.x) * ease, y: current.y + (target.y - current.y) * ease };
      if (!stop && !reduced.matches) phase += dt / 1000 * s.speed * Math.PI * 2 / 7.766667;
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform2f(uniforms.cursor, current.x, current.y); gl.uniform1f(uniforms.phase, phase);
      gl.uniform1f(uniforms.warp, s.warp); gl.uniform1f(uniforms.softness, s.softness);
      gl.uniform1f(uniforms.size, s.size / 100); gl.uniform1f(uniforms.intensity, s.intensity / 100);
      gl.uniform3fv(uniforms["colors[0]"], new Float32Array([s.highlight, s.shadow, s.slate, s.base].flatMap(rgb)));
      gl.drawArrays(gl.TRIANGLES, 0, 3); canvas.style.opacity = "1";
      for (const target of mirrorTargets) target.context?.drawImage(canvas, 0, 0, target.canvas.width, target.canvas.height);
      frame = requestAnimationFrame(render);
    };
    const contextLost = (event: Event) => { event.preventDefault(); lost = true; canvas.style.opacity = "0"; cancelAnimationFrame(frame); };
    const visibility = () => {
      cancelAnimationFrame(frame); previous = 0;
      if (!document.hidden && !lost) frame = requestAnimationFrame(render);
    };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    pointerSurface.addEventListener("pointermove", move, { passive: true }); pointerSurface.addEventListener("pointerdown", move, { passive: true });
    canvas.addEventListener("webglcontextlost", contextLost); document.addEventListener("visibilitychange", visibility);
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      pointerSurface.removeEventListener("pointermove", move); pointerSurface.removeEventListener("pointerdown", move);
      canvas.removeEventListener("webglcontextlost", contextLost); document.removeEventListener("visibilitychange", visibility);
      gl.deleteBuffer(buffer); gl.deleteProgram(program); shaders.forEach(shader => gl.deleteShader(shader));
    };
  }, [surface, staticOnly, mirrors, interactionSurface]);

  return <div className="mesh-field" aria-hidden="true"><canvas ref={posterRef} className="mesh-poster" /><canvas ref={canvasRef} className="mesh-canvas" /></div>;
}
