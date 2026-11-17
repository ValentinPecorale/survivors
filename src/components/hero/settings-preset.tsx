"use client"

import { useEffect, useRef, type Dispatch, type SetStateAction } from "react"
import { defaultAscii, defaultModel, defaultText, type AsciiSettings, type ModelSettings } from "./live-settings"

const STORAGE_KEY = "survivors:default-settings:v2"

type SavedSettings = { ascii: AsciiSettings; model: ModelSettings }

// Accept only known keys with the expected types; older presets inherit new controls.
function mergeSettings<T extends Record<string, string | number | boolean>>(defaults: T, saved: unknown): T {
  const result = { ...defaults }
  if (!saved || typeof saved !== "object") return result
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const value = (saved as Record<keyof T, unknown>)[key]
    if (typeof value === typeof defaults[key] && (typeof value !== "number" || Number.isFinite(value))) {
      result[key] = value as T[keyof T]
    }
  }
  return result
}

export function saveDefaultSettings(ascii: AsciiSettings, model: ModelSettings): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ascii, model }))
    return true
  } catch { return false }
}

function readDefaultSettings(): SavedSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw)
    if (!saved || typeof saved !== "object" || !saved.ascii || !saved.model) return null
    const ascii = mergeSettings(defaultAscii, saved.ascii)
    // Introduce the requested 0.20 resting white point to presets saved before hover existed.
    if (saved.ascii.hoverEnabled === undefined) ascii.signalWhitePoint = 0.2
    const model = mergeSettings(defaultModel, saved.model)
    if (saved.model.audioPresetVersion !== 1) { model.ambientSound = true; model.audioPresetVersion = 1 }
    // Older presets had a single fixed column count; preserve that look.
    if (saved.model.textAsciiEndColumns === undefined) model.textAsciiEndColumns = model.textAsciiColumns
    // Apply the supplied Shader Lab look once without resetting scene/camera placement.
    if (saved.model.textPresetVersion !== defaultText.textPresetVersion) {
      Object.assign(model, {
        textPresetVersion: defaultText.textPresetVersion, floorText: defaultText.floorText,
        textFontSize: defaultText.textFontSize, textStartFontSize: defaultText.textStartFontSize,
        textColor: defaultText.textColor, textEase: defaultText.textEase,
        textAsciiColumns: defaultText.textAsciiColumns, textAsciiEndColumns: defaultText.textAsciiEndColumns,
        textAsciiBlackPoint: defaultText.textAsciiBlackPoint, textAsciiWhitePoint: defaultText.textAsciiWhitePoint,
      })
    }
    return { ascii, model }
  } catch { return null }
}

/** Kept separate so installing persistence preserves the open preview's live React state. */
export function SettingsPreset({ ascii, model, onAscii, onModel }: SavedSettings & {
  onAscii: Dispatch<SetStateAction<AsciiSettings>>
  onModel: Dispatch<SetStateAction<ModelSettings>>
}) {
  const initial = useRef({ ascii, model })
  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      const saved = readDefaultSettings()
      if (saved) {
        onAscii(saved.ascii)
        onModel(saved.model)
      } else {
        saveDefaultSettings(initial.current.ascii, initial.current.model)
      }
    })
    return () => { cancelled = true }
  }, [onAscii, onModel])
  return null
}
