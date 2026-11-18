"use client"

import dynamic from "next/dynamic"
import RevealText from "../reveal-text"
import Image from "next/image"
import { setHoverConfig, unlockAudio, updateAmbient } from "./sound"
import { SettingsPreset } from "./settings-preset"
import { useHeldKey } from "./held-key"
import { PropertiesPanel } from "./properties-panel"
import { defaultAscii, defaultModel } from "./live-settings"
import { useEffect, useState } from "react"

/** Resting ASCII white point while a key is held; hover is clamped so the cursor never dims the glyphs. */
const HELD_WHITE_POINT = 0.09

const HeroScene = dynamic(() => import("./hero-scene"), { ssr: false })

/**
 * Shader Lab's postprocessing runs on WebGPU only. Browsers without it get
 * a static scene poster, including the clean tiger.
 */
export function Hero() {
  const [ascii, setAscii] = useState(defaultAscii)
  const [model, setModel] = useState(defaultModel)
  useEffect(() => {
    const update = () => updateAmbient(true, model.ambientVolume, model.ambientTrack)
    const unlock = () => { unlockAudio(); update() }
    update()
    const timer = window.setInterval(update, 500)
    window.addEventListener("pointerdown", unlock)
    window.addEventListener("keydown", unlock)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
    }
  }, [model.ambientVolume, model.ambientTrack])
  const [gpu, setGpu] = useState<"checking" | "yes" | "no">("checking")

  useEffect(() => {
    let cancelled = false
    async function checkGpu() {
      const nav = navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }
      try {
        const adapter = await nav.gpu?.requestAdapter()
        if (!cancelled) setGpu(adapter ? "yes" : "no")
      } catch { if (!cancelled) setGpu("no") }
    }
    void checkGpu()
    return () => { cancelled = true }

  }, [])

  const liveAscii = { ...defaultAscii, ...ascii, ...(ascii.hoverEnabled === undefined ? { signalWhitePoint: 0.2 } : {}) }
  const liveModel = { ...defaultModel, ...model }
  // Hover sound is shared with the About video slots: publish the panel values where they can read them.
  useEffect(() => { setHoverConfig({ enabled: liveModel.hoverSound, volume: liveModel.hoverVolume, track: liveModel.hoverTrack }) }, [liveModel.hoverSound, liveModel.hoverVolume, liveModel.hoverTrack])
  // Holding a key re-types the scene in that glyph and in that key's own colour. A leading space keeps the darkest tones empty so the forms still read.
  const heldKey = useHeldKey()
  const sceneAscii = heldKey ? { ...liveAscii, charset: "custom", customChars: " " + heldKey.key, monoColor: heldKey.color, signalWhitePoint: HELD_WHITE_POINT, hoverWhitePoint: Math.min(liveAscii.hoverWhitePoint, HELD_WHITE_POINT) } : liveAscii

  return (
    <section className="relative h-svh w-full overflow-hidden bg-[#0a0a0a]">
      <SettingsPreset ascii={liveAscii} model={liveModel} onAscii={setAscii} onModel={setModel} />
      {/* The scene and the poster render on pure black; lighten against the #0a0a0a section keeps every glyph and lifts only the black. */}
      <div className="absolute inset-0 mix-blend-lighten">
        {gpu === "no" && <Image src="/models/scene-poster.webp" alt="A running tiger surrounded by an ASCII forest" fill sizes="100vw" className="object-contain" />}
        {gpu === "yes" && <HeroScene ascii={sceneAscii} model={liveModel} onError={() => setGpu("no")} />}
      </div>
      {/* Figma 21:400 — headline bottom-left, services bottom-right; clicks fall through so cursor orbit still works. */}
      <div className="hero-overlay">
        <h1 className="hero-title">Creating stuff that<br />will survive.</h1>
        <ul className="hero-services" aria-label="Services">
          {["Branding", "Websites", "Interior design", "AI Photo studios"].map(name => <RevealText as="li" key={name} text={name} />)}
        </ul>
      </div>
      <PropertiesPanel ascii={liveAscii} model={liveModel} onAscii={setAscii} onModel={setModel} status={gpu} />
    </section>
  )
}
