// Extracted from extrude 3d/lib/model.ts.
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
export const SAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><path fill="#5674ec" d="M80 10H120V60L155 25L183 53L148 88H198V128H148L183 163L155 191L120 156V200H80V156L45 191L17 163L52 128H2V88H52L17 53L45 25L80 60Z"/></svg>`;
export type Settings = {depth:number;bevel:number;quality:number;color:string;original:boolean;roughness:number;metalness:number};
export function build(svg:string, s:Settings){
 const xml = new DOMParser().parseFromString(svg,'image/svg+xml');
 if(xml.querySelector('parsererror') || xml.documentElement.localName!=='svg') throw Error('This file is not a valid SVG.');
 if(xml.querySelector('text, image, mask, clipPath, filter, use, script, foreignObject, linearGradient, radialGradient')) throw Error('Outline text and flatten masks, gradients, filters and linked shapes before importing.');
 const data=new SVGLoader().parse(svg); const group=new THREE.Group();
 const entries=data.paths.filter(p=>{ const style=p.userData?.style as {fill?:string;visibility?:string;display?:string}|undefined; return style?.fill!=='none' && style?.visibility!=='hidden' && style?.display!=='none'; });
 const all=entries.flatMap(path=>SVGLoader.createShapes(path).map(shape=>({shape,path})));
 if(!all.length) throw Error('No filled shapes found. Convert strokes to outlines first.');
 if(all.length>150) throw Error('Please simplify this SVG to fewer than 150 shapes.');
 const bounds=new THREE.Box2(); all.forEach(({shape})=>shape.getPoints(12).forEach(p=>bounds.expandByPoint(p)));
 const size=bounds.getSize(new THREE.Vector2()); const extent=Math.max(size.x,size.y); if(!Number.isFinite(extent)||extent<=0) throw Error('The SVG has no visible area.');
 const scale=3/extent;
 try {for(const {shape,path} of all){
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:s.depth/scale,bevelEnabled:s.bevel>0,bevelThickness:s.bevel/scale,bevelSize:s.bevel/scale,bevelSegments:3,steps:1,curveSegments:s.quality});
 geometry.scale(scale,-scale,-scale);
 const material=new THREE.MeshStandardMaterial({color:s.original?path.color:s.color,roughness:s.roughness,metalness:s.metalness,side:THREE.DoubleSide});
 const mesh=new THREE.Mesh(geometry,material); group.add(mesh);
 }
 const box=new THREE.Box3().setFromObject(group);const center=box.getCenter(new THREE.Vector3()); group.children.forEach(m=>m.position.sub(center));
 const triangles=group.children.reduce((n,o)=>{const g=(o as THREE.Mesh).geometry;return n+(g.index?g.index.count:g.attributes.position.count)/3},0);
 if(triangles>60000) throw Error('Geometry exceeds 60,000 triangles. Simplify paths or reduce curve quality.');
 return {group,triangles,shapes:all.length};
 }catch(e){dispose(group);throw e}
}
export function dispose(group:THREE.Group){group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();o.material.dispose()}})}
