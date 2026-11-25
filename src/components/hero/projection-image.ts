"use client"
import * as THREE from "three"

/**
 * The placeholder shape that the searchlight projects (public/images/skull-projection.png, 512x457): its black pixels become opaque
 * white, everything else is clear. One shared canvas texture, filled once the PNG loads (same size from the start, so the GPU copy
 * is only re-uploaded, never reallocated). Used by the sky projection and by the decal on the device. Swap the PNG for the real shape.
 */
const URL = "/images/skull-projection.png"
const WIDTH = 256, HEIGHT = 229
export const PROJECTION_ASPECT = HEIGHT / WIDTH

let texture: THREE.CanvasTexture | null = null
export function getProjectionTexture() {
  if (texture) return texture
  const canvas = document.createElement("canvas")
  canvas.width = WIDTH; canvas.height = HEIGHT
  texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const loaded = texture, image = new Image()
  image.onload = () => {
    const context = canvas.getContext("2d")!
    context.drawImage(image, 0, 0, WIDTH, HEIGHT)
    const data = context.getImageData(0, 0, WIDTH, HEIGHT)
    for (let i = 0; i < data.data.length; i += 4) {
      const luminance = (data.data[i] + data.data[i + 1] + data.data[i + 2]) / 3
      data.data[i] = data.data[i + 1] = data.data[i + 2] = 255
      data.data[i + 3] = 255 - luminance
    }
    context.putImageData(data, 0, 0)
    loaded.needsUpdate = true
  }
  image.src = URL
  return texture
}
