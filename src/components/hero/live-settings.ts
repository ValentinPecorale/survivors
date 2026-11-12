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
  textEnabled: true, floorText: "survivors", textFontSize: 308, textColor: "#f5f5f0",
  textX: 0, textZ: 0, textHeight: 0.015, textRotation: 90, textTilt: 0,
  textStartFontSize: 8, textScrollStart: 0, textScrollEnd: 100,
  textFitViewport: true, textEase: "linear",
  textAsciiColumns: 152, textAsciiEndColumns: 152, textAsciiBlackPoint: 0, textAsciiWhitePoint: 0.93,
}

export const defaultModel = {
  tigerMaterial: "chrome", tigerColor: "#ffffff", tigerRoughness: 0.04, tigerMetalness: 1, tigerWireframe: false, tigerReflection: 1, tigerStudioRotation: 0,
  tigerVisible: true, tigerScale: 1, tigerX: 0, tigerY: 0, tigerZ: 0, tigerRotation: 0,
  playing: true, speed: 1, repeat: "loop", start: 0,
  rotationX: 0, rotationY: 0, rotationZ: 0,
  positionX: 0, positionY: 0, positionZ: 0, scale: 1, spin: 0,
  material: "original", wireframe: false,
  studioLight: 1.2, keyLight: 2.2, keyAngle: 51.34, keyHeight: 51.33,
  keyColor: "#ffffff", rimLight: 0, rimColor: "#ffcb00",
  ...defaultCamera,
  ...defaultText,
}

export type AsciiSettings = typeof defaultAscii
export type ModelSettings = typeof defaultModel
