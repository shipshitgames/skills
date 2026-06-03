---
name: isometric-3d
description: Build a 3D isometric game (tactics, base-builder, dungeon-crawler) on the Ship Shit engine — orthographic iso camera, tile/grid model, pointer raycast to tile (click-to-select/move), draw-order/depth, camera pan/zoom/rotate, and A* pathfinding. Use when starting or extending any grid-based top-down-3D game.
license: MIT
metadata:
  version: "0.1.0"
  tags: "isometric, three.js, tactics, pathfinding, game-dev"
  author: Ship Shit Games
---

# Isometric 3D foundation

A reusable, genre-agnostic foundation for grid-based 3D games rendered with an
**orthographic camera at an isometric angle**. The world is real 3D Three.js
geometry (not 2D sprites) — "isometric" here means the *camera*, not faked depth.
Everything is driven by a tile grid: selection, movement, building, and
pathfinding all speak in `{ tx, tz }` tile coordinates, and a pair of pure
helpers converts between tile / world / screen space.

This skill assumes the studio engine architecture (`GameContext` + `GameSystems`
registry, imperative Three.js, React HUD via `StateListener`). See
**shipshit-engine** for that shape. Read the canonical FPS proof for the system
pattern: `games/scourge-survivors/src/game/context.ts`, `games/scourge-survivors/src/game/render/RenderSystem.ts`,
`games/scourge-survivors/src/game/data/maps.ts`.

The FPS uses a `PerspectiveCamera` + `PointerLockControls`; an iso game swaps
both out for an `OrthographicCamera` + a custom `IsoCameraSystem`. Everything
else (context-as-world, systems-call-siblings-via-`this.sys`, data-driven
content) is identical.

## File layout

```
src/game/
  context.ts            # add grid, camera rig, selection, hover tile to the world
  systems.ts            # GameSystems registry (type-only imports)
  constants.ts          # TILE_SIZE, ISO_ANGLE, zoom bounds, pan speed
  data/
    levels.ts           # tile maps as data (height/terrain/blocked per tile)
  grid/
    TileGrid.ts         # the grid model + tileToWorld/worldToTile
    iso.ts              # screenToTile raycast helper, pure projection math
    pathfinding.ts      # A* over the grid
  render/
    RenderSystem.ts     # orthographic camera bootstrap + per-frame draw
    IsoCameraSystem.ts  # pan / zoom / rotate rig
  systems/
    InputSystem.ts      # pointer + keyboard -> hover/select/commands
    HudSystem.ts        # push HUDState snapshot to React
```

## The grid model — tiles are the source of truth

A flat XZ grid centered on the origin. Tile `(tx, tz)` has its **center** at a
world position; the grid stores per-tile data (walkable, height, occupant).
Keep this in `data/levels.ts` as plain data, exactly like `maps.ts` does for the
FPS — gameplay logic never hardcodes a level.

```ts
// data/levels.ts
export interface TileDef {
  /** terrain height in tiles (0 = floor). Stacks render as raised boxes. */
  h?: number
  /** impassable to movement + building (walls, water, void). */
  blocked?: boolean
  /** terrain kind, drives material/tint (see ArenaSystem analogue). */
  terrain?: 'floor' | 'water' | 'rock'
}

export interface IsoLevel {
  id: string
  name: string
  cols: number // tiles along +X
  rows: number // tiles along +Z
  /** row-major: tiles[tz][tx]. Sparse — undefined = default floor. */
  tiles: (TileDef | undefined)[][]
  spawn: { tx: number; tz: number }
}
```

## TileGrid + projection helpers

`TILE_SIZE` (world units per tile) lives in `constants.ts`. The grid is centered:
tile `(0,0)` sits at world `(-halfW, 0, -halfH)` so the level straddles the origin
and the camera can frame it symmetrically.

