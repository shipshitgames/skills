import * as THREE from 'three'
import type { TileGrid, Tile } from './TileGrid'

// Pure pointer->tile projection. Raycast the ground plane (Y=0), then snap.
// This is the iso analogue of the FPS centre-screen raycast in context.ts.

const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const _ndc = new THREE.Vector2()
const _hit = new THREE.Vector3()

/** Pointer (client px) -> tile under the cursor, or null if off the board. */
export function screenToTile(
  clientX: number,
  clientY: number,
  dom: HTMLElement,
  camera: THREE.Camera,
  raycaster: THREE.Raycaster,
  grid: TileGrid,
): Tile | null {
  const r = dom.getBoundingClientRect()
  _ndc.set(
    ((clientX - r.left) / r.width) * 2 - 1,
    -((clientY - r.top) / r.height) * 2 + 1,
  )
  raycaster.setFromCamera(_ndc, camera)
  if (!raycaster.ray.intersectPlane(GROUND, _hit)) return null
  const t = grid.worldToTile(_hit.x, _hit.z)
  return grid.inBounds(t.tx, t.tz) ? t : null
}
