"use client"

import { useShaderLab } from "@basementstudio/shader-lab"
import { useAnimations, useGLTF } from "@react-three/drei"
import { Canvas, createPortal, useFrame, useThree } from "@react-three/fiber"
import { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { float, texture as tslTexture, uv, vec2 } from "three/tsl"
import { MeshBasicNodeMaterial, WebGPURenderer } from "three/webgpu"
import { asciiConfig, columnsFor } from "./ascii-config"

const MODEL_URL = "/models/plants.glb"
useGLTF.preload(MODEL_URL)

/** Aspect the shot was framed for in Blender (camera.aspectRatio in the GLB). */
const AUTHORED_ASPECT = 16 / 9

/**
 * Plays the GLB exactly as framed in Blender, through the GLB's own camera.
 */
function Plants() {
  const { scene, animations, cameras } = useGLTF(MODEL_URL)
  const { actions } = useAnimations(animations, scene)
  const set = useThree((s) => s.set)
  const size = useThree((s) => s.size)

  const authored = cameras[0] as THREE.PerspectiveCamera
  const authoredYFov = useMemo(() => authored.fov, [authored])

  // Blender exports the camera object's scale (here 0.69 / 7.77 / 4.12).
  // Blender ignores it when rendering, three.js does not: it would stretch
  // the whole view. Reset it so we see exactly what Blender's camera sees.
  useLayoutEffect(() => {
    authored.scale.set(1, 1, 1)
    authored.updateMatrixWorld(true)
    set({ camera: authored })
  }, [authored, set])

  // "Cover" framing: never show past the edges of the authored 16:9 frame.
  // Wider than 16:9 → keep horizontal FOV, crop top/bottom.
  // Narrower (portrait) → keep vertical FOV, crop the sides.
  useLayoutEffect(() => {
    const aspect = size.width / size.height
    authored.aspect = aspect
    if (aspect > AUTHORED_ASPECT) {
      const hHalf = Math.atan(Math.tan(THREE.MathUtils.degToRad(authoredYFov) / 2) * AUTHORED_ASPECT)
      authored.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hHalf) / aspect))
    } else {
      authored.fov = authoredYFov
    }
    authored.updateProjectionMatrix()
  }, [authored, authoredYFov, size.width, size.height])

  useEffect(() => {
    const loop = actions.Loop ?? Object.values(actions)[0]
    loop?.reset().setLoop(THREE.LoopRepeat, Infinity).play()
    return () => {
      loop?.stop()
    }
  }, [actions])

  return <primitive object={scene} />
}

/**
 * Renders the scene into a target, hands it to Shader Lab's ASCII pass,
 * and draws the result on a fullscreen quad.
 */
function AsciiPass() {
  const { gl, scene, camera, size } = useThree()
  const renderer = gl as unknown as WebGPURenderer
  const target = useRef<THREE.RenderTarget | null>(null)

  const columns = columnsFor(size.width)
  const config = useMemo(() => asciiConfig(columns), [columns])
  const { postprocessing } = useShaderLab(config, {
    renderer,
    width: size.width,
    height: size.height,
  })

  const presentScene = useMemo(() => new THREE.Scene(), [])
  const presentCamera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), [])
  const presentTexture = useMemo(
    () => tslTexture(new THREE.Texture(), vec2(uv().x, float(1).sub(uv().y))),
    [],
  )
  const presentMaterial = useMemo(() => {
    const m = new MeshBasicNodeMaterial()
    m.colorNode = presentTexture.rgb
    return m
  }, [presentTexture])

  useEffect(() => {
    const t = new THREE.RenderTarget(size.width, size.height)
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
    renderer.setRenderTarget(t)
    renderer.render(scene, camera)
    const out = postprocessing.render(t.texture, state.clock.elapsedTime, delta)
    if (out) presentTexture.value = out
    renderer.setRenderTarget(null)
    renderer.render(presentScene, presentCamera)
  }, 1)

  return createPortal(
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <primitive attach="material" object={presentMaterial} />
    </mesh>,
    presentScene,
  )
}

export default function HeroScene({ onError }: { onError?: () => void }) {
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
      {/* The GLB carries no lights. Soft sky/ground fill + one key from the
          upper left so leaves read as shapes in the luminance signal. */}
      <hemisphereLight args={["#dfe9e2", "#1a1f1a", 1.2]} />
      <directionalLight position={[5, 8, 4]} intensity={2.2} />
      <Plants />
      <AsciiPass />
    </Canvas>
  )
}