```ts
// grid/TileGrid.ts
import * as THREE from 'three'
import { TILE_SIZE } from '../constants'
import type { IsoLevel, TileDef } from '../data/levels'

export interface Tile { tx: number; tz: number }

export class TileGrid {
  readonly cols: number
  readonly rows: number
  private readonly originX: number // world X of tile (0,0) center
  private readonly originZ: number
  private readonly defs: (TileDef | undefined)[][]

  constructor(level: IsoLevel) {
    this.cols = level.cols
    this.rows = level.rows
    this.defs = level.tiles
    // center the board on the origin
    this.originX = -((this.cols - 1) * TILE_SIZE) / 2
    this.originZ = -((this.rows - 1) * TILE_SIZE) / 2
  }

  inBounds(tx: number, tz: number) {
    return tx >= 0 && tz >= 0 && tx < this.cols && tz < this.rows
  }

  get(tx: number, tz: number): TileDef | undefined {
    return this.inBounds(tx, tz) ? this.defs[tz]?.[tx] : undefined
  }

  height(tx: number, tz: number) {
    return this.get(tx, tz)?.h ?? 0
  }

  /** Walkable = in bounds and not flagged blocked. */
  walkable(tx: number, tz: number) {
    if (!this.inBounds(tx, tz)) return false
    return !this.get(tx, tz)?.blocked
  }

  /** Tile center -> world position. `out` reused to avoid GC. */
  tileToWorld(tx: number, tz: number, out = new THREE.Vector3()) {
    return out.set(
      this.originX + tx * TILE_SIZE,
      this.height(tx, tz) * TILE_SIZE,
      this.originZ + tz * TILE_SIZE,
    )
  }

  /** World position -> nearest tile (floored to the tile the point sits in). */
  worldToTile(wx: number, wz: number): Tile {
    return {
      tx: Math.round((wx - this.originX) / TILE_SIZE),
      tz: Math.round((wz - this.originZ) / TILE_SIZE),
    }
  }
}
```

`screenToTile` raycasts the pointer against the ground plane (Y=0), then snaps —
this is the iso equivalent of the FPS centre-screen raycast in `context.ts`
(`raycaster` + `screenCenter`). Raycasting a plane (not meshes) is cheap and
exact, and works even over empty tiles.

```ts
// grid/iso.ts
import * as THREE from 'three'
import type { TileGrid, Tile } from './TileGrid'

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
  _ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1)
  raycaster.setFromCamera(_ndc, camera)
  if (!raycaster.ray.intersectPlane(GROUND, _hit)) return null
  const t = grid.worldToTile(_hit.x, _hit.z)
  return grid.inBounds(t.tx, t.tz) ? t : null
}
```

## Orthographic iso camera

Replace the FPS `PerspectiveCamera` (`RenderSystem.setupScene`) with an
`OrthographicCamera`. Iso look = camera offset on a diagonal, looking down at the
target; orthographic projection removes perspective so equal tiles stay equal
size everywhere on screen.

```ts
// constants.ts (excerpt)
export const TILE_SIZE = 1
export const ISO_PITCH = Math.atan(1 / Math.SQRT2) // ~35.264°, the "true" iso angle
export const ISO_YAW = Math.PI / 4                   // 45° — facing a board corner
export const CAM_DIST = 30                            // boom length (world units)
export const ZOOM_MIN = 8
export const ZOOM_MAX = 40
export const PAN_SPEED = 1.0
```

```ts
// render/RenderSystem.ts (iso variant — the camera setup that differs from FPS)
const aspect = this.ctx.container.clientWidth / this.ctx.container.clientHeight
// frustum half-height = zoom; width follows aspect. Updated on zoom + resize.
const h = this.ctx.zoom
this.ctx.camera = new THREE.OrthographicCamera(-h * aspect, h * aspect, h, -h, 0.1, 400)
this.ctx.scene.add(this.ctx.camera)
```

```ts
// render/IsoCameraSystem.ts
import * as THREE from 'three'
import { ISO_PITCH, ISO_YAW, CAM_DIST, ZOOM_MIN, ZOOM_MAX, PAN_SPEED } from '../constants'
import type { GameContext } from '../context'
import type { GameSystems } from '../systems'

/** Pan/zoom/rotate rig for the orthographic camera. Target is a ground point. */
export class IsoCameraSystem {
  private readonly target = new THREE.Vector3()
  private yaw = ISO_YAW
  private readonly offset = new THREE.Vector3()

  constructor(private ctx: GameContext, private sys: GameSystems) {}

  /** Recompute camera position from target + yaw + fixed iso pitch. */
  private apply() {
    const r = Math.cos(ISO_PITCH) * CAM_DIST
    this.offset.set(Math.sin(this.yaw) * r, Math.sin(ISO_PITCH) * CAM_DIST, Math.cos(this.yaw) * r)
    this.ctx.camera.position.copy(this.target).add(this.offset)
    this.ctx.camera.lookAt(this.target)
  }

  panBy(dx: number, dz: number) {
    // pan in screen-aligned ground axes (rotate the input by yaw)
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw)
    this.target.x += (dx * c - dz * s) * PAN_SPEED
    this.target.z += (dx * s + dz * c) * PAN_SPEED
    this.apply()
  }

  /** Wheel delta -> change frustum size (true ortho zoom, not dolly). */
  zoomBy(delta: number) {
    this.ctx.zoom = THREE.MathUtils.clamp(this.ctx.zoom + delta, ZOOM_MIN, ZOOM_MAX)
    this.resize() // rebuild frustum from new zoom
  }

  /** Snap-rotate 90° (keeps the iso look; classic tactics camera). */
  rotate(dir: 1 | -1) {
    this.yaw += (dir * Math.PI) / 2
    this.apply()
  }

  resize() {
    const cam = this.ctx.camera as THREE.OrthographicCamera
    const aspect = this.ctx.container.clientWidth / this.ctx.container.clientHeight
    const h = this.ctx.zoom
    cam.left = -h * aspect; cam.right = h * aspect; cam.top = h; cam.bottom = -h
    cam.updateProjectionMatrix()
  }
}
```

