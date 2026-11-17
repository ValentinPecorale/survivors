/* Three.js materials, cameras and uniforms are mutable GPU resources. */
/* eslint-disable react-hooks/immutability */
"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { finishes, type ShapeSurface } from "./lib/shape-surface";
import type { ShapeCamera } from "./lib/shape-camera";
import type { ShapeLighting } from "./lib/shape-lighting";
import type { ShapeMotion } from "./lib/shape-motion";
import { build } from "./lib/svg-extrusion";
import { fragment, rgb, type MeshSettings } from "./mesh-gradient";

/**
 * Rung 4 (R3F). The existing mesh shader renders into an offscreen square
 * texture; the cube samples that texture. The gradient shader is untouched,
 * so every live setting drives the cube too.
 */

const passVertex = `void main() { gl_Position = vec4(position.xy, 0., 1.); }`;

export interface SvgOptions { source: string; depth: number; bevel: number }
function SvgMesh({ svg, material }: { svg: SvgOptions; material: THREE.MeshPhysicalMaterial }) {
  const result = useMemo(() => {
    const model = build(svg.source, { depth: svg.depth, bevel: svg.bevel, quality: 8, color: '#ffffff', original: false, roughness: 0.4, metalness: 0 });
    model.group.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.geometry.translate(object.position.x, object.position.y, object.position.z);
        object.position.set(0, 0, 0);
        const positions = object.geometry.attributes.position;
        const uv = new Float32Array(positions.count * 2);
        for (let i = 0; i < positions.count; i++) {
          uv[i * 2] = positions.getX(i) / 3 + 0.5;
          uv[i * 2 + 1] = positions.getY(i) / 3 + 0.5;
        }
        object.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        object.material.dispose(); object.material = material;
      }
    });
    return model.group;
  }, [svg.source, svg.depth, svg.bevel, material]);
  useEffect(() => () => { result.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); }); }, [result]);
  return <primitive object={result} dispose={null} />;
}

interface Live { settings: MeshSettings; paused: boolean; motion: ShapeMotion; recenter: number; surface: ShapeSurface; lighting: ShapeLighting }

export interface CubeDims { x: number; y: number; z: number }

