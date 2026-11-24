export const finishes = {
  matte: { roughness: 0.95, metalness: 0, clearcoat: 0 },
  satin: { roughness: 0.5, metalness: 0, clearcoat: 0.15 },
  glossy: { roughness: 0.16, metalness: 0, clearcoat: 0.8 },
  metal: { roughness: 0.28, metalness: 1, clearcoat: 0 },
};
export interface ShapeSurface {
  fill: 'gradient' | 'solid'; color: string; finish: keyof typeof finishes;
  texture: 'smooth' | 'grain' | 'brushed'; roughness: number; strength: number;
}
export const defaultShapeSurface: ShapeSurface = { fill: 'gradient', color: '#b5b7c4', finish: 'matte', texture: 'smooth', roughness: 0.95, strength: 0.3 };
