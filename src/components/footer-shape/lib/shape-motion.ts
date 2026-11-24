export interface ShapeMotion { enabled: boolean; horizontal: number; vertical: number; settling: number; idle: number; invert: boolean }
export const defaultShapeMotion: ShapeMotion = { enabled: true, horizontal: 20, vertical: 20, settling: 900, idle: 0, invert: false };