function Cube({ live, size, dims, svg, surface, reflections }: { live: React.RefObject<Live>; size: number; dims: CubeDims; svg?: SvgOptions; surface: ShapeSurface; reflections: number }) {
  const gl = useThree(state => state.gl);
  const group = useRef<THREE.Group>(null);
  const shapePointer = useRef({ x: 0, y: 0 });
  const pointer = useRef({ x: 0, y: 0 });         // −1..1 across window
  const cursor = useRef({ x: -0.537, y: 0.296 }); // eased, in shader uv space
  const phase = useRef(0);
  const tilt = useRef({ x: 0, y: 0 });
  const idle = useRef(0);

  const rt = useMemo(() => new THREE.WebGLRenderTarget(size, size, { depthBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }), [size]);
  const pass = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      vertexShader: passVertex, fragmentShader: fragment, depthTest: false, depthWrite: false,
      uniforms: {
        resolution: { value: new THREE.Vector2(size, size) }, cursor: { value: new THREE.Vector2() },
        phase: { value: 0 }, warp: { value: 0 }, softness: { value: 0 }, size: { value: 1 }, intensity: { value: 1 },
        colors: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) },
      },
    });
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    mesh.frustumCulled = false; scene.add(mesh);
    return { scene, material, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
  }, [size]);
  const skin = useMemo(() => new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide }), []);


  useEffect(() => { skin.envMapIntensity = reflections; }, [skin, reflections]);
  const bump = useMemo(() => {
    const data = new Uint8Array(256 * 256 * 4);
    let seed = 42;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let y = 0; y < 256; y++) {
      const line = random();
      for (let x = 0; x < 256; x++) {
        const value = Math.round(255 * (surface.texture === 'brushed' ? line * 0.85 + random() * 0.15 : random()));
        const i = (y * 256 + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = value; data[i + 3] = 255;
      }
    }
    const texture = new THREE.DataTexture(data, 256, 256);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true; texture.repeat.set(3, 3); texture.needsUpdate = true;
    return texture;
  }, [surface.texture]);
  useEffect(() => () => bump.dispose(), [bump]);
  useEffect(() => {
    const generator = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const environment = generator.fromScene(room, 0.04, 0.1, 100, { size: 256 });
    skin.envMap = environment.texture; skin.needsUpdate = true;
    room.dispose(); generator.dispose();
    return () => environment.dispose();
  }, [gl, skin]);
  useEffect(() => {
    const preset = finishes[surface.finish];
    skin.map = surface.fill === 'gradient' ? rt.texture : null;
    skin.color.set(surface.fill === 'solid' ? surface.color : '#ffffff');
    skin.roughness = surface.roughness; skin.metalness = preset.metalness; skin.clearcoat = preset.clearcoat;
    skin.bumpMap = surface.texture === 'smooth' ? null : bump;
    skin.bumpScale = surface.strength * 0.06;
    skin.needsUpdate = true;
  }, [surface, skin, rt, bump]);
  useEffect(() => () => skin.dispose(), [skin]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest("button, a, .settings-panel")) return;
      pointer.current.x = event.clientX / innerWidth * 2 - 1;
      pointer.current.y = 1 - event.clientY / innerHeight * 2;
      shapePointer.current = { ...pointer.current };
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);
  useEffect(() => () => { rt.dispose(); pass.material.dispose(); pass.scene.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); }, [rt, skin, pass]);

  const recenter = live.current.recenter;
  useEffect(() => {
    shapePointer.current = { x: 0, y: 0 };
    tilt.current = { x: 0, y: 0 };
    idle.current = 0;
    group.current?.rotation.set(0, 0, 0);
  }, [svg?.source, recenter]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const { settings: s, paused, motion } = live.current;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Gradient light follows the cursor with the same smoothing slider as the flat version.
    const ease = reduced || s.smoothing === 0 ? 1 : 1 - Math.exp(-dt * 1000 / (s.smoothing / 3));
    cursor.current.x += (pointer.current.x - cursor.current.x) * ease;
    cursor.current.y += (pointer.current.y - cursor.current.y) * ease;
    if (!paused && !reduced) { phase.current += dt * s.speed * Math.PI * 2 / 7.766667; idle.current += dt * THREE.MathUtils.degToRad(motion.idle); }

    const u = pass.material.uniforms;
    u.cursor.value.set(cursor.current.x, cursor.current.y); u.phase.value = phase.current;
    u.warp.value = s.warp; u.softness.value = s.softness; u.size.value = s.size / 100; u.intensity.value = s.intensity / 100;
    [s.highlight, s.shadow, s.slate, s.base].forEach((hex, i) => u.colors.value[i].fromArray(rgb(hex)));


    const prev = gl.getRenderTarget();
    if (surface.fill === "gradient") { gl.setRenderTarget(rt); gl.render(pass.scene, pass.camera); gl.setRenderTarget(prev); }

    if (group.current) {
      // Exponential damping: reaches 95% of the target in the chosen settling time.
      const k = reduced || motion.settling === 0 ? 1 : 1 - Math.exp(-dt * 3000 / motion.settling);
      const active = motion.enabled && !reduced;
      const direction = motion.invert ? -1 : 1;
      const targetX = active ? -shapePointer.current.y * THREE.MathUtils.degToRad(motion.vertical) * direction : 0;
      const targetY = active ? shapePointer.current.x * THREE.MathUtils.degToRad(motion.horizontal) * direction : 0;
      tilt.current.x += (targetX - tilt.current.x) * k;
      tilt.current.y += (targetY - tilt.current.y) * k;
      group.current.rotation.set(tilt.current.x, tilt.current.y + (reduced ? 0 : idle.current), 0);
    }
  });

  return (
    <group ref={group}>
      {svg ? <SvgMesh svg={svg} material={skin} /> : <RoundedBox args={[dims.x, dims.y, dims.z]} radius={Math.min(0.07, Math.min(dims.x, dims.y, dims.z) * 0.45)} smoothness={4} material={skin} />}
    </group>
  );
}

