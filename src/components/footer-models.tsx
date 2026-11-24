/* HDR maps, materials and the render loop are mutable Three.js resources. */
/* eslint-disable react-hooks/immutability */
"use client"

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { HDRLoader } from "three/addons/loaders/HDRLoader.js"
import { studioNormalization } from "./hero/chrome-environment"
import { useGradientSettings, type GradientSettings } from "./gradient-settings"

/**
 * The three footer icons (jaws, eagle, tiger) as real chrome in ONE small WebGL canvas (one context for all three).
 * Same recipe as the About skull and the hero tiger: the Shader Lab studio HDR, its irradiance normalisation, the studio alignment, a white key light,
 * colour #fff, roughness 0.04, metalness 1. Plain WebGL (MeshPhysicalMaterial) so it works wherever the skull does.
 *
 * Every number is live in the properties panel (Footer tab): per-model size and resting angle, how far and how fast they follow the cursor, the chrome
 * and the light. Following: each model turns its face towards the pointer (up to `fmYaw` sideways, `fmPitch` up / down, reached `fmReach` px from the icon)
 * and eases there with an `fmEase` ms time constant. Demand rendering: frames are drawn only while a model is still moving or a value changed.
 *
 * Budget: three GLBs of ~25KB each (textures stripped, ~5k triangles, meshopt), the HDR is already cached by the skull. The canvas is 144×50 CSS px of
 * layout (plus a transparent margin so a model scaled past its box is not clipped) and only renders while on screen. The Figma pictures sit underneath
 * as the fallback (no WebGL) and until the first frame.
 */
const STUDIO_URL = "/environments/studio_small_03_1k.hdr"
type Key = keyof GradientSettings
/** The icons of the design: file, box size, poster, and the settings that belong to each. */
const ICONS = [
  { url: "/models/footer/jaws.glb", w: 14.681, h: 16.698, poster: "/images/footer/jaws.webp", scale: "fmJawsScale", yaw: "fmJawsYaw", pitch: "fmJawsPitch" },
  { url: "/models/footer/eagle.glb", w: 14.681, h: 16.698, poster: "/images/footer/eagle.webp", scale: "fmEagleScale", yaw: "fmEagleYaw", pitch: "fmEaglePitch" },
  { url: "/models/footer/tiger.glb", w: 14.681, h: 16.698, poster: "/images/footer/tiger.webp", scale: "fmTigerScale", yaw: "fmTigerYaw", pitch: "fmTigerPitch" },
] as const satisfies readonly { url: string; w: number; h: number; poster: string; scale: Key; yaw: Key; pitch: Key }[]
const HEIGHT = Math.max(...ICONS.map(icon => icon.h))
/** Transparent margin round the layout box inside the canvas, CSS px. */
const PAD = 48
const rad = THREE.MathUtils.degToRad

/** The pointer in window coordinates; null until it moves (the models rest at their set angle until then). */
type Pointer = { x: number; y: number } | null
type PointerRef = { current: Pointer }

function Icon({ icon, x, material, pointer }: { icon: (typeof ICONS)[number]; x: number; material: THREE.Material; pointer: PointerRef }) {
  const s = useGradientSettings()
  const { scene: shared } = useGLTF(icon.url)
  const scene = useMemo(() => shared.clone(true), [shared])
  const group = useRef<THREE.Group>(null)
  const gl = useThree(state => state.gl)
  const invalidate = useThree(state => state.invalidate)
  const size = Math.min(icon.w, icon.h)
  // Centre the model on its bounding box and scale it so its longest side fills the box.
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene)
    const centre = box.getCenter(new THREE.Vector3())
    const longest = Math.max(...box.getSize(new THREE.Vector3()).toArray()) || 1
    return { centre, scale: size / longest }
  }, [scene, size])
  useLayoutEffect(() => { scene.traverse(object => { if (object instanceof THREE.Mesh) object.material = material }) }, [scene, material])
  // Yaw first, then pitch: "turn to face you, then look up or down".
  useLayoutEffect(() => { if (group.current) group.current.rotation.order = "YXZ" }, [])
  useEffect(() => { invalidate() }, [s, invalidate])
  const restYaw = rad(s[icon.yaw] as number), restPitch = rad(s[icon.pitch] as number)
  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    let yaw = restYaw, pitch = restPitch
    const p = pointer.current
    if (p && s.fmFollow) {
      // The icon's centre on screen: the canvas is orthographic at zoom 1, so one world unit is one CSS pixel.
      const rect = gl.domElement.getBoundingClientRect()
      const dx = p.x - (rect.left + rect.width / 2 + x), dy = p.y - (rect.top + rect.height / 2)
      yaw = restYaw + THREE.MathUtils.clamp(dx / s.fmReach, -1, 1) * rad(s.fmYaw)
      pitch = restPitch + THREE.MathUtils.clamp(dy / s.fmReach, -1, 1) * rad(s.fmPitch)
    }
    const k = s.fmEase <= 0 ? 1 : 1 - Math.exp(-Math.min(delta, 0.05) / (s.fmEase / 1000))
    g.rotation.y += (yaw - g.rotation.y) * k
    g.rotation.x += (pitch - g.rotation.x) * k
    if (Math.abs(yaw - g.rotation.y) > 0.0005 || Math.abs(pitch - g.rotation.x) > 0.0005) invalidate()
  })
  return (
    <group position={[x, 0, 0]} scale={fit.scale * (s[icon.scale] as number) / 100}>
      <group ref={group}><primitive object={scene} position={[-fit.centre.x, -fit.centre.y, -fit.centre.z]} /></group>
    </group>
  )
}

