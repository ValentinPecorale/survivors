/* TSL uniforms and materials are mutable Three.js render-loop resources. */
/* eslint-disable react-hooks/immutability */
"use client" 

import { useAnimations, useGLTF } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import { useEffect, useMemo } from "react"
import * as THREE from "three"
import { abs, dot, float, floor, fract, max, screenCoordinate, sin, step, texture as tslTexture, uniform, uv, vec2, vec4 } from "three/tsl"
import { MeshBasicNodeMaterial } from "three/webgpu"
import { useGradientSettings } from "../gradient-settings"
import { lightTarget } from "./light-target"
import { releaseSkyLook, skyLook } from "./sky-look"
import { CONTACT_TRACKS, contactVoice, industrialHum, playLightCue, preloadLightCue, setHeroAudioMuted, stopLightCue, unlockAudio } from "./sound"
import { useChromeMaterial } from "./tiger-surface"
import { deviceReveal, useDeviceTransition } from "./device-transition"
import { getProjectionTexture, PROJECTION_ASPECT } from "./projection-image"

import type { ModelSettings } from "./live-settings"

const SEARCHLIGHTS_URL = "/models/searchlights.glb?v=sl-20261125a"
useGLTF.preload(SEARCHLIGHTS_URL)

/** Failing-bulb schedule in seconds since the chrome landed: two short flashes, then steady. */
const BULB: [number, number][] = [[0, 0.07], [0.18, 0.25]]
const BULB_STEADY = 0.34

/** Sky view progress (0..1) at which the camera has arrived at the device and the lamp starts to flicker. */
export const SKY_ARRIVE = 0.98

/** After the lamp goes dark on the way back, wait this long (s) before the camera leaves it. */
const EXIT_BEAT = 0.3

/** The searchlight device itself (the lamp housing), without its beam and glow. */
const device = (light: THREE.Object3D) => light.children.find(child => !child.name.startsWith("SearchlightBeam")) ?? light

/** One card-wide cell of the site's dot grid, in px: the same pitch the Featured cards and the footer use (see useDotGrid). */
function gridPitch(viewportWidth: number, columns: number) {
  const root = getComputedStyle(document.documentElement)
  const margin = parseFloat(root.getPropertyValue("--page-margin")) || 32, gutter = parseFloat(root.getPropertyValue("--page-gutter")) || 20
  const card = viewportWidth <= 700 ? viewportWidth - 2 * margin : (viewportWidth - 2 * margin - gutter) / 2
  // Whole pixels: the dots are drawn on the render target, so a fractional pitch would make them uneven.
  return Math.max(3, Math.round(card / columns))
}

/**
 * The 12 searchlights from tiger_scene_loop.glb (fixture + beam + glow), extracted on their own so the forest
 * and tiger files stay untouched. They live in the forest's space and are slaved to its Loop clock, so they
 * slide past in lockstep with the trees instead of running a second timeline.
 *
 * There is no light: each beam and glow is built from the same square dot grid as the Featured cards and the
 * footer. The grid is fixed to the screen; the beam's own gradient decides which dots exist (a per-cell random
 * threshold, so the fade is dots thinning out, never smaller or dimmer dots). Dots draw on layer 1, outside
 * the ASCII pass, so they stay crisp squares, while trees in front still cover them (environment depth is kept).
 */
