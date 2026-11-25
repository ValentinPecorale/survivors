/* HDR maps and Three.js materials are mutable render resources. */
/* eslint-disable react-hooks/immutability */
"use client"

import { useLoader, useThree, useFrame } from "@react-three/fiber"
import { useLayoutEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { MeshPhysicalNodeMaterial } from "three/webgpu"
import { HDRLoader } from "three/addons/loaders/HDRLoader.js"
import { studioNormalization } from "./chrome-environment"
import type { ModelSettings } from "./live-settings"

const STUDIO_URL = "/environments/studio_small_03_1k.hdr"

type SurfaceMaterial = THREE.MeshStandardMaterial | MeshPhysicalNodeMaterial

type Props = { scene: THREE.Object3D; settings: ModelSettings }

function useSurface(scene: THREE.Object3D, create: () => SurfaceMaterial, identity: unknown) {
  const materials = useRef<SurfaceMaterial[]>([])
  useLayoutEffect(() => {
    const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>()
    const created: SurfaceMaterial[] = []
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      originals.set(object, object.material)
      const replace = (source: THREE.Material) => {
        const material = create()
        material.side = source.side
        material.transparent = source.transparent
        material.opacity = source.opacity
        material.alphaTest = source.alphaTest
        material.depthWrite = source.depthWrite
        created.push(material)
        return material
      }
      object.material = Array.isArray(object.material) ? object.material.map(replace) : replace(object.material)
    })
    materials.current = created
    return () => {
      originals.forEach((material, mesh) => { mesh.material = material })
      materials.current = []
      created.forEach(material => material.dispose())
    }
    // The material factory is keyed by its resource identity, never slider state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, identity])
  return materials
}

/** The .lab's studio rotation, undone (see ChromeSurface), and the scratch values the chrome look is built from. */
const STUDIO_ALIGNMENT = new THREE.Quaternion().setFromEuler(new THREE.Euler(
  THREE.MathUtils.degToRad(26.4), THREE.MathUtils.degToRad(-71.8), THREE.MathUtils.degToRad(37.4), "XYZ")).invert()
const studioTurn = new THREE.Quaternion()
const studioAxis = new THREE.Vector3(0, 1, 0)

/** The tiger's chrome look, as one function: both the tiger and anything else that must match it (the targeted searchlight) use it. */
function applyChrome(material: SurfaceMaterial, settings: ModelSettings, normalization: number) {
  material.color.set(settings.tigerColor)
  material.roughness = settings.tigerRoughness
  material.metalness = settings.tigerMetalness
  material.wireframe = settings.tigerWireframe
  material.envMapIntensity = settings.tigerReflection * normalization
  studioTurn.setFromAxisAngle(studioAxis, THREE.MathUtils.degToRad(settings.tigerStudioRotation)).premultiply(STUDIO_ALIGNMENT)
  material.envMapRotation.setFromQuaternion(studioTurn)
}

/** One shared chrome material, identical to the tiger's and following the same panel settings. Suspends until the studio HDR is loaded. */
export function useChromeMaterial(settings: ModelSettings) {
  const texture = useLoader(HDRLoader, STUDIO_URL)
  const normalization = useMemo(() => studioNormalization(texture), [texture])
  const material = useMemo(() => {
    texture.mapping = THREE.EquirectangularReflectionMapping
    const created = new MeshPhysicalNodeMaterial()
    created.envMap = texture
    return created
  }, [texture])
  useLayoutEffect(() => { applyChrome(material, settings, normalization) }, [material, normalization, settings])
  useLayoutEffect(() => () => material.dispose(), [material])
  return material
}

function ChromeSurface({ scene, settings }: Props) {
  const texture = useLoader(HDRLoader, STUDIO_URL)
  const normalization = useMemo(() => studioNormalization(texture), [texture])
  // The .lab rotates the model in a standalone viewer. Rotate its studio in
  // the opposite direction here to keep those reflections on the same surfaces
  // while retaining the GLB's authored placement in the forest.
  const studioAlignment = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(26.4), THREE.MathUtils.degToRad(-71.8), THREE.MathUtils.degToRad(37.4), "XYZ")).invert(), [])
  const studioTurn = useMemo(() => new THREE.Quaternion(), [])
  const studioAxis = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const materials = useSurface(scene, () => {
    texture.mapping = THREE.EquirectangularReflectionMapping
    const material = new MeshPhysicalNodeMaterial()
    material.envMap = texture
    return material
  }, texture)
  useLayoutEffect(() => {
    materials.current.forEach(material => {
      material.color.set(settings.tigerColor)
      material.roughness = settings.tigerRoughness
      material.metalness = settings.tigerMetalness
      material.wireframe = settings.tigerWireframe
      material.envMapIntensity = settings.tigerReflection * normalization
      studioTurn.setFromAxisAngle(studioAxis, THREE.MathUtils.degToRad(settings.tigerStudioRotation)).premultiply(studioAlignment)
      material.envMapRotation.setFromQuaternion(studioTurn)
    })
  }, [materials, normalization, studioAlignment, studioTurn, studioAxis, settings.tigerColor, settings.tigerRoughness, settings.tigerMetalness, settings.tigerWireframe, settings.tigerReflection, settings.tigerStudioRotation])
  return null
}

function OriginalSurface({ scene, settings }: Props) {
  useLayoutEffect(() => {
    const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>()
    const created: THREE.Material[] = []
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      originals.set(object, object.material)
      const clone = (source: THREE.Material) => {
        const material = source.clone()
        if ("wireframe" in material) material.wireframe = settings.tigerWireframe
        created.push(material)
        return material
      }
      object.material = Array.isArray(object.material) ? object.material.map(clone) : clone(object.material)
    })
    return () => { originals.forEach((material, mesh) => { mesh.material = material }); created.forEach(material => material.dispose()) }
  }, [scene, settings.tigerWireframe])
  return null
}

export function TigerSurface(props: Props) {
  return props.settings.tigerMaterial === "chrome" ? <ChromeSurface {...props} /> : <OriginalSurface {...props} />
}

/** Shader Lab's white key, intensity 1, 135° azimuth / 45° elevation in camera space. */
export function ChromeKeyLight() {
  const camera = useThree(s => s.camera)
  const light = useRef<THREE.DirectionalLight>(null)
  const direction = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    direction.set(-0.5, 0.5, Math.SQRT1_2).applyQuaternion(camera.quaternion)
    light.current?.position.copy(direction).multiplyScalar(10)
  }, 0.75)
  return <directionalLight ref={light} layers-mask={2} color="#ffffff" intensity={1} />
}