function Chrome({ pointer, onReady }: { pointer: PointerRef; onReady: () => void }) {
  const s = useGradientSettings()
  const texture = useLoader(HDRLoader, STUDIO_URL)
  const normalization = useMemo(() => studioNormalization(texture), [texture])
  const alignment = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(rad(26.4), rad(-71.8), rad(37.4), "XYZ")).invert(), [])
  const turn = useMemo(() => new THREE.Quaternion(), [])
  const axis = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const material = useMemo(() => {
    texture.mapping = THREE.EquirectangularReflectionMapping
    const m = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide })
    m.envMap = texture
    return m
  }, [texture])
  const invalidate = useThree(state => state.invalidate)
  useLayoutEffect(() => {
    material.color.set(s.fmColor)
    material.roughness = s.fmRoughness
    material.metalness = s.fmMetalness
    material.envMapIntensity = s.fmLight * normalization
    turn.setFromAxisAngle(axis, rad(s.fmStudioRotation)).premultiply(alignment)
    material.envMapRotation.setFromQuaternion(turn)
    invalidate()
  }, [material, normalization, alignment, turn, axis, invalidate, s.fmColor, s.fmRoughness, s.fmMetalness, s.fmLight, s.fmStudioRotation])
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => { onReady(); invalidate() }, [onReady, invalidate])
  const width = ICONS.reduce((sum, icon) => sum + icon.w, 0) + s.fmGap * (ICONS.length - 1)
  let x = -width / 2
  return (
    <>
      <directionalLight color="#ffffff" intensity={s.fmKey} position={[-5, 5, 7.07]} />
      {ICONS.map(icon => {
        const centre = x + icon.w / 2
        x += icon.w + s.fmGap
        return <Icon key={icon.url} icon={icon} x={centre} material={material} pointer={pointer} />
      })}
    </>
  )
}

/** Window pointer → ref, and a redraw request for the canvas (it renders on demand). */
function PointerBridge({ pointer }: { pointer: PointerRef }) {
  const invalidate = useThree(state => state.invalidate)
  useEffect(() => {
    const move = (event: PointerEvent) => { pointer.current = { x: event.clientX, y: event.clientY }; invalidate() }
    const leave = () => { pointer.current = null; invalidate() }
    window.addEventListener("pointermove", move, { passive: true })
    document.documentElement.addEventListener("pointerleave", leave)
    return () => { window.removeEventListener("pointermove", move); document.documentElement.removeEventListener("pointerleave", leave) }
  }, [pointer, invalidate])
  return null
}

export default function FooterModels() {
  const s = useGradientSettings()
  const root = useRef<HTMLDivElement>(null)
  const pointer = useRef<Pointer>(null)
  const [visible, setVisible] = useState(false)
  const [seen, setSeen] = useState(false) // mounted on first sight, then kept: the pointer is only tracked while it is on screen
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const el = root.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => { setVisible(entry.isIntersecting); if (entry.isIntersecting) setSeen(true) }, { rootMargin: "100px" })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const width = ICONS.reduce((sum, icon) => sum + icon.w, 0) + s.fmGap * (ICONS.length - 1)
  return (
    <div ref={root} className="footer-models" style={{ width, height: HEIGHT }} role="img" aria-label="Shark, eagle and tiger in chrome">
      <div className="footer-models-posters" style={{ opacity: ready ? 0 : 1, gap: s.fmGap }}>
        {ICONS.map(icon => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={icon.url} src={icon.poster} alt="" width={icon.w} height={icon.h} style={{ width: icon.w, height: icon.h }} />
        ))}
      </div>
      {seen && (
        <div style={{ position: "absolute", inset: -PAD, pointerEvents: "none" }}>
          <Canvas flat orthographic frameloop={visible ? "demand" : "never"} dpr={[1, 2]} camera={{ zoom: 1, position: [0, 0, 100], near: 0.1, far: 400 }}
            gl={{ alpha: true, antialias: true, powerPreference: "low-power" }} style={{ width: "100%", height: "100%", pointerEvents: "none" }}>
            <PointerBridge pointer={pointer} />
            <Suspense fallback={null}><Chrome pointer={pointer} onReady={() => setReady(true)} /></Suspense>
          </Canvas>
        </div>
      )}
    </div>
  )
}
