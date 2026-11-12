import type { ShaderLabConfig } from "@basementstudio/shader-lab"
import type { ModelSettings } from "./live-settings"

export const TEXT_ANIMATION_END = 1.7056209882352942
export const TEXT_COMPOSITION_SIZE = { width: 1920, height: 1080 }

/** The supplied Shader Lab export, with editable values bound to the live panel. */
export function textComposition(settings: ModelSettings): ShaderLabConfig {
  return {
    composition: TEXT_COMPOSITION_SIZE,
    layers: [
      {
        blendMode: "normal", compositeMode: "filter",
        maskConfig: { invert: false, mode: "multiply", source: "luminance" },
        hue: 0, id: "86735a90-a45f-4d4d-8566-37e31a8b4277", kind: "effect", name: "ASCII", opacity: 1,
        params: {
          input: "luminance", columns: settings.textAsciiColumns, breakGrid: "off", breakThreshold: 0.06,
          fontFamily: "mono", fontWeight: 400, charset: "light", customChars: " .:-=+*#%@", boldness: 0,
          colorMode: "monochrome", monoColor: settings.textColor, bgOpacity: 0,
          signalBlackPoint: settings.textAsciiBlackPoint, signalWhitePoint: settings.textAsciiWhitePoint,
          invert: false, rowWarp: 0,
        },
        saturation: 1, type: "ascii", visible: true,
      },
      {
        blendMode: "normal", compositeMode: "filter",
        maskConfig: { invert: false, mode: "multiply", source: "luminance" },
        hue: 0, id: "aeb56663-1b5e-4655-954f-4b0324dad9b4", kind: "source", name: "Text", opacity: 1,
        params: {
          text: settings.floorText, fontFamily: "sans", fontWeight: 700, fontSize: settings.textFontSize,
          lineHeight: 1.1, letterSpacing: -0.05, align: "auto", textColor: "#ffffff",
          backgroundColor: "#000000", backgroundAlpha: 0, anchor: "center", offset: [0, 0], rotation: 0,
        },
        saturation: 1, type: "text", visible: true,
      },
    ],
    timeline: {
      duration: 7.766667, loop: true,
      tracks: [{
        binding: { key: "fontSize", kind: "param", label: "Font Size", valueType: "number" },
        // Keep the export's track metadata; the SDK evaluates keyframe easing.
        ...{ easing: { controlPoints: [0.65, 0, 0.35, 1], type: "bezier" } },
        enabled: true, id: "abdf1191-232e-4404-86b8-19c706e7dbb6",
        keyframes: [
          { easing: { controlPoints: [0, 0, 1, 1], type: "bezier" }, id: "5302a0f6-5ea1-4120-aca2-ee0c0f21cfe6", time: 0, value: settings.textStartFontSize },
          { easing: { type: "step" }, id: "c4324a19-02d9-48d4-ba72-f5fc09a0b721", time: TEXT_ANIMATION_END, value: settings.textFontSize },
        ],
        layerId: "aeb56663-1b5e-4655-954f-4b0324dad9b4",
      }],
    },
  }
}
