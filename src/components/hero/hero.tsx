"use client"

import dynamic from "next/dynamic"
import Image from "next/image"
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
  // Holding a key re-types the scene in that glyph and in that key's own colour. A leading space keeps the darkest tones empty so the forms still read.
  const heldKey = useHeldKey()
  const sceneAscii = heldKey ? { ...liveAscii, charset: "custom", customChars: " " + heldKey.key, monoColor: heldKey.color, signalWhitePoint: HELD_WHITE_POINT, hoverWhitePoint: Math.min(liveAscii.hoverWhitePoint, HELD_WHITE_POINT) } : liveAscii

  return (
    <section className="relative h-svh w-full overflow-hidden bg-black">
      <SettingsPreset ascii={liveAscii} model={liveModel} onAscii={setAscii} onModel={setModel} />
      <div className="absolute inset-0">
        {gpu === "no" && <Image src="/models/scene-poster.webp" alt="A running tiger surrounded by an ASCII forest" fill sizes="100vw" className="object-contain" />}
        {gpu === "yes" && <HeroScene ascii={sceneAscii} model={liveModel} onError={() => setGpu("no")} />}
      </div>
      {/* Figma 21:400 — bottom-left headline over the scene; clicks fall through so cursor orbit still works. */}
      <h1 className="hero-title">Creating stuff that<br />will survive.</h1>
      <PropertiesPanel ascii={liveAscii} model={liveModel} onAscii={setAscii} onModel={setModel} status={gpu} />
    </section>
  )
}
