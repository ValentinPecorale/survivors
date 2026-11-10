# Survivors — project context

Updated: 2026-11-10.

## Purpose and direction

Survivors is a design studio website. The user is a designer and describes intent in design terms; implementation decisions should be explained in design language with concrete motion values.

The quality references are:

- [Basement](https://basement.studio/)
- [Joyco](https://joyco.studio/)

Target: awwwards-level visual craft, interaction, motion and performance. Specific reference layouts, copy and motion sequences still need direction from the user. The references establish the ambition; they are not a complete design specification.

## Current scope

Only the hero section has been built. The homepage currently renders that hero. The rest of the website, including its structure, content and portfolio presentation, remains to be designed.

The properties panel is the current tool for tuning the hero. Its eventual visibility on the public website has not been decided.

## Hero concept and implementation

- A looping environment of trees and plants rendered as ASCII.
- A separately loaded, animated tiger in chrome, excluded from ASCII.
- The two foreground trees can pass in front of the tiger; background plants remain behind it through real depth testing. Foreground geometry occludes with its full silhouette, including spaces between ASCII glyphs.
- Both GLBs have a roughly 10.83-second `Loop` animation. Play, pause, speed, repeat and seek controls affect both. The re-exports dated 2026-11-10 17:09 UTC also contain matching camera translation tracks (261 keys). Their authored vertical landing dip is sampled at the environment mixer time, after stable framing. `camera-landing.json` preserves those tiny camera offsets losslessly to avoid meshopt filter precision stepping. Camera → Landing motion controls enable it and set strength (1× = authored). Reduced motion disables the dip.
- The tiger uses one fixed framing envelope measured across 65 poses of the full run, with 6% padding (`tiger-framing.json`). The camera target and fit never follow animated limb/tail bounds. This avoids camera bobbing and lens-shift turbulence; individual poses move naturally inside the centered shot. Cursor orbit and explicit subject edits still update the framing. The intentional authored footstep dip is layered on afterward and is never cancelled by auto-centering. Portrait screens fit the complete envelope within 84% of the viewport. Regenerate this metadata when replacing the tiger model or animation.
- The resting camera is level with the tiger center and perpendicular to its path for a pure side profile. The existing lens, orbit distance and framing shifts are retained; manual orbit/elevation offsets of 0 give the square-on view.
- Cursor movement orbits the camera around the tiger horizontally and vertically. The camera keeps looking at the tiger, at a constant orbit distance for a fixed target. Cursor motion does not rotate the models.
- Orbit defaults: ±15° horizontal, ±3.6° vertical, 1.5 smoothing, reversed; landing strength 4×; focal length 56mm. The orbit center follows the tiger's position and scale. Touch and reduced-motion preferences disable cursor camera movement.
- ASCII white point is 0.20 at rest and 0.12 around the cursor. Hover defaults: 120px radius, soft edge, 180ms easing. The tiger is unaffected. Touch devices keep the resting ASCII effect.
- Live panel tabs: ASCII, 3D Model and Camera. Controls include rendering, materials, lighting, transforms, animation and camera settings.

## Chrome reference

The user provided `C:/Users/valen/Downloads/shader-lab-2026-11-10T16-10-30.lab` as the material reference.

Chrome uses Shader Lab's actual Studio HDR, physical node material, luminance normalization and Neutral tone mapping. Reference values: white, roughness 0.04, metalness 1, studio intensity 1, studio rotation 0. HDR alignment compensates for the reference viewer's model rotation while preserving the tiger's authored placement in the forest.

See [Shader Lab chrome provenance](third-party/shader-lab-chrome.md).

## Runtime and assets

Next.js App Router + TypeScript + Tailwind, React Three Fiber/drei and Three.js WebGPU. Shader Lab provides ASCII postprocessing. GSAP and Lenis are installed for future choreography.

- `public/models/plants.glb`: compressed environment incl. 12 animated tiger-paw dust puffs (`Dust_*`, material `Dust_Puff`, depthWrite off), approximately 3.4 MB; built from plants_loop.glb with gltf-transform webp + meshopt.
- `public/models/tiger.glb`: meshopt-compressed tiger, approximately 315 KB; 4,650 triangles and a 1024×1024 texture.
- `public/environments/studio_small_03_1k.hdr`: Studio reflections, approximately 1.7 MB.
- `public/models/scene-poster.webp`: static fallback when WebGPU is unavailable.

The original tiger was imported from `C:/Users/valen/Desktop/creative space/survivors/tiger_only_loop.glb`.

The user also shared a Blender handoff screenshot describing updated, level side-profile cameras and re-exported GLBs. Verify the actual camera and timestamps of each source export before replacing runtime assets; Blender and glTF use different coordinate conventions.

## Defaults and deployment

Code defaults live in `src/components/hero/live-settings.ts`.

**Save as default** stores the complete configuration in this browser's localStorage, under `survivors:default-settings:v2`. It restores on reopening, but does not update source defaults or publish a configuration to other browsers. A production-wide preset should be captured explicitly into source when requested.

The repository is linked to Vercel project `survivors`, owned by `pecoralev-8218's projects`. Production releases ship from the GitHub `main` branch to https://survivors-ten.vercel.app.

## Development

Read [AGENTS.md](AGENTS.md) and relevant installed Next.js documentation before code changes.

```sh
npm install
npm run dev
npm run lint
npm run build
```

Local preview: http://localhost:3000.

Keep asset loading, mobile fallback and frame budget in view. Use the lowest implementation rung that achieves the design intent. Confirm motion timing and triggers before implementing substantial new reference-driven sequences.
