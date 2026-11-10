import * as THREE from "three"

/** Matches Shader Lab's model-loaders.ts HDR irradiance normalization. */
export function studioNormalization(texture: THREE.DataTexture) {
  const { data, width, height } = texture.image
  if (!data) return 1
  const half = texture.type === THREE.HalfFloatType
  const read = (i: number) => half ? THREE.DataUtils.fromHalfFloat(data[i]) : data[i]
  const step = Math.max(1, Math.round(Math.max(width, height) / 256))
  let total = 0
  let weight = 0
  for (let y = 0; y < height; y += step) {
    const solidAngle = Math.sin((y + 0.5) / height * Math.PI)
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4
      const luminance = read(i) * 0.2126 + read(i + 1) * 0.7152 + read(i + 2) * 0.0722
      if (Number.isFinite(luminance)) { total += luminance * solidAngle; weight += solidAngle }
    }
  }
  const mean = weight > 0 ? total / weight : 0
  return mean > 0 ? Math.min(50, Math.max(0.02, 0.6 / mean)) : 1
}