Add to `GameContext` (alongside the FPS fields): `zoom = 20`, `grid!: TileGrid`,
`hoverTile: Tile | null = null`, `selectedTile: Tile | null = null`. The camera
is `OrthographicCamera` not `PerspectiveCamera`.

## Click-to-select / move (InputSystem)

```ts
// systems/InputSystem.ts (pointer handlers — calls siblings via this.sys)
onPointerMove(e: PointerEvent) {
  this.ctx.hoverTile = screenToTile(
    e.clientX, e.clientY, this.ctx.renderer.domElement,
    this.ctx.camera, this.ctx.raycaster, this.ctx.grid,
  )
}

onClick(e: PointerEvent) {
  const t = screenToTile(e.clientX, e.clientY, this.ctx.renderer.domElement,
    this.ctx.camera, this.ctx.raycaster, this.ctx.grid)
  if (!t) return
  if (!this.ctx.selectedTile) { this.ctx.selectedTile = t; return }
  // second click = issue a move order from selected -> target
  const path = findPath(this.ctx.grid, this.ctx.selectedTile, t)
  if (path) this.sys.units.orderMove(path) // delegate to the entity system
}
```

## A* pathfinding

Pure function over the grid — no Three.js, no system deps, trivially testable
(see **playwright-game-testing** for unit-testing pure helpers). 4-neighbour by
default; add diagonals only if you also forbid corner-cutting.

```ts
// grid/pathfinding.ts
import type { TileGrid, Tile } from './TileGrid'

const key = (tx: number, tz: number) => tx * 10000 + tz
const NEI = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const

export function findPath(grid: TileGrid, start: Tile, goal: Tile): Tile[] | null {
  if (!grid.walkable(goal.tx, goal.tz)) return null
  const h = (a: Tile) => Math.abs(a.tx - goal.tx) + Math.abs(a.tz - goal.tz) // Manhattan
  const open: Tile[] = [start]
  const came = new Map<number, number>()
  const g = new Map<number, number>([[key(start.tx, start.tz), 0]])

  while (open.length) {
    // pop lowest f (linear scan is fine for small boards; use a heap if >~50x50)
    let bi = 0
    for (let i = 1; i < open.length; i++)
      if (g.get(key(open[i].tx, open[i].tz))! + h(open[i]) < g.get(key(open[bi].tx, open[bi].tz))! + h(open[bi])) bi = i
    const cur = open.splice(bi, 1)[0]
    if (cur.tx === goal.tx && cur.tz === goal.tz) return reconstruct(came, cur)

    for (const [dx, dz] of NEI) {
      const nx = cur.tx + dx, nz = cur.tz + dz
      if (!grid.walkable(nx, nz)) continue
      const ng = g.get(key(cur.tx, cur.tz))! + 1
      const nk = key(nx, nz)
      if (ng < (g.get(nk) ?? Infinity)) {
        came.set(nk, key(cur.tx, cur.tz))
        g.set(nk, ng)
        if (!open.some((o) => o.tx === nx && o.tz === nz)) open.push({ tx: nx, tz: nz })
      }
    }
  }
  return null
}

function reconstruct(came: Map<number, number>, end: Tile): Tile[] {
  const path = [end]
  let k = came.get(key(end.tx, end.tz))
  while (k !== undefined) {
    path.unshift({ tx: Math.floor(k / 10000), tz: k % 10000 })
    k = came.get(k)
  }
  return path
}
```

## Depth / draw order

