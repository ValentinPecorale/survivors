import type * as THREE from "three"

/** Fixed full-loop framing corners, transformed only by explicit subject edits. */
export type TigerFrame = { points: Float32Array; count: number }

export function projectedBounds(points: Float32Array, count: number, camera: THREE.Camera, sample: THREE.Vector3) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (let i = 0; i < count; i += 3) {
    sample.set(points[i], points[i + 1], points[i + 2]).project(camera)
    minX = Math.min(minX, sample.x); maxX = Math.max(maxX, sample.x)
    minY = Math.min(minY, sample.y); maxY = Math.max(maxY, sample.y)
  }
  return { minX, maxX, minY, maxY }
}
