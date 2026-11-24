/* Three.js cameras, uniforms and renderer settings are mutable objects owned by the render loop. */
/* eslint-disable react-hooks/immutability */
"use client"

import { useShaderLabPostProcessingSource } from "@basementstudio/shader-lab"
import { useAnimations, useGLTF } from "@react-three/drei"
import { updateSteps, hoverMove, hoverStop, preloadHover } from "./sound"
import { createPlantPicker } from "./plant-hover"
import { Canvas, createPortal, useFrame, useThree } from "@react-three/fiber"
import { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { float, texture as tslTexture, uv, vec2, uniform, mix, neutralToneMapping } from "three/tsl"
import { MeshBasicNodeMaterial, WebGPURenderer } from "three/webgpu"
import type { AsciiSettings, ModelSettings } from "./live-settings"
import landingKeys from "./camera-landing.json"
import { projectedBounds, type TigerFrame } from "./camera-framing"
import { useAsciiHover } from "./ascii-hover"
import { Tiger } from "./tiger"
import { getCardSettings, scrollCamera } from "../card-settings"
import { skyLook, stepSky } from "./sky-look"
import { asciiConfig, columnsFor } from "./ascii-config"
import { FloorText } from "./floor-text"

const MODEL_URL = "/models/plants.glb?v=frontplants-20261111"
useGLTF.preload(MODEL_URL)

/** Aspect the shot was framed for in Blender (camera.aspectRatio in the GLB). */
const AUTHORED_ASPECT = 16 / 9

/**
 * Plays the GLB exactly as framed in Blender, through the GLB's own camera.
 */
function Plants({ settings, orbitTarget, subjectFrame }: { settings: ModelSettings; orbitTarget: THREE.Vector3; subjectFrame: TigerFrame }) {
  const { scene, animations, cameras } = useGLTF(MODEL_URL)
  const { actions, mixer } = useAnimations(animations, scene)
  const set = useThree((s) => s.set)
  const size = useThree((s) => s.size)
  const canvas = useThree((s) => s.gl.domElement)
  const cursor = useRef({ targetX: 0, targetY: 0, x: 0, y: 0, allowed: false, reduced: false })
  const cameraOrbit = useMemo(() => ({ offset: new THREE.Vector3(), sphere: new THREE.Spherical(), radius: 0, sample: new THREE.Vector3() }), [])
  const landingLoops = useRef(0)
  const landing = useMemo(() => new THREE.LinearInterpolant(
    new Float32Array(landingKeys.times), new Float32Array(landingKeys.offsetY), 1), [])
  const root = useRef<THREE.Group>(null)
  const spin = useRef(0)
  const authored = useMemo(() => {
    scene.updateMatrixWorld(true)
    const source = cameras[0] as THREE.PerspectiveCamera
    const camera = source.clone()
    source.matrixWorld.decompose(camera.position, camera.quaternion, camera.scale)
    camera.scale.set(1, 1, 1)
    return { camera, position: new THREE.Vector3().fromArray(landingKeys.restPosition), fov: camera.fov }
  }, [scene, cameras])

  useLayoutEffect(() => { set({ camera: authored.camera }) }, [authored, set])
  /** Vertical fov for a focal length, keeping the authored 16:9 framing on wider screens. */
  const fovFor = (focal: number, aspect: number) => {
    const baseHalf = Math.atan(Math.tan(THREE.MathUtils.degToRad(authored.fov) / 2) * 85.56 / focal)
    return THREE.MathUtils.radToDeg(2 * (aspect > AUTHORED_ASPECT ? Math.atan(Math.tan(baseHalf) * AUTHORED_ASPECT / aspect) : baseHalf))
  }
  useLayoutEffect(() => {
    const { camera, fov } = authored
    const aspect = size.width / size.height
    const baseHalf = Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * 85.56 / settings.focalLength)
    camera.aspect = aspect
    camera.fov = THREE.MathUtils.radToDeg(2 * (aspect > AUTHORED_ASPECT
      ? Math.atan(Math.tan(baseHalf) * AUTHORED_ASPECT / aspect) : baseHalf))
    camera.setViewOffset(size.width, size.height, settings.shiftX * size.width / 2,
      -settings.shiftY * size.height / 2, size.width, size.height)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld(true)
  }, [authored, size, settings.focalLength, settings.shiftX, settings.shiftY])

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const pointer = window.matchMedia("(hover: hover) and (pointer: fine)")
    const state = cursor.current
    const center = () => { state.targetX = 0; state.targetY = 0 }
    const updatePreference = () => {
      state.reduced = motion.matches
      state.allowed = settings.cursorEnabled && !motion.matches && pointer.matches
      center()
    }
    const move = (event: PointerEvent) => {
      if (!state.allowed || event.pointerType === "touch") return
      const bounds = canvas.getBoundingClientRect()
      if (!bounds.width || !bounds.height) return
      state.targetX = THREE.MathUtils.clamp((event.clientX - bounds.left) / bounds.width * 2 - 1, -1, 1)
      state.targetY = THREE.MathUtils.clamp(1 - (event.clientY - bounds.top) / bounds.height * 2, -1, 1)
    }
    updatePreference()
    canvas.addEventListener("pointermove", move, { passive: true })
    canvas.addEventListener("pointerleave", center)
    canvas.addEventListener("pointercancel", center)
    window.addEventListener("blur", center)
    motion.addEventListener("change", updatePreference)
    pointer.addEventListener("change", updatePreference)
    return () => {
      canvas.removeEventListener("pointermove", move)
      canvas.removeEventListener("pointerleave", center)
      canvas.removeEventListener("pointercancel", center)
      window.removeEventListener("blur", center)
      motion.removeEventListener("change", updatePreference)
      pointer.removeEventListener("change", updatePreference)
    }
  }, [canvas, settings.cursorEnabled])

  const clip = actions.Loop ?? Object.values(actions)[0]
  useEffect(() => {
    landingLoops.current = 0
    const countLoop = (event: THREE.AnimationMixerEventMap["loop"]) => {
      if (event.action === clip) landingLoops.current += event.loopDelta
    }
    mixer.addEventListener("loop", countLoop)
    clip?.reset().play()
    return () => { mixer.removeEventListener("loop", countLoop); clip?.stop() }
  }, [clip, mixer])
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

  useEffect(() => {
    const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>()
    const created: THREE.Material[] = []
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      originals.set(object, object.material)
      const convert = (source: THREE.Material) => {
        const material = settings.material === "clay" ? new THREE.MeshStandardMaterial({ color: "#d5d5d0", roughness: 0.8 })
          : settings.material === "normal" ? new THREE.MeshNormalMaterial() : source.clone()
        if ("wireframe" in material) material.wireframe = settings.wireframe
        // Dust puffs sit at the tiger's paws; writing depth would clip the legs drawn afterwards.
        if (source.name === "Dust_Puff") material.depthWrite = false
        created.push(material)
        return material
      }
      object.material = Array.isArray(object.material) ? object.material.map(convert) : convert(object.material)
    })
    return () => { originals.forEach((material, mesh) => { mesh.material = material }); created.forEach(material => material.dispose()) }
  }, [scene, settings.material, settings.wireframe])
  useEffect(() => { if (settings.spin === 0) spin.current = 0 }, [settings.spin])
  // Plant hover rustle: one ray per animation frame at most, only while the pointer moves.
  const getState = useThree(s => s.get)
  const hoverVolume = useRef(settings.hoverVolume)
  const hoverTrack = useRef(settings.hoverTrack)
  useEffect(() => { hoverVolume.current = settings.hoverVolume; hoverTrack.current = settings.hoverTrack }, [settings.hoverVolume, settings.hoverTrack])
  useEffect(() => { if (settings.hoverSound) preloadHover(settings.hoverTrack) }, [settings.hoverSound, settings.hoverTrack])
  useEffect(() => {
    if (!settings.hoverSound) return
    const picker = createPlantPicker(scene)
    let frame = 0, speed = 0, lastX = 0, lastY = 0, lastT = 0
    let pending: { x: number; y: number } | null = null
    // The sound belongs to cursor movement: nothing here runs unless the pointer moves, so a still cursor
    // (even over a plant, even while trees animate past it) is silent; hoverMove's own timer releases it.
    const run = () => {
      frame = 0
      const at = pending; pending = null
      if (!at) return
      const hit = picker.pick(at.x, at.y, getState().camera)
      hoverMove(hoverTrack.current, hit?.kind ?? null, hoverVolume.current, at.x * 0.6, speed)
    }
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") return
      const bounds = canvas.getBoundingClientRect()
      if (!bounds.width || !bounds.height) return
      const dt = event.timeStamp - lastT
      if (lastT && dt > 0 && dt < 200) speed = speed * 0.5 + Math.hypot(event.clientX - lastX, event.clientY - lastY) / dt * 1000 * 0.5
      else speed = 0
      lastX = event.clientX; lastY = event.clientY; lastT = event.timeStamp
      pending = { x: (event.clientX - bounds.left) / bounds.width * 2 - 1, y: 1 - (event.clientY - bounds.top) / bounds.height * 2 }
      if (!frame) frame = requestAnimationFrame(run)
    }
    const leave = () => { pending = null; lastT = 0; hoverStop() }
    canvas.addEventListener("pointermove", move, { passive: true })
    canvas.addEventListener("pointerleave", leave)
    return () => {
      canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerleave", leave)
      if (frame) cancelAnimationFrame(frame)
      hoverStop()
      picker.dispose()
    }
  }, [scene, canvas, getState, settings.hoverSound])
  useFrame((_, delta) => {
    // Recorded footsteps, phase-locked to the clip clock (see sound.ts). Ping-pong reverses time, so it stays silent there.
    updateSteps({ enabled: settings.stepSound && settings.repeat !== "pingpong", playing: settings.playing, volume: settings.stepVolume, speed: settings.speed, clipTime: clip?.time ?? 0, offset: settings.stepOffset })
    const state = cursor.current
    // Exponential damping reaches 95% of the target within the smoothing time.
    // Clamp delta so restoring a background tab cannot produce a large jump.
    const blend = 1 - Math.exp(-3 * Math.min(delta, 0.1) / settings.cursorSmoothing)
    state.x = THREE.MathUtils.lerp(state.x, state.allowed ? state.targetX : 0, blend)
    state.y = THREE.MathUtils.lerp(state.y, state.allowed ? state.targetY : 0, blend)
    // Reduced motion and touch stay exactly at the authored/manual viewpoint.
    if (!state.allowed) { state.x = 0; state.y = 0 }
    const direction = settings.cursorReverse ? -1 : 1
    // Orbit on a sphere centered on the tiger, using world up for elevation.
    // This avoids rotating around the authored camera's forward axis (a roll).
    // Keep the authored viewing distance and lens, but make the resting view
    // exactly perpendicular to the tiger's path: no vertical tilt or roll.
    // The tiger's group yaw rotates its side normal from +X in world space.
    if (cameraOrbit.radius === 0) cameraOrbit.radius = authored.position.distanceTo(orbitTarget)
    cameraOrbit.sphere.set(
      cameraOrbit.radius,
      Math.PI / 2,
      Math.PI / 2 + THREE.MathUtils.degToRad(settings.tigerRotation),
    )
    // Scrolling blends the Camera tab settings toward the scroll camera target (Cards tab).
    const blend01 = scrollCamera.progress
    const target = getCardSettings()
    const mix = (from: number, to: number) => from + (to - from) * blend01
    const orbit = mix(settings.orbit, target.camOrbit)
    const elevation = mix(settings.elevation, target.camElevation)
    const shiftX = mix(settings.shiftX, target.camShiftX)
    const shiftY = mix(settings.shiftY, target.camShiftY)
    // The cursor orbit fades with the scroll camera (to 0 by default), so the high view stays still.
    const cursorH = mix(settings.cursorHorizontal, target.camCursorHorizontal)
    const cursorV = mix(settings.cursorVertical, target.camCursorVertical)
    cameraOrbit.sphere.theta += THREE.MathUtils.degToRad(orbit + state.x * cursorH * direction)
    cameraOrbit.sphere.phi -= THREE.MathUtils.degToRad(elevation + state.y * cursorV * direction)
    cameraOrbit.sphere.phi = THREE.MathUtils.clamp(cameraOrbit.sphere.phi, 0, Math.PI)
    const camera = authored.camera
    // Parallel-transport the screen up along the orbit. World Y becomes
    // parallel to the view at the pole and would make lookAt flip there.
    camera.up.set(
      -Math.sin(cameraOrbit.sphere.theta) * Math.cos(cameraOrbit.sphere.phi),
      Math.sin(cameraOrbit.sphere.phi),
      -Math.cos(cameraOrbit.sphere.theta) * Math.cos(cameraOrbit.sphere.phi),
    )
    camera.fov = fovFor(mix(settings.focalLength, target.camFocal), camera.aspect)
    camera.clearViewOffset()
    let screenBounds: ReturnType<typeof projectedBounds> | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      camera.position.copy(orbitTarget).add(cameraOrbit.offset.setFromSpherical(cameraOrbit.sphere))
      camera.lookAt(orbitTarget)
      camera.updateMatrixWorld(true)
      if (!subjectFrame.count) break
      screenBounds = projectedBounds(subjectFrame.points, subjectFrame.count, camera, cameraOrbit.sample)
      // Preserve the desktop shot. Pull back only if the fixed loop envelope would
      // exceed 84% of either viewport dimension, including on portrait screens.
      const fit = Math.max((screenBounds.maxX - screenBounds.minX) / 1.68, (screenBounds.maxY - screenBounds.minY) / 1.68)
      if (fit <= 1 || attempt === 2) break
      cameraOrbit.sphere.radius *= fit * 1.015
    }
    if (screenBounds) {
      const centerX = (screenBounds.minX + screenBounds.maxX) / 2
      const centerY = (screenBounds.minY + screenBounds.maxY) / 2
      // Lens shift centers the fixed framing envelope without chasing animation.
      // Explicit user framing shifts remain deliberate offsets from center.
      camera.setViewOffset(size.width, size.height,
        (centerX + shiftX) * size.width / 2,
        -(centerY + shiftY) * size.height / 2,
        size.width, size.height)
    }
    // Sample the original camera keys at the exact Loop mixer time. Keeping
    // this tiny track lossless avoids compression stepping in the vertical dip.
    // Apply it after stable framing so auto-centering cannot cancel the dip.
    if (settings.landingMotion && !state.reduced) {
      const time = clip?.time ?? 0
      const phase = settings.repeat === "pingpong" && Math.abs(landingLoops.current) % 2 === 1 ? landingKeys.duration - time : time
      const heightOffset = landing.evaluate(phase)[0]
      camera.position.y += heightOffset * settings.landingStrength * (1 - blend01)
      camera.updateMatrixWorld(true)
    }
    // Sky view: tilt up after everything else has placed the camera (see sky-look.ts).
    const sky = stepSky(delta, state.reduced)
    if (sky > 0) {
      camera.rotateX(THREE.MathUtils.degToRad(skyLook.pitchDeg) * sky)
      camera.updateMatrixWorld(true)
    }
    spin.current += THREE.MathUtils.degToRad(settings.spin) * delta
    if (root.current) root.current.rotation.y = THREE.MathUtils.degToRad(settings.rotationY) + spin.current
  }, 0.5)
  return <group ref={root} position={[settings.positionX, settings.positionY, settings.positionZ]}
    rotation={[THREE.MathUtils.degToRad(settings.rotationX), THREE.MathUtils.degToRad(settings.rotationY), THREE.MathUtils.degToRad(settings.rotationZ)]} scale={settings.scale}>
    <primitive object={scene} />
    <FloorText settings={settings} />
  </group>
}

