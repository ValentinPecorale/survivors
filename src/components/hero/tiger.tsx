/* Skin bounds and animation actions are mutable Three.js render-loop resources. */
/* eslint-disable react-hooks/immutability */
"use client"

import { useAnimations, useGLTF } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { TigerSurface, ChromeKeyLight } from "./tiger-surface"
import referenceFrame from "./tiger-framing.json"
import type { TigerFrame } from "./camera-framing"
import type { ModelSettings } from "./live-settings"

const TIGER_URL = "/models/tiger.glb?v=landing-20261110"
useGLTF.preload(TIGER_URL)

/** Layer 1 bypasses ASCII; the authored pivot matches the environment export. */
export function Tiger({ settings, orbitTarget, subjectFrame }: { settings: ModelSettings; orbitTarget: THREE.Vector3; subjectFrame: TigerFrame }) {
  const { scene, animations } = useGLTF(TIGER_URL)
  const { actions, mixer } = useAnimations(animations, scene)
  const group = useRef<THREE.Group>(null)
  const framing = useMemo(() => {
    const center = new THREE.Vector3().fromArray(referenceFrame.center)
    const low = new THREE.Vector3().fromArray(referenceFrame.min)
    const high = new THREE.Vector3().fromArray(referenceFrame.max)
    const margin = high.clone().sub(low).multiplyScalar(referenceFrame.padding / 2)
    low.sub(margin); high.add(margin)
    const local = new Float32Array(24)
    let index = 0
    for (const x of [low.x, high.x]) for (const y of [low.y, high.y]) for (const z of [low.z, high.z]) {
      local[index++] = x; local[index++] = y; local[index++] = z
    }
    return { center, local, points: new Float32Array(24), point: new THREE.Vector3(), matrix: new THREE.Matrix4(), ready: false }
  }, [])
  const clip = actions.Loop ?? Object.values(actions)[0]

  const updateTarget = () => {
    if (!group.current) return
    group.current.updateWorldMatrix(true, false)
    // The fixed full-loop envelope ignores the animated bones entirely.
    // Only explicit position, rotation or scale edits can move the target.
    if (framing.ready && framing.matrix.equals(group.current.matrixWorld)) return
    framing.matrix.copy(group.current.matrixWorld)
    framing.ready = true
    orbitTarget.copy(framing.center).applyMatrix4(framing.matrix)
    for (let i = 0; i < framing.local.length; i += 3) {
      framing.point.fromArray(framing.local, i).applyMatrix4(framing.matrix)
      framing.point.toArray(framing.points, i)
    }
    subjectFrame.points = framing.points
    subjectFrame.count = framing.points.length
  }
  useLayoutEffect(updateTarget)
  useFrame(updateTarget, 0.25)

  useLayoutEffect(() => {
    scene.traverse(object => { object.layers.set(1) })
  }, [scene])

  useEffect(() => {
    clip?.reset().play()
    return () => { clip?.stop() }
  }, [clip])

  useEffect(() => {
    if (!clip) return
    clip.clampWhenFinished = true
    clip.setLoop(settings.repeat === "once" ? THREE.LoopOnce : settings.repeat === "pingpong" ? THREE.LoopPingPong : THREE.LoopRepeat, Infinity)
    clip.paused = !settings.playing
    clip.timeScale = settings.speed
    if (settings.playing) { clip.enabled = true; clip.play() }
  }, [clip, settings.playing, settings.speed, settings.repeat])

  useEffect(() => {
    if (clip) { clip.time = settings.start; mixer.update(0) }
  }, [clip, mixer, settings.start])

  return <>
    {settings.tigerMaterial === "chrome" && <ChromeKeyLight />}
    <Suspense fallback={null}><TigerSurface scene={scene} settings={settings} /></Suspense>
    <group ref={group} visible={settings.tigerVisible} position={[settings.tigerX, settings.tigerY, settings.tigerZ]} scale={settings.tigerScale} rotation={[0, THREE.MathUtils.degToRad(settings.tigerRotation), 0]}>
    <primitive object={scene} />
    </group>
  </>
}
