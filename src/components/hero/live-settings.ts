export const defaultAscii = {
  hoverEnabled: true, hoverWhitePoint: 0.12, hoverRadius: 120,
  enabled: true, autoColumns: true, columns: 280,
  input: "luminance", breakGrid: "off", breakThreshold: 0.06,
  fontFamily: "mono", charset: "light", customChars: " .:-=+*#%@",
  boldness: 0, colorMode: "monochrome", monoColor: "#f5f5f0",
  signalBlackPoint: 0, signalWhitePoint: 0.2, invert: false, rowWarp: 0,
}

export const defaultCamera = {
  landingMotion: true, landingStrength: 4,
  focalLength: 56, orbit: 0, elevation: 0, shiftX: 0, shiftY: 0,
  exposure: 0, toneMapping: "none",
  cursorEnabled: true, cursorHorizontal: 15, cursorVertical: 3.6,
  cursorSmoothing: 1.5, cursorReverse: true,
}

export const defaultText = {
  textPresetVersion: 1,
  textEnabled: true, floorText: "survivors", textFontSize: 247, textColor: "#f5f5f0",
  textX: 0, textZ: 0, textHeight: 0.015, textRotation: 90, textTilt: 0,
  textStartFontSize: 8, textScrollStart: 12, textScrollEnd: 100,
  textEase: "linear",
  textAsciiColumns: 40, textAsciiEndColumns: 140, textAsciiBlackPoint: 0, textAsciiWhitePoint: 0.93,
}

export const defaultSearchlights = {
  searchlights: true, searchlightColor: "#f5f5f0",
  searchlightDotSize: 0, searchlightSpacing: 0, searchlightDensity: 0.7,
  lampFlicker: true, lampFlickerEvery: 10, lampFlickerCount: 2, // while the lamp is on, the failing-bulb effect repeats: every N seconds, this many dark flicks
  contactMusic: true, contactTrack: "loop", contactMusicVolume: 0.5, contactMusicDelay: 0, contactMusicFadeIn: 1.5, contactMusicFadeOut: 1, // loops for as long as the Contact (sky) view is up
  humSound: true, humVolume: 0.5, humDelay: 0, humFadeIn: 1.5, humFadeOut: 1, // the industrial hum, looping through both sky-view steps (device centred and sky)
  lightSound: true, lightTrack: "v2", lightVolume: 0.6, lightDelay: 0, // the cue as the camera leaves the initial view for the targeted device: on, level, wait (s)
  // Sky step camera move (from the original Blender camera): turn about the vertical axis, tip up, time in / out, and where the projection hangs
  lookYaw: -135, lookPitch: 60, lookIn: 1, lookOut: 1, skyDistance: 60, skySize: 0.4,
  searchlightSkyFocus: true, searchlightZoom: 1.5, searchlightChrome: true,
  plantsShrink: true, shrinkDuration: 0.5, shrinkSpread: 0.8, shrinkOrder: "nearest", shrinkReturn: 1, shrinkDustFade: 0.35,
  shrinkEaseX1: 0, shrinkEaseY1: 0, shrinkEaseX2: 1, shrinkEaseY2: 1, shrinkSoftness: 1, shrinkOverlap: 2,
}

export const defaultModel = {
  tigerMaterial: "chrome", tigerColor: "#ffffff", tigerRoughness: 0.04, tigerMetalness: 1, tigerWireframe: false, tigerReflection: 1, tigerStudioRotation: 0,
  tigerVisible: true, tigerScale: 1, tigerX: 0, tigerY: 0, tigerZ: 0, tigerRotation: 0,
  playing: true, speed: 1, repeat: "loop", start: 0,
  stepSound: true, stepVolume: 0.32, stepOffset: 0,
  audioPresetVersion: 1,
  hoverSound: true, hoverVolume: 0.18, hoverTrack: "digital",
  ambientSound: true, ambientVolume: 0.4, ambientTrack: "cowboy",
  rotationX: 0, rotationY: 0, rotationZ: 0,
  positionX: 0, positionY: 0, positionZ: 0, scale: 1, spin: 0,
  material: "original", wireframe: false,
  studioLight: 1.2, keyLight: 2.2, keyAngle: 51.34, keyHeight: 51.33,
  keyColor: "#ffffff", rimLight: 0, rimColor: "#ffcb00",
  ...defaultCamera,
  ...defaultText,
  ...defaultSearchlights,
}

export type AsciiSettings = typeof defaultAscii
export type ModelSettings = typeof defaultModel