function Lighting({ settings }: { settings: ModelSettings }) {
  const angle = THREE.MathUtils.degToRad(settings.keyAngle)
  const height = THREE.MathUtils.degToRad(settings.keyHeight)
  return <>
    <hemisphereLight layers-mask={settings.tigerMaterial === "chrome" ? 1 : 3} args={["#dfe9e2", "#1a1f1a", settings.studioLight]} />
    <directionalLight layers-mask={3} position={[10 * Math.sin(angle) * Math.cos(height), 10 * Math.sin(height), 10 * Math.cos(angle) * Math.cos(height)]} color={settings.keyColor} intensity={settings.keyLight} />
    <directionalLight position={[-5, 4, -5]} color={settings.rimColor} intensity={settings.rimLight} />
  </>
}

/**
 * Renders the scene into a target, hands it to Shader Lab's ASCII pass,
 * and draws the result on a fullscreen quad.
 */
function AsciiPass({ settings, model, onError }: { settings: AsciiSettings; model: ModelSettings; onError?: () => void }) {
  const { gl, scene, camera, size } = useThree()
  const renderer = gl as unknown as WebGPURenderer
  const target = useRef<THREE.RenderTarget | null>(null)
  const hoverSource = useAsciiHover(renderer, size.width, size.height, settings)

  const columns = settings.autoColumns ? columnsFor(size.width) : settings.columns
  const config = useMemo(() => asciiConfig(columns, settings), [columns, settings])
  const postprocessing = useShaderLabPostProcessingSource(config, {
    renderer,
    width: size.width,
    height: size.height,
  })

  const exposure = useMemo(() => uniform(1), [])
  useEffect(() => { if (postprocessing.error) onError?.() }, [postprocessing.error, onError])
  useEffect(() => {
    exposure.value = Math.pow(2, model.exposure)
    renderer.toneMappingExposure = 1
    renderer.toneMapping = model.toneMapping === "aces" ? THREE.ACESFilmicToneMapping
      : model.toneMapping === "neutral" ? THREE.NeutralToneMapping : THREE.NoToneMapping
  }, [renderer, exposure, model.exposure, model.toneMapping])

  const presentScene = useMemo(() => new THREE.Scene(), [])
  const presentCamera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), [])
  const presentTexture = useMemo(
    () => tslTexture(new THREE.Texture(), vec2(uv().x, float(1).sub(uv().y))),
    [],
  )
  const cleanTexture = useMemo(
    () => tslTexture(new THREE.Texture(), vec2(uv().x, float(1).sub(uv().y))),
    [],
  )
  const clearColor = useMemo(() => new THREE.Color(), [])
  const presentMaterial = useMemo(() => {
    const m = new MeshBasicNodeMaterial()
    const tigerColor = model.tigerMaterial === "chrome" && model.toneMapping === "none"
      ? neutralToneMapping(cleanTexture.rgb, float(1)) as typeof cleanTexture.rgb : cleanTexture.rgb
    m.colorNode = mix(presentTexture.rgb, tigerColor, cleanTexture.a).mul(exposure)
    return m
  }, [presentTexture, cleanTexture, exposure, model.tigerMaterial, model.toneMapping])

  useEffect(() => () => presentMaterial.dispose(), [presentMaterial])

  useEffect(() => {
    const t = new THREE.RenderTarget(size.width, size.height, { type: THREE.HalfFloatType })
    target.current = t
    postprocessing.resize(size.width, size.height)
    return () => {
      target.current = null
      t.dispose()
    }
  }, [postprocessing, size.width, size.height])

  useFrame((state, delta) => {
    const t = target.current
    if (!t || !postprocessing.ready) return
    const savedLayers = camera.layers.mask
    const savedBackground = scene.background
    const savedAutoClear = renderer.autoClear
    const savedAlpha = renderer.getClearAlpha()
    renderer.getClearColor(clearColor)
    try {
      // First draw only the environment. Its depth buffer stays alive through
      // the ASCII pass and is reused when drawing the clean tiger below.
      camera.layers.set(0)
      renderer.setRenderTarget(t)
      renderer.autoClear = true
      renderer.render(scene, camera)
      const out = postprocessing.update(hoverSource(t.texture, delta), state.clock.elapsedTime, delta)
      if (out) presentTexture.value = out

      // Keep environment depth, clear only color, and draw the tiger normally.
      // Foreground tree silhouettes therefore occlude it, even between glyphs.
      renderer.setRenderTarget(t)
      renderer.setClearColor(0x000000, 0)
      renderer.clear(true, false, false)
      scene.background = null
      renderer.autoClear = false
      camera.layers.set(1)
      renderer.render(scene, camera)
      cleanTexture.value = t.texture

      renderer.setRenderTarget(null)
      renderer.autoClear = true
      renderer.render(presentScene, presentCamera)
    } finally {
      camera.layers.mask = savedLayers
      scene.background = savedBackground
      renderer.autoClear = savedAutoClear
      renderer.setClearColor(clearColor, savedAlpha)
      renderer.setRenderTarget(null)
    }
  }, 1)

  return createPortal(
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <primitive attach="material" object={presentMaterial} />
    </mesh>,
    presentScene,
  )
}

export default function HeroScene({ onError, ascii, model }: { onError?: () => void; ascii: AsciiSettings; model: ModelSettings }) {
  const orbitTarget = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const subjectFrame = useMemo<TigerFrame>(() => ({ points: new Float32Array(0), count: 0 }), [])
  return (
    <Canvas
      // The ASCII grid replaces fine detail anyway: rendering above 1.5x
      // costs fill-rate and buys nothing you can see.
      dpr={[1, 1.5]}
      gl={async (props) => {
        try {
          const r = new WebGPURenderer(props as ConstructorParameters<typeof WebGPURenderer>[0])
          await r.init()
          return r
        } catch (e) {
          onError?.()
          throw e
        }
      }}
    >
      <color attach="background" args={["#000000"]} />
      <Lighting settings={model} />
      <Plants settings={model} orbitTarget={orbitTarget} subjectFrame={subjectFrame} />
      <Tiger settings={model} orbitTarget={orbitTarget} subjectFrame={subjectFrame} />
      <AsciiPass settings={ascii} model={model} onError={onError} />
    </Canvas>
  )
}
