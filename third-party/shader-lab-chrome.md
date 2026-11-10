# Shader Lab chrome reference

Studio HDR: `studio_small_03_1k.hdr`, from https://github.com/basementstudio/shader-lab/tree/main/public/environments.

The chrome physical material, HDR luminance normalization, camera-relative key light and Neutral tone mapping follow Shader Lab's `src/renderer/model-materials.ts`, `model-loaders.ts` and `model-pass.ts`.

Reference settings came from the user's `shader-lab-2026-11-10T16-10-30.lab`: white, roughness 0.04, metalness 1, studio intensity 1, studio rotation 0, key intensity 1, azimuth 135°, elevation 45°, exposure 0, Neutral tone mapping. The inverse reference model rotation (26.4°, -71.8°, 37.4°) aligns the HDR to the tiger's authored forest placement.

Upstream license: `third-party/shader-lab-LICENSE.md`.