function CameraRig({ options, radius, fitSvg = false }: { options: ShapeCamera; radius: number; fitSvg?: boolean }) {
  const { size, set } = useThree();
  const cameras = useMemo(() => ({ orthographic: new THREE.OrthographicCamera(), perspective: new THREE.PerspectiveCamera() }), []);
  useLayoutEffect(() => {
    const camera = cameras[options.projection];

    const aspect = size.width / Math.max(1, size.height);
    // Match the 2× canvas area while preserving the six-column visual scale.
    const overscan = 2;
    const span = fitSvg ? 3.04 / aspect : Math.max(4.2, radius * 2.25);
    camera.near = 0.1; camera.far = 200;
    if (camera instanceof THREE.OrthographicCamera) {
      camera.left = -size.width / 2; camera.right = size.width / 2;
      camera.top = size.height / 2; camera.bottom = -size.height / 2;
      camera.zoom = Math.min(size.width, size.height) / (span * overscan) * options.zoom / 100;
      camera.position.set(0, 0, 20);
    } else {
      camera.aspect = aspect; camera.fov = options.fov; camera.zoom = options.zoom / (100 * overscan);
      // Dolly with FOV to keep the object's framing consistent while changing perspective.
      const distance = span / (2 * Math.tan(THREE.MathUtils.degToRad(options.fov / 2)) * Math.min(1, aspect));
      camera.position.set(0, 0, distance + radius * 0.25);
    }
    camera.setViewOffset(size.width, size.height, -size.width * options.offsetX / (100 * overscan), size.height * options.offsetY / (100 * overscan), size.width, size.height);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    set({ camera });
  }, [cameras, options, radius, fitSvg, set, size.width, size.height]);
  return null;
}

export default function GradientCube({ settings, paused, dims, svg, motion, recenter, surface, lighting, cameraOptions }: { settings: MeshSettings; paused: boolean; dims: CubeDims; svg?: SvgOptions; motion: ShapeMotion; recenter: number; surface: ShapeSurface; lighting: ShapeLighting; cameraOptions: ShapeCamera }) {
  const live = useRef<Live>({ settings, paused, motion, recenter, surface, lighting });
  useLayoutEffect(() => { live.current = { settings, paused, motion, recenter, surface, lighting }; }, [settings, paused, motion, recenter, surface, lighting]);
  const azimuth = THREE.MathUtils.degToRad(lighting.azimuth);
  const elevation = THREE.MathUtils.degToRad(lighting.elevation);
  const keyPosition: [number, number, number] = [8 * Math.sin(azimuth) * Math.cos(elevation), 8 * Math.sin(elevation), 8 * Math.cos(azimuth) * Math.cos(elevation)];
  // 1024² desktop / 512² phone: power-of-two, ~4MB / 1MB. The shader is the cost, not the memory.
  const size = typeof innerWidth !== "undefined" && innerWidth <= 640 ? 512 : 1024;
  return (
    <div className="cube-field" aria-hidden="true">
      <Canvas orthographic dpr={1} camera={{ zoom: 150, position: [0, 0, 10], near: 0.1, far: 100 }} gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}>
        <CameraRig fitSvg={!!svg} options={cameraOptions} radius={svg ? 2.1 : 0.5 * Math.hypot(dims.x, dims.y, dims.z)} />
        <ambientLight intensity={lighting.ambient} />
        <directionalLight position={keyPosition} intensity={lighting.keyIntensity} color={lighting.keyColor} />
        <directionalLight position={[-4, 1, 2]} intensity={lighting.fillIntensity} color={lighting.fillColor} />
        <Cube live={live} size={size} dims={dims} svg={svg} surface={surface} reflections={lighting.reflections} />
      </Canvas>
    </div>
  );
}


