import * as THREE from "three"
import type { Node } from "three/webgpu"
import { clamp, float, floor, positionLocal, select, uniform, vec3 } from "three/tsl"

/** Shared by every plant: how soft each slice's own ease is (0 linear … 1 smoothstep) and how far neighbouring slices overlap in time. */
export const shrinkParams = { softness: uniform(1), overlap: uniform(2) }

/**
 * The plants-and-trees "out" animation: each plant collapses from the top down, segment by segment, like a telescope closing
 * (the shrink effect from the Blender file, ported from the WebGL `onBeforeCompile` patch to a TSL position node, since this
 * renderer is WebGPU). The plant is cut into SEGMENTS slices along its height. Slice i (counted from the base) starts shrinking
 * at progress (SEGMENTS − 1 − i) × step, so the top goes first and the base last. Each slice takes `overlap` steps to finish (2 by
 * default, with step = 1 / (SEGMENTS − 1 + overlap) so the base ends exactly at 1), eased by a blend of linear and smoothstep. A slice loses height and width together, which is what makes it read as
 * shrinking away rather than being cut off.
 */
export const SHRINK_SEGMENTS = 6

const perObject = (read: (object: THREE.Object3D) => number) =>
  uniform(0).onObjectUpdate(frame => (frame.object ? read(frame.object) : 0))

let shared: ReturnType<typeof vec3> | null = null

/** One position node for every plant: progress, base and height come from the object being drawn, so the 126 meshes share a program. */
export function shrinkPosition() {
  if (shared) return shared
  const progress = perObject(object => object.userData.shrinkP ?? 0)
  const base = perObject(object => object.userData.shrinkBase ?? 0)
  const height = perObject(object => object.userData.shrinkHeight ?? 1)
  const n = SHRINK_SEGMENTS, { softness, overlap } = shrinkParams
  const step = float(1).div(overlap.add(n - 1))
  const above = positionLocal.y.sub(base)
  const slice = height.div(n)
  const j = clamp(floor(above.div(slice)), 0, n - 1)
  let y: Node<"float"> = float(0), widthScale: Node<"float"> = float(1)
  for (let i = 0; i < n; i++) {
    const t = clamp(progress.sub(step.mul(n - 1 - i)).div(step.mul(overlap)), 0, 1)
    const s = float(1).sub(t.add(t.mul(t).mul(float(3).sub(t.mul(2))).sub(t).mul(softness)))
    const here = select(j.equal(i), above.sub(j.mul(slice)).mul(s), float(0))
    y = y.add(select(j.greaterThan(i), slice.mul(s), here))
    widthScale = select(j.equal(i), s, widthScale)
  }
  shared = vec3(positionLocal.x.mul(widthScale), base.add(y), positionLocal.z.mul(widthScale))
  return shared
}

/** Record the mesh's own height range (in its geometry space) for the position node. */
export function prepareShrink(mesh: THREE.Mesh) {
  const geometry = mesh.geometry
  if (!geometry.boundingBox) geometry.computeBoundingBox()
  const box = geometry.boundingBox!
  mesh.userData.shrinkBase = box.min.y
  mesh.userData.shrinkHeight = Math.max(box.max.y - box.min.y, 1e-4)
  mesh.userData.shrinkP ??= 0
}

export type ShrinkOrder = "nearest" | "farthest" | "random" | "together"

export type ShrinkOptions = {
  goal: boolean
  dt: number
  duration: number
  spread: number
  /** Maps a plant's 0…1 time to its 0…1 progress. */
  ease: (t: number) => number
  order: ShrinkOrder
  /** Speed of the way back relative to the way out. */
  returnSpeed: number
  focus: THREE.Vector3
}

/**
 * Drives every plant's progress. `goal` true = going away. One global clock runs 0→1 (and back, in reverse order) over
 * duration + spread; each plant starts after its own delay, ranked by distance to `focus` (or random, or all at once).
 */
export function createShrinkDriver() {
  const clock = { value: 0, away: false }
  const delays = new Map<THREE.Mesh, number>()
  const position = new THREE.Vector3()
  let lastTotal = 1
  return {
    update(meshes: readonly THREE.Mesh[], o: ShrinkOptions) {
      if (o.goal && !clock.away && clock.value === 0) {
        // Starting from fully grown: rank every plant by its distance to the light being looked at.
        let farthest = 1e-4
        for (const mesh of meshes) { delays.set(mesh, mesh.getWorldPosition(position).distanceTo(o.focus)); farthest = Math.max(farthest, delays.get(mesh)!) }
        meshes.forEach((mesh, index) => {
          const near = delays.get(mesh)! / farthest
          const rank = o.order === "nearest" ? near : o.order === "farthest" ? 1 - near : o.order === "random" ? ((Math.sin(index * 12.9898) * 43758.5453) % 1 + 1) % 1 : 0
          delays.set(mesh, rank * o.spread)
        })
      }
      clock.away = o.goal
      const total = o.duration + o.spread
      lastTotal = total
      clock.value = THREE.MathUtils.clamp(clock.value + (o.goal ? 1 : -o.returnSpeed) * o.dt / total, 0, 1)
      for (const mesh of meshes) {
        const p = o.ease(THREE.MathUtils.clamp((clock.value * total - (delays.get(mesh) ?? 0)) / o.duration, 0, 1))
        mesh.userData.shrinkP = p
        mesh.visible = p < 1
      }
    },
    /** Seconds the out animation has been running (0 when everything is grown). */
    get elapsed() { return clock.value * (lastTotal) },
    /** True while any plant is shrunk or shrinking. */
    get active() { return clock.value > 0 },
  }
}

/** The dust the tiger's steps kick up: fades out at the start of the out animation and back in when it ends (it is not a plant, so it does not shrink). */
export function updateDustFade(dust: readonly THREE.Mesh[], elapsed: number, fadeSeconds: number) {
  const fade = THREE.MathUtils.clamp(elapsed / Math.max(fadeSeconds, 1e-3), 0, 1)
  for (const mesh of dust) {
    const material = mesh.material as THREE.Material
    material.opacity = (mesh.userData.dustOpacity ??= material.opacity) * (1 - fade)
    mesh.visible = fade < 1
  }
}
