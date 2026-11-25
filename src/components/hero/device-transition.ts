/* eslint-disable react-hooks/immutability */
"use client"
import { useEffect, useMemo } from "react"
import * as THREE from "three"
import { dot, float, floor, fract, length, normalLocal, positionLocal, screenCoordinate, screenSize, sin, step, texture as tslTexture, uniform, vec2, vec3 } from "three/tsl"
import { MeshBasicNodeMaterial, MeshPhysicalNodeMaterial } from "three/webgpu"
import { getProjectionTexture } from "./projection-image"

export const deviceReveal = { active: false, progress: 0 }
// AsciiMaterialReveal: 0.6s hold on ASCII, then chrome replaces random ASCII cells in 8 steps over 0.6s (seed 1, 147-column grid).
export const deviceTransition = { delay: 0.6, duration: 0.6, steps: 8, seed: 1, columns: 147 } as const
/**
 * The searchlight's lens, measured from the model (Plant_Searchlight_v2, local space): a flat glass disc facing +z and tilted up by
 * about 19 degrees. The skull is a planar projection along that axis onto the glass, so it takes the lens's own perspective: it
 * foreshortens with the lamp's orientation, not with the camera.
 */
const LENS_AXIS = new THREE.Vector3(0, 0.323, 0.946).normalize()
const LENS_RIGHT = new THREE.Vector3(1, 0, 0)
const LENS_UP = new THREE.Vector3(0, LENS_AXIS.z, -LENS_AXIS.y)
const LENS_PLANE = 0.5 // the glass is a flat disc at 0.54 along the axis; the rim and barrel front edge sit just in front of it
const LENS_CENTRE_V = 0.1 // the disc is centred this far up its own v axis
const LENS_RADIUS = 0.58 // inside the rim
const DECAL_SIZE = 0.92 // skull width; the glass is about 1.24 across, the skull's corners stay inside the rim

const revealed = uniform(0)

/** The reveal's cell test: 1 where chrome has already replaced the ASCII. Same grid and seed as the original transition. */
function revealCells() {
  const cellW = screenSize.x.div(deviceTransition.columns)
  const cell = floor(screenCoordinate.div(vec2(cellW, cellW.mul(2))))
  const random = fract(sin(dot(cell.add(deviceTransition.seed * 17.17), vec2(12.9898, 78.233))).mul(43758.5453))
  return step(random, revealed.sub(1e-4)).max(step(0.9999, revealed))
}

/** 1 on the skull's pixels, on the lens glass only. */
function decalMask(map: THREE.Texture) {
  const onLens = vec2(dot(positionLocal, vec3(LENS_RIGHT)), dot(positionLocal, vec3(LENS_UP)).sub(LENS_CENTRE_V))
  const uvDecal = onLens.div(DECAL_SIZE).add(0.5)
  const inside = step(0, uvDecal.x).mul(step(uvDecal.x, 1)).mul(step(0, uvDecal.y)).mul(step(uvDecal.y, 1))
  const onGlass = step(LENS_PLANE, dot(positionLocal, vec3(LENS_AXIS))).mul(step(0.8, dot(normalLocal, vec3(LENS_AXIS)))).mul(step(length(onLens), LENS_RADIUS))
  return tslTexture(map, uvDecal).a.mul(inside).mul(onGlass)
}

/**
 * Chrome that only exists in the cells already picked by the reveal, and not under the skull. The device keeps its ASCII material on
 * layer 0 the whole time, so unrevealed cells still show ASCII; the chrome copy is a child on layer 1 (the clean pass) that discards the
 * other cells. Where the skull is on the glass, the chrome is cut away and an ASCII-pass overlay (layer 0, bright) shows through as glyphs instead.
 */
function revealMaterial(chrome: MeshPhysicalNodeMaterial, side: THREE.Side, mask: ReturnType<typeof decalMask>) {
  const material = chrome.clone()
  material.opacityNode = revealCells().mul(float(1).sub(step(0.5, mask)))
  material.alphaTest = 0.5
  material.side = side
  return material
}
function skullOverlayMaterial(side: THREE.Side, mask: ReturnType<typeof decalMask>) {
  const material = new MeshBasicNodeMaterial({ color: "#ffffff", fog: false, toneMapped: false })
  material.colorNode = vec3(1, 1, 1)
  material.opacityNode = revealCells().mul(step(0.5, mask))
  material.alphaTest = 0.5
  material.side = side
  material.polygonOffset = true; material.polygonOffsetFactor = -2; material.polygonOffsetUnits = -2
  return material
}

export function useDeviceTransition(chrome: MeshPhysicalNodeMaterial) {
  const controller = useMemo(() => {
    let active: THREE.Mesh | null = null
    let copies: THREE.Mesh[] = []
    let materials: THREE.Material[] = []
    let t = 0, hold = 0
    const restore = () => {
      copies.forEach(copy => copy.removeFromParent())
      materials.forEach(m => m.dispose())
      active = null; copies = []; materials = []; t = 0; hold = 0
      revealed.value = 0; deviceReveal.active = false; deviceReveal.progress = 0
    }
    return { restore, update(target: THREE.Mesh | null, delta: number, _pointer: THREE.Vector2, reduced: boolean, reverse = false) {
      if (target !== active) {
        restore()
        if (target) {
          active = target
          const mask = decalMask(getProjectionTexture())
          const sources = Array.isArray(target.material) ? target.material : [target.material]
          const chromes = sources.map(source => revealMaterial(chrome, source.side, mask))
          const overlays = sources.map(source => skullOverlayMaterial(source.side, mask))
          materials = [...chromes, ...overlays]
          const copy = new THREE.Mesh(target.geometry, Array.isArray(target.material) ? chromes : chromes[0])
          copy.layers.set(1); copy.frustumCulled = false
          const overlay = new THREE.Mesh(target.geometry, Array.isArray(target.material) ? overlays : overlays[0])
          overlay.layers.set(0); overlay.frustumCulled = false; overlay.renderOrder = 1
          target.add(copy, overlay); copies = [copy, overlay]
          deviceReveal.active = true
        }
      }
      if (!active) return
      const dt = Math.min(delta, 0.1)
      if (reduced) t = reverse ? 0 : 1
      else if (reverse) { t = Math.max(0, t - dt / deviceTransition.duration); if (t === 0) hold = 0 } // the same cells, the same 8 steps, backwards
      else { hold += dt; if (hold > deviceTransition.delay) t = Math.min(1, t + dt / deviceTransition.duration) }
      deviceReveal.progress = t
      // Stop-motion: 8 discrete steps, not a continuous fade.
      revealed.value = Math.ceil(t * deviceTransition.steps) / deviceTransition.steps
    } }
  }, [chrome])
  useEffect(() => () => controller.restore(), [controller])
  return controller
}
