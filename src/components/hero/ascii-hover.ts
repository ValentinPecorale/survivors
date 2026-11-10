/* Three.js uniforms and render targets are mutable render-loop resources. */
/* eslint-disable react-hooks/immutability */
"use client"

import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { dot, float, max, mix, screenUV, select, smoothstep, texture, uniform, vec3 } from "three/tsl"
import { MeshBasicNodeMaterial, type WebGPURenderer } from "three/webgpu"
import type { AsciiSettings } from "./live-settings"

export function useAsciiHover(renderer: WebGPURenderer, width: number, height: number, settings: AsciiSettings) {
  const pointer = useRef({ active: false, fine: false, reduced: false })
  const target = useRef<THREE.RenderTarget | null>(null)
  const pass = useMemo(() => {
    const cursor = uniform(new THREE.Vector2(0.5, 0.5))
    const viewport = uniform(new THREE.Vector2(1, 1))
    const radius = uniform(120)
    const strength = uniform(0)
    const black = uniform(0)
    const regularWhite = uniform(0.2)
    const hoverWhite = uniform(0.12)
    const placeholder = new THREE.Texture()
    const source = texture(placeholder, screenUV)
    const distance = screenUV.sub(cursor).mul(viewport).length()
    const influence = float(1).sub(smoothstep(radius.mul(0.35), radius, distance)).mul(strength)
    const localWhite = mix(regularWhite, hoverWhite, influence)
    // Remap luminance before ASCII analysis, rather than brightening finished glyphs.
    // (L' - black) / (regularWhite - black) = (L - black) / (localWhite - black).
    const ratio = max(regularWhite.sub(black), float(0.001)).div(max(localWhite.sub(black), float(0.001)))
    const luminance = dot(source.rgb, vec3(0.2126, 0.7152, 0.0722))
    const remapped = max(black.add(luminance.sub(black).mul(ratio)), float(0))
    const gain = remapped.div(max(luminance, float(0.00001)))
    const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false, toneMapped: false })
    material.colorNode = source.rgb.mul(select(influence.greaterThan(0), gain, float(1)))
    const geometry = new THREE.PlaneGeometry(2, 2)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.frustumCulled = false
    const scene = new THREE.Scene()
    scene.add(mesh)
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    return { cursor, viewport, radius, strength, black, regularWhite, hoverWhite, source, placeholder, material, geometry, scene, camera }
  }, [])

  useEffect(() => {
    const canvas = renderer.domElement
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)")
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    const state = pointer.current
    const preferences = () => { state.fine = fine.matches; state.reduced = reduced.matches; state.active = false }
    const leave = () => { state.active = false }
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch" || !state.fine) return
      const bounds = canvas.getBoundingClientRect()
      if (!bounds.width || !bounds.height) return
      pass.cursor.value.set((event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height)
      state.active = true
    }
    preferences()
    fine.addEventListener("change", preferences)
    reduced.addEventListener("change", preferences)
    canvas.addEventListener("pointermove", move, { passive: true })
    canvas.addEventListener("pointerleave", leave)
    canvas.addEventListener("pointercancel", leave)
    window.addEventListener("blur", leave)
    return () => {
      fine.removeEventListener("change", preferences)
      reduced.removeEventListener("change", preferences)
      canvas.removeEventListener("pointermove", move)
      canvas.removeEventListener("pointerleave", leave)
      canvas.removeEventListener("pointercancel", leave)
      window.removeEventListener("blur", leave)
    }
  }, [renderer, pass])

  useEffect(() => {
    const next = new THREE.RenderTarget(width, height, { type: THREE.HalfFloatType, depthBuffer: false })
    target.current = next
    pass.viewport.value.set(width, height)
    return () => { target.current = null; next.dispose() }
  }, [width, height, pass])

  useEffect(() => () => { pass.material.dispose(); pass.geometry.dispose(); pass.placeholder.dispose() }, [pass])

  return (source: THREE.Texture, delta: number) => {
    const active = pointer.current.active && settings.enabled && settings.hoverEnabled ? 1 : 0
    const blend = pointer.current.reduced ? 1 : 1 - Math.exp(-3 * Math.min(delta, 0.1) / 0.18)
    pass.strength.value = THREE.MathUtils.lerp(pass.strength.value, active, blend)
    // Resting frames use the existing source directly: no additional draw call.
    if (!target.current || pass.strength.value < 0.001 || !settings.enabled) return source
    pass.source.value = source
    pass.radius.value = settings.hoverRadius
    pass.black.value = settings.signalBlackPoint
    pass.regularWhite.value = settings.signalWhitePoint
    pass.hoverWhite.value = Math.max(settings.signalBlackPoint + 0.001, settings.hoverWhitePoint)
    renderer.setRenderTarget(target.current)
    renderer.render(pass.scene, pass.camera)
    return target.current.texture
  }
}
