/* HDR maps, materials and the render loop are mutable Three.js resources. */
/* eslint-disable react-hooks/immutability */
"use client"

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import { useLayoutEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { HDRLoader } from "three/addons/loaders/HDRLoader.js"
import { studioNormalization } from "./hero/chrome-environment"
import type { GradientSettings } from "./gradient-settings"

/**
 * The About skull: skull_web.glb (meshopt-compressed, 77KB, 16.8k triangles) with the same chrome as the hero tiger.
 * "Same material" is the tiger's recipe, not a lookalike: the same Shader Lab studio HDR, the same irradiance
 * normalisation, the same studio alignment, the same white key light fixed in camera space, and the same
 * defaults (colour #fff, roughness 0.04, metalness 1). Only the renderer differs: this canvas is plain WebGL, so
 * it works in browsers that fall back to the static poster in the hero.
 *
 * frameloop="demand": nothing renders unless the scroll moves the rotation or a setting changes.
 */

const SKULL_URL = "/models/skull.glb"
const STUDIO_URL = "/environments/studio_small_03_1k.hdr"
/** A long, flat lens (20°): a short one magnifies the face (the nearest surface) well past the Figma proportions. */
const CAMERA_FOV = 20
const CAMERA_DISTANCE = 19
/** Multiplier so that skullSize 90% really fills 90% of the canvas height at the front view. Measured: with the lens above the front view fills 97.3% of the height at FIT 1. */
const FIT = 0.925
/** Radians to turn skull_web.glb so its face points at the camera at rotation 0. */
const FRONT = Math.PI * 1.5

/** Mutable bridge between the scrolling frame (writes angle) and the canvas (reads it, then renders). */
export type SkullBridge = { angle: number; invalidate: () => void }

type Props = { settings: GradientSettings; bridge: { current: SkullBridge }; onReady: () => void }

function Skull({ settings, bridge, onReady }: Props) {
  const { scene } = useGLTF(SKULL_URL)
  const texture = useLoader(HDRLoader, STUDIO_URL)
  const invalidate = useThree(s => s.invalidate)
  const group = useRef<THREE.Group>(null)
  const normalization = useMemo(() => studioNormalization(texture), [texture])
  // Same studio orientation the tiger uses, so the reflections fall on the same kinds of surface.
  const alignment = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(26.4), THREE.MathUtils.degToRad(-71.8), THREE.MathUtils.degToRad(37.4), "XYZ")).invert(), [])
  const turn = useMemo(() => new THREE.Quaternion(), [])
  const axis = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const material = useMemo(() => {
    texture.mapping = THREE.EquirectangularReflectionMapping
    const m = new THREE.MeshPhysicalMaterial()
    m.envMap = texture
    return m
  }, [texture])

  useLayoutEffect(() => {
    scene.traverse(object => { if (object instanceof THREE.Mesh) object.material = material })
    const shared = bridge.current
    shared.invalidate = invalidate
    onReady()
    invalidate()
    return () => { shared.invalidate = () => {}; material.dispose() }
  }, [scene, material, bridge, invalidate, onReady])

  useLayoutEffect(() => {
    material.color.set(settings.skullColor)
    material.roughness = settings.skullRoughness
    material.metalness = settings.skullMetalness
    material.envMapIntensity = settings.skullLight * normalization
    turn.setFromAxisAngle(axis, THREE.MathUtils.degToRad(settings.skullStudioRotation)).premultiply(alignment)
    material.envMapRotation.setFromQuaternion(turn)
    invalidate()
  }, [material, normalization, alignment, turn, axis, invalidate, settings.skullColor, settings.skullRoughness, settings.skullMetalness, settings.skullLight, settings.skullStudioRotation, settings.skullSize])

  // The file's front is 270° round from the camera, so offset it: at the start of the scroll the skull faces you.
  useFrame(() => { if (group.current) group.current.rotation.y = bridge.current.angle + FRONT })

  // Fits the skull's 6.08-unit height to skullSize% of the canvas at the camera distance set below (90% by default).
  return <group ref={group} scale={settings.skullSize / 90 * FIT}><primitive object={scene} /></group>
}

/** The tiger's key light: white, intensity 1, fixed in camera space (the camera here never moves). */
function KeyLight() {
  return <directionalLight color="#ffffff" intensity={1} position={[-5, 5, 7.07]} />
}

export function SkullCanvas(props: Props) {
  return (
    <Canvas flat frameloop="demand" dpr={[1, 1.5]} camera={{ fov: CAMERA_FOV, position: [0, 0, CAMERA_DISTANCE], near: 0.1, far: 80 }}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      // R3F's container takes pointer events by default; this canvas must let them through to the names beneath it.
      style={{ width: "100%", height: "100%", pointerEvents: "none" }}>
      <KeyLight />
      <Skull {...props} />
    </Canvas>
  )
}