export function Searchlights({ clipTime, settings }: { clipTime: () => number; settings: ModelSettings }) {
  const { scene, animations } = useGLTF(SEARCHLIGHTS_URL)
  const { actions, mixer } = useAnimations(animations, scene)
  const clip = actions.Loop ?? Object.values(actions)[0]
  const width = useThree(state => state.size.width)
  const { dotsColumns, dotsSize } = useGradientSettings()
  const chrome = useChromeMaterial({ ...settings, tigerColor: "#ffffff", tigerRoughness: 0.04, tigerMetalness: 1, tigerReflection: 1, tigerStudioRotation: 0, tigerWireframe: false })
  const transition = useDeviceTransition(chrome)
  const reducedMotion = useMemo(() => typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null, [])
  const grid = useMemo(() => ({ pitch: uniform(6), size: uniform(2), density: uniform(1.4), color: uniform(new THREE.Color()) }), [])

  useEffect(() => {
    // Spacing 0 = the site's own grid (cards, footer); anything else is a pitch in whole px. Dot size 0 = the site's dot size.
    grid.pitch.value = settings.searchlightSpacing > 0 ? Math.round(settings.searchlightSpacing) : gridPitch(width, dotsColumns)
    grid.size.value = Math.max(1, Math.round(settings.searchlightDotSize > 0 ? settings.searchlightDotSize : dotsSize))
    grid.density.value = settings.searchlightDensity
    grid.color.value.set(settings.searchlightColor)
  }, [grid, width, dotsColumns, dotsSize, settings.searchlightSpacing, settings.searchlightDotSize, settings.searchlightDensity, settings.searchlightColor])

  useEffect(() => {
    clip?.reset().play()
    if (clip) clip.paused = true // time is driven by the forest clip below
    return () => { clip?.stop() }
  }, [clip])

  useEffect(() => {
    const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>()
    const created: MeshBasicNodeMaterial[] = []
    const dots = (source: THREE.Material & { map?: THREE.Texture | null }) => {
      const cell = floor(screenCoordinate.div(grid.pitch))
      const offset = abs(screenCoordinate.sub(cell.mul(grid.pitch)).sub(grid.pitch.mul(0.5)))
      const inDot = step(max(offset.x, offset.y), grid.size.mul(0.5))
      const random = fract(sin(dot(cell, vec2(12.9898, 78.233))).mul(43758.5453))
      // The authored gradient lives in the texture's alpha; the density multiplier decides how far the dotted core reaches.
      const shape = (source.map ? tslTexture(source.map, uv()).a : float(1)).mul(grid.density)
      const material = new MeshBasicNodeMaterial()
      material.colorNode = vec4(grid.color, 1)
      material.opacityNode = inDot.mul(step(random, shape))
      material.alphaTest = 0.5
      material.side = THREE.DoubleSide
      created.push(material)
      return material
    }
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      const list = Array.isArray(object.material) ? object.material : [object.material]
      if (!list.some(material => material.transparent)) return
      originals.set(object, object.material)
      object.material = Array.isArray(object.material) ? object.material.map(dots) : dots(object.material)
      object.layers.set(1)
    })
    return () => {
      originals.forEach((material, mesh) => { mesh.material = material; mesh.layers.set(0) })
      created.forEach(material => material.dispose())
    }
  }, [scene, grid])

  useEffect(() => { if (settings.lightSound) preloadLightCue(settings.lightTrack) }, [settings.lightSound, settings.lightTrack])
  useEffect(() => { if (settings.contactMusic) contactVoice(settings.contactTrack).preload(); else contactVoice(settings.contactTrack).stop(0.5) }, [settings.contactMusic, settings.contactTrack])
  useEffect(() => { contactVoice(settings.contactTrack).setVolume(settings.contactMusicVolume) }, [settings.contactMusicVolume, settings.contactTrack])
  useEffect(() => { if (settings.humSound) industrialHum.preload(); else industrialHum.stop(0.5) }, [settings.humSound])
  useEffect(() => { industrialHum.setVolume(settings.humVolume) }, [settings.humVolume])
  // The projection: a camera-facing plane on layer 0, so it goes through the same ASCII pass as the forest (glyphs, not pixels).
  const projection = useMemo(() => {
    const material = new MeshBasicNodeMaterial({ color: "#ffffff", transparent: false, alphaTest: 0.5, fog: false, toneMapped: false, depthTest: false, side: THREE.DoubleSide })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material)
    mesh.visible = false; mesh.frustumCulled = false; mesh.scale.set(1, PROJECTION_ASPECT, 1)
    return mesh
  }, [])
  useEffect(() => {
    ;(projection.material as MeshBasicNodeMaterial).map = getProjectionTexture()
    scene.add(projection)
    return () => { scene.remove(projection); (projection.material as THREE.Material).dispose(); projection.geometry.dispose() }
  }, [scene, projection])

  const lights = useMemo(() => scene.children.filter(child => child.name.startsWith("Searchlight_")), [scene])
  const track = useMemo(() => ({ light: null as THREE.Object3D | null, box: new THREE.Box3(), center: new THREE.Vector3(), last: new THREE.Vector3(), shift: new THREE.Vector3(), fresh: true, wasUp: false, lit: 0, lamp: "off" as "off" | "in" | "out", scale: new THREE.Vector3(), right: new THREE.Vector3(), exit: 0, cue: 0, music: 0, skyMusic: false, hum: false, humTimer: 0, quat: new THREE.Quaternion() }), [])

  // Picking another Contact track while the sky step is playing swaps it over.
  useEffect(() => {
    if (!track.skyMusic) return
    for (const [id, t] of Object.entries(CONTACT_TRACKS)) if (id !== settings.contactTrack) t.voice.stop(0.6)
    contactVoice(settings.contactTrack).start(settings.contactMusicVolume, 0.6)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.contactTrack])

  // Priority 0.4: after the forest clock moved (0) and before the camera reads the target (0.5).
  useFrame(({ camera, pointer }, delta) => {
    scene.visible = settings.searchlights
    if (!clip) return
    clip.time = clipTime()
    mixer.update(0)
    scene.updateWorldMatrix(true, true)

    // Sky view: follow ONE light for as long as the view is up. Pick the nearest to the tiger framing target when it starts, release once it is back.
    const follow = settings.searchlights && settings.searchlightSkyFocus
    // Pick again at every entry into the sky view. The glide back takes seconds to reach exactly 0, so a quick second scroll-up arrives
    // while the old device is still held; it must not keep it.
    const entering = skyLook.target > 0 && !track.wasUp
    track.wasUp = skyLook.target > 0
    if ((!track.light || entering) && skyLook.target > 0 && follow) {
      // Real time: each device's current world position (the clip was just evaluated above), compared with the tiger across the screen,
      // along the camera's own right axis. Depth and height are the same for every device, so this is the one that looks nearest the tiger.
      track.shift.set(1, 0, 0).transformDirection(camera.matrixWorld)
      let best = Infinity
      for (const light of lights) {
        track.box.setFromObject(device(light)).getCenter(track.center)
        const distance = Math.abs(track.center.sub(lightTarget.reference).dot(track.shift))
        if (distance < best) { best = distance; track.light = light }
      }
      track.fresh = true
      track.shift.set(0, 0, 0)
    } else if (track.light && (!follow || (skyLook.target === 0 && skyLook.progress === 0))) {
      track.light = null
      lightTarget.active = false
    }
    const reduced = reducedMotion?.matches ?? false, dt = Math.min(delta, 0.1)
    // Sky view (Contact): the hero's music, footsteps and plant hover go away together; they come back with the tiger.
    setHeroAudioMuted(skyLook.target > 0)
    // The cue marks the camera leaving the initial view for the targeted device; stepping back before it ends fades it out.
    if (entering && follow && settings.lightSound) {
      window.clearTimeout(track.cue); unlockAudio()
      track.cue = window.setTimeout(() => playLightCue(settings.lightVolume, settings.lightTrack), settings.lightDelay * 1000)
    } else if (skyLook.want === 0 && !entering) { window.clearTimeout(track.cue); stopLightCue() }
    // The Contact music belongs to the sky step only (the camera move up to the sky, `want` 2): it loops from the moment that move starts
    // (plus the panel's delay) and fades out as soon as you step back to the searchlight or leave.
    const skyActive = settings.contactMusic && follow && skyLook.want === 2 && lightTarget.look > 0.001
    if (skyActive !== track.skyMusic) {
      track.skyMusic = skyActive
      window.clearTimeout(track.music)
      if (skyActive) { unlockAudio(); track.music = window.setTimeout(() => contactVoice(settings.contactTrack).start(settings.contactMusicVolume, settings.contactMusicFadeIn), settings.contactMusicDelay * 1000) }
      else contactVoice(settings.contactTrack).stop(skyLook.skip ? 0.3 : settings.contactMusicFadeOut)
    }
    // The industrial hum runs under both steps (device centred, then sky) and goes as soon as you step back out of the first.
    const humActive = settings.humSound && follow && skyLook.want >= 1
    if (humActive !== track.hum) {
      track.hum = humActive
      window.clearTimeout(track.humTimer)
      if (humActive) { unlockAudio(); track.humTimer = window.setTimeout(() => industrialHum.start(settings.humVolume, settings.humFadeIn), settings.humDelay * 1000) }
      else industrialHum.stop(skyLook.skip ? 0.3 : settings.humFadeOut)
    }

    // Step 1 (scroll up once): the camera is on the lamp, the ASCII device turns to chrome, then the lamp comes on like a failing bulb.
    // Leaving it, all of that runs backwards: the bulb fails in reverse, then the chrome turns back to ASCII.
    const device3d = track.light && follow && settings.searchlightChrome && skyLook.target > 0 && skyLook.progress > 0.5 ? device(track.light) : null
    const arrived = !!track.light && follow && skyLook.target > 0 && skyLook.progress >= SKY_ARRIVE
    const chromeDone = !settings.searchlightChrome || (deviceReveal.active && deviceReveal.progress >= 1)
    // Step 2 (scroll up again): the camera moves on from the lamp to the projection in the sky. Leaving it, the camera comes back to the lamp.
    // The bulb in reverse is steady, dark 90ms, flash 70ms, dark 110ms, flash 70ms, off, and only starts once the camera is back on the lamp.
    if (skyLook.want >= 1 && arrived && chromeDone) {
      if (track.lamp !== "in") { track.lit = track.lamp === "out" ? BULB_STEADY : 0; track.lamp = "in" }
      track.lit += dt
    } else if (track.lamp === "in" && (skyLook.skip || !arrived || lightTarget.look <= 0.001)) { track.lamp = "out"; track.lit = 0 }
    else if (track.lamp === "out") { track.lit += dt; if (track.lit >= BULB_STEADY) track.lamp = "off" }
    if (track.lamp === "out" && (skyLook.skip || !arrived)) track.lamp = "off"
    const flicker = (time: number) => BULB.some(([from, to]) => time >= from && time < to) || time >= BULB_STEADY
    // Once the bulb has settled it fails again every few seconds: a burst of dark flicks (70ms dark, 110ms lit, as in the start-up), then steady.
    const burstDark = (since: number) => {
      const every = Math.max(1, settings.lampFlickerEvery)
      if (!settings.lampFlicker || since < every) return false
      const w = since % every
      return w < settings.lampFlickerCount * 0.18 && w % 0.18 < 0.07
    }
    const on = track.lamp === "in" ? flicker(track.lit) && !(track.lit >= BULB_STEADY && burstDark(track.lit - BULB_STEADY)) : track.lamp === "out" ? flicker(BULB_STEADY - track.lit) : false
    // The chrome reverses only once the lamp is dark and the camera is back on it.
    const retrace = skyLook.want === 0 && !skyLook.skip && track.lamp === "off" && lightTarget.look <= 0.001
    transition.update(device3d instanceof THREE.Mesh ? device3d : null, delta, pointer, reduced, retrace)
    for (const light of lights) for (const child of light.children) if (child.name.startsWith("SearchlightBeam")) child.visible = light === track.light && on
    projection.visible = !!track.light && on
    if (track.light) {
      // Hung along the direction the sky step ends up looking, so the finished camera move frames it dead centre, upright and facing the lens.
      const height = 2 * settings.skyDistance * Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov) / 2) * settings.skySize
      const width = height / PROJECTION_ASPECT
      track.center.copy(camera.position).addScaledVector(lightTarget.skyDir, settings.skyDistance)
      scene.getWorldScale(track.scale)
      projection.position.copy(scene.worldToLocal(track.center))
      projection.scale.set(width / track.scale.x, height / track.scale.y, 1)
      projection.quaternion.copy(scene.getWorldQuaternion(track.quat).invert()).multiply(lightTarget.skyQuat)
    }
    // The step-2 camera move (hero-scene reads lightTarget.look) runs on time, not on scroll.
    const lookGoal = skyLook.want === 2 && arrived && chromeDone && track.lamp === "in" && track.lit >= BULB_STEADY ? 1 : 0
    lightTarget.look = reduced ? lookGoal : THREE.MathUtils.clamp(lightTarget.look + dt * (lookGoal ? 1 / Math.max(0.1, settings.lookIn) : -1 / Math.max(0.1, settings.lookOut)), 0, 1)
    // The sky view lets go (and the tiger comes back) a beat after the chrome is back to ASCII.
    if (skyLook.want === 0 && skyLook.target > 0 && !skyLook.skip) {
      const done = !track.light || !follow || (retrace && (!settings.searchlightChrome || deviceReveal.progress <= 0))
      track.exit = done ? track.exit + dt : 0
      if (track.exit >= EXIT_BEAT || !track.light || !follow) { track.exit = 0; releaseSkyLook() }
    } else track.exit = 0
    if (!track.light) return
    track.box.setFromObject(device(track.light)).getCenter(track.center)
    // The lights ride a looping treadmill: when the clip wraps, the light snaps back one loop. Carry that jump so the target keeps travelling.
    if (!track.fresh && track.center.distanceToSquared(track.last) > 400) track.shift.add(track.last).sub(track.center)
    track.fresh = false
    track.last.copy(track.center)
    lightTarget.point.copy(track.center).add(track.shift)
    lightTarget.active = true
  }, 0.4)

  return <primitive object={scene} />
}



