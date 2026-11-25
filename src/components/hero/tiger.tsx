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
import { skyLook } from "./sky-look"
import { runState } from "./run-state"

/** How far behind its place the tiger re-enters from, in world units, once the sky view is left: beyond the frame edge. */
const REENTRY_DISTANCE = 16
/** Past this the tiger is out of the shot, so it may be moved behind the camera frame without a visible pop. */
const OFFSCREEN_DISTANCE = 9

const TIGER_URL = "/models/tiger.glb?v=landing-20261110"
useGLTF.preload(TIGER_URL)

/** Layer 1 bypasses ASCII; the authored pivot matches the environment export. */
export function Tiger({ settings, orbitTarget, subjectFrame }: { settings: ModelSettings; orbitTarget: THREE.Vector3; subjectFrame: TigerFrame }) {
  const { scene, animations } = useGLTF(TIGER_URL)
  const { actions, mixer } = useAnimations(animations, scene)
  const group = useRef<THREE.Group>(null)
  const run = useRef<THREE.Group>(null)
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

  // Sky view: the ground has stopped, so the tiger itself carries the speed the ground had and runs out of the frame along its own
  // forward axis (-Z in the tiger's space, against the way the forest scrolls). The framing target above never sees this: it reads
  // the outer group, and only this inner one moves. Leaving the view, it re-enters from behind, running forward the whole time.
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const away = skyLook.target > 0
    if (away) runState.travel += runState.groundSpeed * settings.speed * skyLook.progress * dt
    else if (runState.travel > OFFSCREEN_DISTANCE) runState.travel = -REENTRY_DISTANCE
    else runState.travel -= runState.travel * (1 - Math.exp(-dt / 0.6))
    if (Math.abs(runState.travel) < 0.001) runState.travel = 0
    // While it is away from the shot and coming back, keep its gait in step with the forest it is rejoining.
    if (!away && runState.travel !== 0 && clip) clip.time = runState.forestTime
    if (run.current) run.current.position.z = -runState.travel / Math.max(settings.tigerScale, 0.001)
  }, 0.45)

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
    <group ref={run}><primitive object={scene} /></group>
    </group>
  </>
}