Orthographic + a real `DirectionalLight` with `shadowMap` (copy the FPS
`setupScene` sun) gives correct occlusion *for free* — the depth buffer sorts
everything, no manual painter's-algorithm sorting like classic 2D iso. The only
gotchas:

- **Transparent overlays** (hover/selection highlight quads laid on the ground)
  z-fight with the floor. Lift them a hair (`y += 0.02`) and set
  `material.depthWrite = false` + `polygonOffset` so they never fight.
- **Sprites/labels** that must always face the camera: use `THREE.Sprite` or
  billboard them in the update loop; they ignore depth ordering by nature.
- Tune the directional-light shadow frustum (`shadow.camera.left/right/...`) to
  tightly wrap the board, exactly as `RenderSystem.setupScene` does — too wide
  and shadows get blocky.

## Do

- Keep tile math in `TileGrid` / `iso.ts` as **pure functions**; systems call them.
- Center the board on the origin so pan/zoom/rotate stays symmetric.
- Raycast the **ground plane** for `screenToTile`, not meshes — exact and cheap.
- Store levels as **data** in `data/levels.ts` (mirror `data/maps.ts`).
- Zoom by changing the ortho **frustum size**, not by dollying the camera.
- Reuse `ctx.raycaster` and pass `out` vectors to avoid per-frame allocation.
- Animate unit movement along the A* `Tile[]` in an entity system; the grid only
  knows logical tiles, the system interpolates world positions over time.

## Don't

- Don't use a `PerspectiveCamera` — perspective breaks iso tile uniformity.
- Don't fake depth with manual sprite sorting; let the z-buffer + ortho do it.
- Don't hardcode level layout in gameplay code — it lives in `data/levels.ts`.
- Don't store world positions as the source of truth; tiles are canonical,
  world coords are derived via `tileToWorld`.
- Don't dolly to zoom (changes apparent angle); resize the frustum instead.
- Don't raycast hundreds of tile meshes every pointermove — one plane hit + a
  `worldToTile` floor is O(1).

## Common bugs

- **Off-by-half tile picks.** `worldToTile` must `Math.round` (tile *centers* sit
  on grid points), not `Math.floor`, given the centered origin above. Mixing the
  two shifts every pick by half a tile.
- **Highlight z-fighting.** Ground overlays at exactly `y=0` flicker against the
  floor. Lift `y` slightly and disable `depthWrite`.
- **Zoom warps the view.** If zooming changes the iso angle, you're dollying.
  Ortho zoom = adjust `left/right/top/bottom`, never `camera.position`.
- **Stretched tiles on resize.** Recompute `left/right` from the live aspect in
  `resize()` (and call it on `window` resize *and* after `zoomBy`), or tiles
  squash when the window changes shape.
- **A* returns reversed/empty path.** Reconstruct from `goal` back to `start` and
  `unshift`; guard `findPath` when goal is blocked or unreachable (returns null).
- **Rotate breaks panning.** Pan input must be rotated by the current `yaw` (see
  `panBy`) or dragging feels wrong after a 90° rotate.

## Worked example: click a tile, walk a unit there

1. `InputSystem.onPointerMove` -> `ctx.hoverTile = screenToTile(...)`; render a
   highlight quad at `grid.tileToWorld(hover.tx, hover.tz)`.
2. First `onClick` selects a unit's tile (`ctx.selectedTile`).
3. Second `onClick` computes `findPath(grid, selectedTile, target)` and hands the
   `Tile[]` to `UnitsSystem.orderMove`.
4. `UnitsSystem.update(dt)` lerps the unit mesh between consecutive tiles'
   `tileToWorld` positions; on arrival at the final tile it clears the order and
   `HudSystem` pushes the new selection state to React.

See `reference/IsoCameraSystem.ts`, `reference/TileGrid.ts`, and
`reference/iso.ts` for drop-in starting points.

## Related skills

- **shipshit-engine** — the `GameContext` + `GameSystems` architecture this builds on.
- **fps-arena** — the perspective/pointer-lock counterpart; contrast its camera setup.
- **tower-defense-3d** — also grid-based; shares this tile model + A* for creep paths.
- **partykit-multiplayer** — sync tile-based orders/state for multiplayer iso games.
- **game-asset-pipeline** — the `assets.json` manifest for tile/unit models.
- **playwright-game-testing** — unit-test the pure `TileGrid` / `pathfinding` helpers.
- **vibe-game-workflow** — how to drive all of this with Claude Code + Codex.
