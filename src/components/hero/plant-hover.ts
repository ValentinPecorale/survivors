import * as THREE from "three"
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh"

export type PlantKind = "ear" | "grove" | "tree"

/**
 * Triangle-accurate hover for the plants GLB without paying for it every frame.
 *
 * plants.glb is 3.07M triangles in 103 animated instances, but only 3 unique geometries. A BVH per geometry
 * (≈60ms once on desktop, built when hover sound is first switched on) makes one cursor ray ≈0.05ms, so it is
 * run only on pointer movement, never in the render loop. Meshes keep their own world matrices, so the
 * animation moves them under the cursor and the ray still hits the right instance.
 */
export function createPlantPicker(root: THREE.Object3D) {
  const kinds = new Map<THREE.Mesh, PlantKind>()
  const geometries = new Set<THREE.BufferGeometry>()
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    const material = Array.isArray(object.material) ? object.material[0] : object.material
    const name = material?.name ?? ""
    // Material names come from the Blender export: Haze_Ear_* (grass heads), Haze_Grove_* (undergrowth), Haze_Tree_*.
    // Dust puffs and the ground are deliberately left out.
    const kind: PlantKind | null = name.startsWith("Haze_Ear") ? "ear" : name.startsWith("Haze_Grove") ? "grove" : name.startsWith("Haze_Tree") ? "tree" : null
    if (!kind) return
    kinds.set(object, kind)
    geometries.add(object.geometry)
    object.raycast = acceleratedRaycast
  })
  for (const geometry of geometries) if (!geometry.boundsTree) geometry.boundsTree = new MeshBVH(geometry, { maxLeafTris: 10 })

  const meshes = [...kinds.keys()]
  const ids = new Map(meshes.map((mesh, i) => [mesh, i]))
  const raycaster = new THREE.Raycaster()
  raycaster.firstHitOnly = true
  raycaster.layers.enableAll() // plants sit on a mask layer for the ASCII pass; hit them all the same
  const ndc = new THREE.Vector2()

  return {
    /** Nearest plant under the cursor (normalised device coords, −1…1), or null. `id` is stable per instance. */
    pick(x: number, y: number, camera: THREE.Camera): { id: number; kind: PlantKind } | null {
      ndc.set(x, y)
      raycaster.setFromCamera(ndc, camera)
      const hit = raycaster.intersectObjects(meshes, false)[0]
      if (!hit) return null
      return { id: ids.get(hit.object as THREE.Mesh) ?? -1, kind: kinds.get(hit.object as THREE.Mesh)! }
    },
    dispose() {
      for (const geometry of geometries) geometry.boundsTree = undefined
      for (const mesh of meshes) mesh.raycast = THREE.Mesh.prototype.raycast
    },
  }
}
