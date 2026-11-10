import type { AsciiSettings } from "./live-settings"
import type { ShaderLabConfig } from "@basementstudio/shader-lab"

/**
 * The ASCII look exported from Shader Lab, unchanged except for `columns`,
 * which we derive from the viewport so each character cell stays ~4.8px wide
 * on every screen (400 columns at 1920px). A fixed 400 would be ~1px cells
 * on a phone — noise, not type.
 */
export const CELL_PX = 4.8
export const MIN_COLUMNS = 80
export const MAX_COLUMNS = 400

export function columnsFor(width: number) {
  return Math.round(Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, width / CELL_PX)))
}

export function asciiConfig(columns: number, settings?: AsciiSettings): ShaderLabConfig {
  return {
    layers: [
      {
        blendMode: "normal",
        compositeMode: "filter",
        maskConfig: { invert: false, mode: "multiply", source: "luminance" },
        hue: 0,
        id: "18a34d24-e037-46e0-bcdb-7af438f75316",
        kind: "effect",
        name: "ASCII",
        opacity: 1,
        params: {
          input: "luminance",
          breakGrid: "off",
          breakThreshold: 0.06,
          fontFamily: "mono",
          fontWeight: 400,
          charset: "light",
          customChars: " .:-=+*#%@",
          boldness: 0,
          colorMode: "monochrome",
          monoColor: "#f5f5f0",
          bgOpacity: 0,
          signalBlackPoint: 0,
          signalWhitePoint: 0.2,
          invert: false,
          rowWarp: 0,
          ...settings,
          columns,
        },
        saturation: 1,
        type: "ascii",
        visible: settings?.enabled ?? true,
      },
    ],
    // Matches the GLB's "Loop" clip (10.83s) so both cycles stay in phase.
    timeline: { duration: 10.833333333333334, loop: true, tracks: [] },
  } as ShaderLabConfig
}
