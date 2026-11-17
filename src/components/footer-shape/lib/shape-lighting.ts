export interface ShapeLighting {
  keyIntensity: number; keyColor: string; azimuth: number; elevation: number;
  fillIntensity: number; fillColor: string; ambient: number; reflections: number;
}
export const defaultShapeLighting: ShapeLighting = {
  keyIntensity: 2.2, keyColor: '#ffffff', azimuth: 27, elevation: 37,
  fillIntensity: 0.7, fillColor: '#ffffff', ambient: 0.5, reflections: 0.7,
};
