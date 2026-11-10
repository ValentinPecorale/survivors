"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"

const HeroScene = dynamic(() => import("./hero-scene"), { ssr: false })

/**
 * Shader Lab's postprocessing runs on WebGPU only. Browsers without it get
 * a plain black hero for now (a pre-rendered ASCII poster is the TODO).
 */
export function Hero() {
  const [gpu, setGpu] = useState<"checking" | "yes" | "no">("checking")

  useEffect(() => {
    const nav = navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }
    if (!nav.gpu) return setGpu("no")
    nav.gpu
      .requestAdapter()
      .then((a) => setGpu(a ? "yes" : "no"))
      .catch(() => setGpu("no"))
  }, [])

  return (
    <section className="relative h-svh w-full overflow-hidden bg-black">
      <div className="absolute inset-0">
        {gpu === "yes" && <HeroScene onError={() => setGpu("no")} />}
      </div>
    </section>
  )
}
