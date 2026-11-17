export interface ShapeCamera { projection: 'orthographic' | 'perspective'; zoom: number; fov: number; offsetX: number; offsetY: number }
export const defaultShapeCamera: ShapeCamera = { projection: 'orthographic', zoom: 100, fov: 32, offsetX: 0, offsetY: 0 };
