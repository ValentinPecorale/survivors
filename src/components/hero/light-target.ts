import * as THREE from "three"

/**
 * Where the sky view looks. The camera code (hero-scene) writes `reference` (the tiger framing target) every frame; the
 * searchlights (searchlights.tsx) pick the light nearest to it when the sky view starts, keep following that same light
 * while it travels, and publish its centre here in world space. Mutable on purpose, like skyLook: no React render per frame.
 */
export const lightTarget = {
  /** True while a light is being tracked and `point` is valid. */
  active: false,
  /** Centre of the tracked searchlight device (the lamp housing, not its beam), world space, continuous across the clip's loop. */
  point: new THREE.Vector3(),
  /** 0..1: how far the camera has moved on from the device to the projection. Time-driven, started by the searchlight once its chrome has landed. */
  look: 0,
  /** The camera's end pose for the sky step (hero-scene): the direction it ends up looking along, and its full orientation. The projection hangs there. */
  skyDir: new THREE.Vector3(0, 0, -1),
  skyQuat: new THREE.Quaternion(),
  /** The tiger framing target, to choose the nearest light. */
  reference: new THREE.Vector3(),
}
