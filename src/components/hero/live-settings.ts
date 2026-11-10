export const defaultAscii = {
  hoverEnabled: true, hoverWhitePoint: 0.12, hoverRadius: 120,
  enabled: true, autoColumns: true, columns: 280,
  input: "luminance", breakGrid: "off", breakThreshold: 0.06,
  fontFamily: "mono", charset: "light", customChars: " .:-=+*#%@",
  boldness: 0, colorMode: "monochrome", monoColor: "#f5f5f0",
  signalBlackPoint: 0, signalWhitePoint: 0.2, invert: false, rowWarp: 0,
}

export const defaultCamera = {
  landingMotion: true, landingStrength: 1,
  focalLength: 85.56, orbit: 0, elevation: 0, shiftX: 0, shiftY: 0,
  exposure: 0, toneMapping: "none",
  cursorEnabled: true, cursorHorizontal: 3, cursorVertical: 2,
  cursorSmoothing: 0.35, cursorReverse: false,
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
}

export type AsciiSettings = typeof defaultAscii
export type ModelSettings = typeof defaultModel
