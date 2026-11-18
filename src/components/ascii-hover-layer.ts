import type { ShaderLabConfig } from "@basementstudio/shader-lab"

/**
 * Local black/white point for the ASCII layer, around the cursor.
 *
 * The ASCII layer has one global black point and one global white point. To change them only near the cursor, this adds a
 * custom-shader effect between the black-background clip and the ASCII layer that rescales the clip's brightness inside a
 * feathered circle, so the (unchanged) global ASCII settings produce exactly what the local settings would:
 *
 *   (L' - B) / (W - B) = (L - b0) / (w1 - b0)   →   L' = B + (L - b0) · (W - B) / (w1 - b0)
 *
 * with B, W the composition's own black/white point and b0, w1 the hover ones (panel: ASCII video hover). The cursor, radius,
 * feather, levels and fade-in are shader uniforms registered on globalThis.__asciiHover[id]; the runtime sets their values every
 * frame, so moving the cursor never recompiles the shader. Cost: one extra full-size pass, whose result is a no-op outside the circle.
 */
export type HoverUniforms = {
  center: { value: { set(x: number, y: number): void } } // cursor in composition uv (0–1, origin bottom-left)
  levels: { value: { set(x: number, y: number, z: number, w: number): void } } // hover black, hover white, radius px, feather px (composition px)
  strength: { value: number } // 0 = no effect, 1 = full (eased by the runtime)
}
export const HOVER_REGISTRY = "__asciiHover"

export function withGlyphHover(config: ShaderLabConfig, id: string): ShaderLabConfig {
  const ascii = config.layers.find(l => l.type === "ascii")
  if (!ascii) return config
  const p = ascii.params as { signalBlackPoint?: number; signalWhitePoint?: number }
  const B = p.signalBlackPoint ?? 0, W = p.signalWhitePoint ?? 1
  const w = config.composition?.width ?? 960, h = config.composition?.height ?? 540
  const sourceCode = `const hoverCenter = uniform(vec2(0.5, 0.5))
const hoverLevels = uniform(vec4(0.0, 1.0, 120.0, 80.0))
const hoverStrength = uniform(0.0)
globalThis.${HOVER_REGISTRY} = globalThis.${HOVER_REGISTRY} || {}
globalThis.${HOVER_REGISTRY}[${JSON.stringify(id)}] = { center: hoverCenter, levels: hoverLevels, strength: hoverStrength }

export const sketch = Fn(() => {
  const src = inputTexture.toVar()
  const dist = length(uv().sub(hoverCenter).mul(vec2(${w.toFixed(1)}, ${h.toFixed(1)})))
  const inside = float(1).sub(smoothstep(hoverLevels.z.sub(hoverLevels.w), hoverLevels.z, dist)).mul(hoverStrength)
  const lum = dot(src.rgb, vec3(0.2126, 0.7152, 0.0722))
  const ratio = float(${(W - B).toFixed(4)}).div(max(hoverLevels.y.sub(hoverLevels.x), 0.001))
  const target = float(${B.toFixed(4)}).add(max(lum.sub(hoverLevels.x), 0.0).mul(ratio))
  const scale = target.div(max(lum, 0.0001))
  return vec4(src.rgb.mul(mix(float(1), scale, inside)), src.a)
})
`
  const layer = {
    blendMode: "normal", compositeMode: "filter", hue: 0, saturation: 1,
    id: "layer-glyph-hover", kind: "source", type: "custom-shader", name: "Glyph hover levels",
    opacity: 1, visible: true, parentId: ascii.parentId,
    params: { effectMode: true, entryExport: "sketch", sourceFileName: "hover.ts", sourceRevision: 0, sourceCode },
  } as unknown as ShaderLabConfig["layers"][number]
  // Layers are listed top first: the ASCII layer reads what is below it, so the hover effect goes right under it.
  const index = config.layers.indexOf(ascii)
  return { ...config, layers: [...config.layers.slice(0, index + 1), layer, ...config.layers.slice(index + 1)] }
}
