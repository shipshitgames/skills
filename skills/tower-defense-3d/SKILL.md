---
name: tower-defense-3d
description: Build a 3D tower-defense game (creeps walk a lane, you place towers on a grid to stop them) on the Ship Shit engine, matching the FPS's neon-arena look. Use when adding a TD mode/game with an RTS-style angled or orthographic camera (NOT pointer-lock), raycast click-to-place on a grid, gold/build economy, waypoint creep pathing, and a wave director.
license: MIT
metadata:
  version: "0.1.0"
  tags: "tower-defense, three.js, strategy, game-dev"
  author: Ship Shit Games
---

# tower-defense-3d

A tower-defense game on the studio engine. Same imperative Three.js, same `GameContext` + `GameSystems` registry, same data-driven content, same neon-arena visuals as the FPS — but the camera is a fixed RTS view (no pointer lock), input is mouse picking on a grid, and the "enemy" is a creep that walks a lane toward your base.

TD is the **same engine, different mode**. Reuse `ArenaSystem`/maps for the neon floor + walls, reuse `ProjectilesSystem` shape for tower shots, reuse the PvE director shape for the wave spawner, reuse the HUD push pattern. Read `shipshit-engine` first for the registry/context rules; this skill only describes the TD-specific deltas.

## What changes vs the FPS (and what stays)

| Concern | FPS | TD |
| --- | --- | --- |
| Camera | `PerspectiveCamera` + `PointerLockControls` (first-person) | fixed angled `PerspectiveCamera` or `OrthographicCamera`, no controls lib |
| Input | WASD + lock, `screenCenter` raycast | mouse-move hover + click, NDC raycast onto a ground plane / grid |
| "enemy" | `Enemy` chasing the camera | creep following a fixed waypoint lane |
| Director | `PveDirectorSystem` (waves of chasers) | `WaveDirectorSystem` (same shape: timers, counts, `announce`) |
| Win/Lose | player HP hits 0 | base HP hits 0 (lose) / all waves cleared (win) |
| Economy | ammo/reserve | gold; spend to place towers in a React build menu |
| Projectiles | enemy shots at player | tower shots at creeps (same pool shape) |
| Arena, maps, net, assets, HUD push | — | **unchanged conventions** |

## File layout (game-local; promote shared bits to `@shipshitgames/engine` later)

```
src/game/
  Game.ts                  # orchestrator: build ctx + sys, run rAF loop, public API
  context.ts               # GameContext (TD fields: gold, baseHealth, grid, creeps…)
  systems.ts               # GameSystems registry (type-only imports)
  constants.ts             # numeric tunables (GRID_CELL, BASE_HEALTH, START_GOLD…)
  data/
    maps.ts                # ArenaMap + per-map LANE waypoints + buildable cells
    towers.ts              # tower table (cost, range, fireRate, damage, projectile)
    creeps.ts              # creep table (health, speed, bounty, scale, color)
    waves.ts               # WaveConfig[] (which creeps, how many, spacing)
  render/
    RenderSystem.ts        # renderer/scene/camera (RTS camera here)
    ArenaSystem.ts         # REUSED from FPS (floor/walls/theme/obstacles)
  entities/
    Creep.ts               # pooled creep entity (mesh group + waypoint follow)
    TowerSystem.ts         # place/sell towers, target query, fire
    ProjectilesSystem.ts   # REUSED shape: tower shots fly + hit creeps
    FxSystem.ts            # death pops, build puffs (reuse FPS FxSystem)
  modes/
    WaveDirectorSystem.ts  # spawn creeps wave-by-wave (PveDirector shape)
    GameOverSystem.ts      # win/lose, restart, return to menu (reuse FPS)
  systems/
    GridSystem.ts          # the grid: world<->cell, occupancy, hover/place picking
    InputSystem.ts         # mouse picking, build-tool selection, NO pointer lock
    HudSystem.ts           # push HUDState (gold, baseHealth, wave, build menu)
```

## GameContext additions

Anything two systems touch lives on `ctx` (see `games/scourge-survivors/src/game/context.ts`). For TD, the camera is plain (no `controls`), and we add the economy + grid + creep pool. Keep per-system state (wave counters, tower list) private on the system.

```ts
// context.ts (TD-specific fields; rest mirrors the FPS context)
export class GameContext {
  constructor(
    public readonly container: HTMLElement,
    public readonly listener: StateListener,
  ) {}

  renderer!: THREE.WebGLRenderer
  scene!: THREE.Scene
  camera!: THREE.PerspectiveCamera   // RTS camera; NO PointerLockControls
  accentA!: THREE.PointLight
  accentB!: THREE.PointLight
  readonly clock = new THREE.Clock()
  readonly raycaster = new THREE.Raycaster()
  readonly pointer = new THREE.Vector2() // mouse in NDC (-1..1); set by InputSystem
  raf = 0
  disposed = false

  // world collision / picking
  solidMeshes: THREE.Mesh[] = []      // arena solids (ArenaSystem owns these)
  obstacleBoxes: THREE.Box3[] = []
  groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0) // y=0 pick plane
  creeps: Creep[] = []                // pooled (holds dead entries), like ctx.enemies

  // arena / map
  currentMap: ArenaMap = getMap(DEFAULT_MAP_ID)

  // economy + base
  gold = START_GOLD
  baseHealth = BASE_HEALTH
  selectedTool: TowerId | null = null // current build tool (null = inspect/none)

  status: GameStatus = 'building'     // 'building' | 'wave' | 'paused' | 'gameover'
  outcome: 'win' | 'dead' | null = null
  time = 0

  readonly _v = new THREE.Vector3()   // shared scratch
  get aliveCount() { let n = 0; for (const c of this.creeps) if (c.alive) n++; return n }
}
```

> The grid's occupancy map and tower list belong to `GridSystem`/`TowerSystem` respectively, not `ctx` — only `creeps`, `gold`, `baseHealth`, and the pick plane are genuinely shared.

## Data-driven content

Numeric knobs in `constants.ts`; content tables in `data/*.ts`. Gameplay never hardcodes a tower stat or a lane.

```ts
// constants.ts
export const GRID_CELL = 4          // world units per cell (matches FPS box scale)
export const GRID_HALF = 10         // 20x20 cells over the 80x80 ARENA footprint
export const BASE_HEALTH = 20       // creeps that reach the exit cost 1 each (or more)
export const START_GOLD = 120
export const SELL_REFUND = 0.6      // fraction of total spend refunded on sell
export const FIRST_WAVE_DELAY = 6   // seconds of build time before wave 1
export const WAVE_BREAK = 8         // build time between waves
export const CREEP_SPAWN_INTERVAL = 0.8

// data/towers.ts
export type TowerId = 'arrow' | 'frost' | 'cannon'
export interface TowerSpec {
  id: TowerId
  name: string
  icon: string          // emoji for the build menu card
  cost: number
  range: number         // world units
  fireRate: number      // shots / second
  damage: number
  projectileSpeed: number
  color: number         // neon trim / projectile tint
  slow?: number         // 0..1 movement multiplier applied on hit (frost)
}
export const TOWERS: Record<TowerId, TowerSpec> = {
  arrow:  { id: 'arrow',  name: 'Arrow',  icon: '🏹', cost: 40,  range: 14, fireRate: 2.0, damage: 18, projectileSpeed: 36, color: 0x46e0c8 },
  frost:  { id: 'frost',  name: 'Frost',  icon: '❄️', cost: 60,  range: 11, fireRate: 1.2, damage: 8,  projectileSpeed: 30, color: 0x7fe8ff, slow: 0.45 },
  cannon: { id: 'cannon', name: 'Cannon', icon: '💥', cost: 90,  range: 16, fireRate: 0.6, damage: 55, projectileSpeed: 26, color: 0xff8a3c },
}
export const TOWER_ORDER: TowerId[] = ['arrow', 'frost', 'cannon']
```

Lanes live on the map (reusing the FPS `ArenaMap` shape — same theme/obstacles fields, plus a waypoint path and which cells are buildable). See `games/scourge-survivors/src/game/data/maps.ts` for the theme/obstacle structure you extend.

```ts
// data/maps.ts (extend the FPS ArenaMap)
export interface TdMap extends ArenaMap {
  /** Creep path in world space: spawn -> ...turns... -> base/exit. */
  lane: { x: number; z: number }[]
  /** Base/exit cell where reaching creeps damage the player. */
  exit: { x: number; z: number }
}
```

## GridSystem — world<->cell, occupancy, picking

The grid is centered on the arena. Cells along the lane (and the exit) are NOT buildable. Occupancy is a `Set` of `"col,row"` keys so place/sell is O(1).

```ts
// systems/GridSystem.ts
import * as THREE from 'three'
import type { GameContext } from '../context'
import type { GameSystems } from '../systems'
import { GRID_CELL, GRID_HALF } from '../constants'

export interface Cell { col: number; row: number }

/** The build grid: maps world<->cell, tracks blocked (lane) + occupied (tower) cells,
 *  and owns the hover highlight quad. */
export class GridSystem {
  private occupied = new Set<string>()  // cells with a tower
  private blocked = new Set<string>()   // lane + exit cells, never buildable
  private highlight!: THREE.Mesh

  constructor(private ctx: GameContext, private sys: GameSystems) {}

  /** Build the hover quad + mark lane cells blocked for the current map. */
  setupGrid() {
    const geo = new THREE.PlaneGeometry(GRID_CELL * 0.92, GRID_CELL * 0.92)
    const mat = new THREE.MeshBasicMaterial({ color: 0x46e0c8, transparent: true, opacity: 0.3, depthWrite: false })
    this.highlight = new THREE.Mesh(geo, mat)
    this.highlight.rotation.x = -Math.PI / 2
    this.highlight.position.y = 0.02
    this.highlight.visible = false
    this.ctx.scene.add(this.highlight)
    this.markLane()
  }

  /** Rasterize the map's lane polyline into blocked cells (+ the exit). */
  markLane() {
    this.occupied.clear()
    this.blocked.clear()
    const map = this.ctx.currentMap as TdMap
    const pts = map.lane
    for (let i = 0; i < pts.length - 1; i++) {
      const a = this.worldToCell(pts[i].x, pts[i].z)
      const b = this.worldToCell(pts[i + 1].x, pts[i + 1].z)
      const steps = Math.max(Math.abs(b.col - a.col), Math.abs(b.row - a.row))
      for (let s = 0; s <= steps; s++) {
        const c = Math.round(a.col + ((b.col - a.col) * s) / Math.max(1, steps))
        const r = Math.round(a.row + ((b.row - a.row) * s) / Math.max(1, steps))
        this.blocked.add(this.key(c, r))
      }
    }
    const ex = this.worldToCell(map.exit.x, map.exit.z)
    this.blocked.add(this.key(ex.col, ex.row))
  }

  key(col: number, row: number) { return `${col},${row}` }

  worldToCell(x: number, z: number): Cell {
    return { col: Math.floor(x / GRID_CELL + GRID_HALF), row: Math.floor(z / GRID_CELL + GRID_HALF) }
  }

  /** Center of a cell in world space (towers sit here). */
  cellToWorld(c: Cell): THREE.Vector3 {
    return new THREE.Vector3((c.col - GRID_HALF + 0.5) * GRID_CELL, 0, (c.row - GRID_HALF + 0.5) * GRID_CELL)
  }

  inBounds(c: Cell) { return c.col >= 0 && c.col < GRID_HALF * 2 && c.row >= 0 && c.row < GRID_HALF * 2 }
  canBuild(c: Cell) { return this.inBounds(c) && !this.blocked.has(this.key(c.col, c.row)) && !this.occupied.has(this.key(c.col, c.row)) }
  occupy(c: Cell) { this.occupied.add(this.key(c.col, c.row)) }
  free(c: Cell) { this.occupied.delete(this.key(c.col, c.row)) }

  /** Raycast the current mouse ray onto the ground plane and snap to a cell. */
  pickCell(): Cell | null {
    this.ctx.raycaster.setFromCamera(this.ctx.pointer, this.ctx.camera)
    const hit = this.ctx.raycaster.ray.intersectPlane(this.ctx.groundPlane, this.ctx._v)
    if (!hit) return null
    const c = this.worldToCell(hit.x, hit.z)
    return this.inBounds(c) ? c : null
  }

  /** Update the hover highlight (green = buildable, red = blocked). Call each frame
   *  while a build tool is selected. */
  updateHover() {
    if (!this.ctx.selectedTool) { this.highlight.visible = false; return }
    const c = this.pickCell()
    if (!c) { this.highlight.visible = false; return }
    const p = this.cellToWorld(c)
    this.highlight.position.set(p.x, 0.02, p.z)
    this.highlight.visible = true
    ;(this.highlight.material as THREE.MeshBasicMaterial).color.setHex(this.canBuild(c) ? 0x46e0c8 : 0xff3b6b)
  }
}
```

## TowerSystem — place, target, fire (projectiles reuse the FPS pool shape)

Towers are pooled by an array. Each frame: tick fire cooldowns, run a range query against `ctx.creeps`, fire a projectile at the nearest in-range creep. Placement spends `gold` and occupies the cell.

```ts
// entities/TowerSystem.ts
import * as THREE from 'three'
import type { GameContext } from '../context'
import type { GameSystems } from '../systems'
import type { Cell } from '../systems/GridSystem'
import { TOWERS, type TowerId } from '../data/towers'
import { SELL_REFUND } from '../constants'

interface Tower {
  spec: typeof TOWERS[TowerId]
  cell: Cell
  group: THREE.Group
  cooldown: number  // seconds until next shot
  spent: number     // total gold sunk (for sell refund)
}

export class TowerSystem {
  towers: Tower[] = []

  constructor(private ctx: GameContext, private sys: GameSystems) {}

  /** Try to place the selected tool at the picked cell. Returns true on success. */
  tryPlace(id: TowerId, cell: Cell): boolean {
    const spec = TOWERS[id]
    if (!this.sys.grid.canBuild(cell)) return false
    if (this.ctx.gold < spec.cost) { this.sys.hud.showToast('NOT ENOUGH GOLD'); return false }
    this.ctx.gold -= spec.cost
    const group = this.buildTowerMesh(spec)
    const p = this.sys.grid.cellToWorld(cell)
    group.position.set(p.x, 0, p.z)
    this.ctx.scene.add(group)
    this.sys.grid.occupy(cell)
    this.sys.fx.spawnDeathPop(p.clone().setY(0.5), spec.color, 0.6) // build puff
    this.towers.push({ spec, cell, group, cooldown: 0, spent: spec.cost })
    this.sys.hud.emit()
    return true
  }

  /** Sell the tower at a cell (refund a fraction, free the cell). */
  sellAt(cell: Cell) {
    const i = this.towers.findIndex((t) => t.cell.col === cell.col && t.cell.row === cell.row)
    if (i < 0) return
    const t = this.towers[i]
    this.ctx.gold += Math.floor(t.spent * SELL_REFUND)
    this.ctx.scene.remove(t.group)
    this.sys.grid.free(cell)
    this.towers.splice(i, 1)
    this.sys.hud.emit()
  }

  updateTowers(delta: number) {
    for (const t of this.towers) {
      t.cooldown -= delta
      if (t.cooldown > 0) continue
      const target = this.acquireTarget(t)
      if (!target) continue
      t.cooldown = 1 / t.spec.fireRate
      this.faceTarget(t, target.position)
      this.sys.projectiles.spawnTowerShot({
        origin: t.group.position.clone().setY(1.4),
        target,                 // homing-ish: ProjectilesSystem leads/tracks the creep
        speed: t.spec.projectileSpeed,
        damage: t.spec.damage,
        color: t.spec.color,
        slow: t.spec.slow,
      })
    }
  }

  /** Nearest live creep within range (range^2 compare; no sqrt). Prefer the creep
   *  furthest along the lane so towers focus leaks, not the back of the pack. */
  private acquireTarget(t: Tower): Creep | null {
    const r2 = t.spec.range * t.spec.range
    let best: Creep | null = null
    let bestProgress = -1
    for (const c of this.ctx.creeps) {
      if (!c.alive) continue
      if (t.group.position.distanceToSquared(c.position) > r2) continue
      if (c.laneProgress > bestProgress) { bestProgress = c.laneProgress; best = c }
    }
    return best
  }

  private faceTarget(t: Tower, target: THREE.Vector3) {
    const head = t.group.children[1] // [0]=base, [1]=turret head
    if (head) head.rotation.y = Math.atan2(target.x - t.group.position.x, target.z - t.group.position.z)
  }

  private buildTowerMesh(spec: typeof TOWERS[TowerId]): THREE.Group {
    const g = new THREE.Group()
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x2a3550, roughness: 0.7, metalness: 0.3 })
    const neonMat = new THREE.MeshStandardMaterial({ color: spec.color, emissive: spec.color, emissiveIntensity: 1.3 })
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 1, 8), baseMat)
    base.position.y = 0.5; base.castShadow = true
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 1.6), neonMat)
    head.position.y = 1.4; head.castShadow = true
    g.add(base, head)
    return g
  }

  clearTowers() {
    for (const t of this.towers) this.ctx.scene.remove(t.group)
    this.towers = []
  }
}
```

`ProjectilesSystem` is the FPS pool with a `spawnTowerShot` entry that homes toward a creep instead of flying a straight enemy shot. The fly/expire/hit loop is identical to `games/scourge-survivors/src/game/entities/ProjectilesSystem.ts` — on hit, call `creep.damage()` (and apply `slow`) instead of `player.damagePlayer()`.

## CreepPathSystem / Creep — waypoint lane following

Creeps follow the map's `lane` polyline. Each creep tracks `laneProgress` (a float index into the path) so towers can target the leader. Reaching the exit damages the base and despawns the creep. Pool like `ctx.enemies`.

```ts
// entities/Creep.ts
import * as THREE from 'three'

export interface CreepSpec { health: number; speed: number; bounty: number; scale: number; color: number }

export class Creep {
  group = new THREE.Group()
  position = this.group.position
  alive = false
  health = 1
  maxHealth = 1
  speed = 3
  bounty = 5
  slowTimer = 0
  slowFactor = 1
  laneProgress = 0          // float index into the lane (0 = spawn)
  private lane: { x: number; z: number }[] = []
  private segIndex = 0
  private mesh: THREE.Mesh

  constructor() {
    this.mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.7, 0),
      new THREE.MeshStandardMaterial({ color: 0xff3b6b, emissive: 0xff3b6b, emissiveIntensity: 0.6 }),
    )
    this.mesh.castShadow = true
    this.group.add(this.mesh)
  }

  spawn(spec: CreepSpec, lane: { x: number; z: number }[]) {
    this.lane = lane
    this.segIndex = 0
    this.laneProgress = 0
    this.health = this.maxHealth = spec.health
    this.speed = spec.speed
    this.bounty = spec.bounty
    this.slowTimer = 0
    this.slowFactor = 1
    this.group.scale.setScalar(spec.scale)
    ;(this.mesh.material as THREE.MeshStandardMaterial).color.setHex(spec.color)
    this.position.set(lane[0].x, 0.7, lane[0].z)
    this.group.visible = true
    this.alive = true
  }

  /** Advance along the lane. Returns 'leak' when it reaches the exit, else null. */
  update(delta: number): 'leak' | null {
    if (this.slowTimer > 0) { this.slowTimer -= delta; if (this.slowTimer <= 0) this.slowFactor = 1 }
    const next = this.lane[this.segIndex + 1]
    if (!next) return 'leak'
    const dx = next.x - this.position.x
    const dz = next.z - this.position.z
    const dist = Math.hypot(dx, dz)
    const step = this.speed * this.slowFactor * delta
    if (step >= dist) {
      this.position.set(next.x, 0.7, next.z)
      this.segIndex++
      this.laneProgress = this.segIndex
    } else {
      this.position.x += (dx / dist) * step
      this.position.z += (dz / dist) * step
      this.laneProgress = this.segIndex + (1 - (dist - step) / Math.max(0.0001, dist))
      this.group.rotation.y = Math.atan2(dx, dz)
    }
    return null
  }

  applySlow(factor: number, seconds = 1.2) { this.slowFactor = Math.min(this.slowFactor, factor); this.slowTimer = seconds }
  damage(amount: number) { this.health -= amount; if (this.health <= 0) this.kill() }
  kill() { this.alive = false; this.group.visible = false }
}
```

The "CreepPathSystem" responsibility (advancing creeps, handling leaks, awarding bounty) lives in the director's per-frame tick, mirroring how `PveDirectorSystem.updateEnemies` drives `Enemy.update`:

```ts
// in WaveDirectorSystem
updateCreeps(delta: number) {
  for (const c of this.ctx.creeps) {
    if (!c.alive) continue
    const res = c.update(delta)
    if (res === 'leak') {
      c.kill()
      this.ctx.baseHealth -= 1
      this.sys.fx.spawnDeathPop(c.position.clone(), 0xff3b6b, 1)
      if (this.ctx.baseHealth <= 0) this.sys.gameOver.gameOver('dead')
    }
  }
}

onCreepDeath(c: Creep) {     // called by ProjectilesSystem when health hits 0
  this.ctx.gold += c.bounty
  this.sys.fx.spawnDeathPop(c.position.clone(), 0xffd166, 0.9)
  this.killsThisWave++
  this.sys.hud.emit()
}
```

## WaveDirectorSystem — same shape as PveDirectorSystem

Copy the timer/counter rhythm from `games/scourge-survivors/src/game/modes/PveDirectorSystem.ts` (`waveActive`, `waveBreakTimer`, `spawnTimer`, `spawnedThisWave`, `completeWave`). The differences: spawn `Creep`s along the lane (not chasers near the player), and between waves the player is in `status: 'building'` (gold + build menu active), not fighting.

```ts
// modes/WaveDirectorSystem.ts (abridged — mirrors PveDirectorSystem)
import { WAVES, TOTAL_WAVES, FIRST_WAVE_DELAY, WAVE_BREAK, CREEP_SPAWN_INTERVAL } from '../constants'

export class WaveDirectorSystem {
  waveIndex = 0
  waveActive = false
  waveBreakTimer = FIRST_WAVE_DELAY
  spawnTimer = 0
  spawnedThisWave = 0
  killsThisWave = 0

  constructor(private ctx: GameContext, private sys: GameSystems) {}

  updateWaves(delta: number) {
    this.updateCreeps(delta)
    if (!this.waveActive) {
      this.ctx.status = 'building'            // build phase between waves
      this.waveBreakTimer -= delta
      if (this.waveBreakTimer <= 0) this.startWave()
      return
    }
    const wave = WAVES[this.waveIndex]
    this.spawnTimer -= delta
    if (this.spawnedThisWave < wave.count && this.spawnTimer <= 0) {
      this.spawnCreep(wave)
      this.spawnedThisWave++
      this.spawnTimer = CREEP_SPAWN_INTERVAL
    }
    // wave ends when every spawned creep is dead or has leaked
    if (this.spawnedThisWave >= wave.count && this.ctx.aliveCount === 0) this.completeWave()
  }

  startWave() {
    this.waveActive = true
    this.ctx.status = 'wave'
    this.spawnedThisWave = 0
    this.killsThisWave = 0
    this.spawnTimer = 0
    this.sys.hud.announce(`WAVE ${this.waveIndex + 1}`)
  }

  completeWave() {
    this.waveActive = false
    const cleared = this.waveIndex + 1
    this.waveIndex++
    this.waveBreakTimer = WAVE_BREAK
    if (cleared >= TOTAL_WAVES) { this.sys.gameOver.gameOver('win'); return }
    this.ctx.gold += 25                       // clear bonus
    this.sys.hud.announce(`WAVE ${cleared} CLEARED`)
  }

  spawnCreep(wave: { healthMul: number; speedMul: number }) {
    const c = this.getFreeCreep()
    const map = this.ctx.currentMap as TdMap
    c.spawn({ health: 80 * wave.healthMul, speed: 3 * wave.speedMul, bounty: 6, scale: 1, color: 0xff3b6b }, map.lane)
  }

  getFreeCreep(): Creep {
    let c = this.ctx.creeps.find((x) => !x.alive)
    if (!c) { c = new Creep(); this.ctx.scene.add(c.group); this.ctx.creeps.push(c) }
    return c
  }
  // updateCreeps / onCreepDeath: see CreepPathSystem section above
}
```

## RTS camera (NOT pointer-lock)

`RenderSystem.setupScene` builds the same lighting/fog as the FPS (see `games/scourge-survivors/src/game/render/RenderSystem.ts`) but the camera is a fixed angled perspective looking down at the arena — no `PointerLockControls`. Drop the controls field from `ctx` entirely.

```ts
// render/RenderSystem.ts — TD camera (angled top-down)
this.ctx.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 500)
this.ctx.camera.position.set(0, 64, 58)   // high + behind, looking at center
this.ctx.camera.lookAt(0, 0, 0)
this.ctx.scene.add(this.ctx.camera)
```

For a true RTS feel use an `OrthographicCamera` instead (no perspective foreshortening):

```ts
const d = 50, a = w / h
const cam = new THREE.OrthographicCamera(-d * a, d * a, d, -d, 0.1, 500)
cam.position.set(40, 60, 40); cam.lookAt(0, 0, 0)
// onResize: cam.left = -d*a; cam.right = d*a; cam.updateProjectionMatrix()
```

## InputSystem — mouse picking, build tools, no lock

No `requestPointerLock`. Track the pointer in NDC every `mousemove`; left-click places the selected tower (or inspects), right-click cancels the tool. Number keys select build tools. Hover updates the grid highlight in the loop.

```ts
// systems/InputSystem.ts (TD)
import { TOWER_ORDER } from '../data/towers'

bindEvents() {
  const el = this.ctx.renderer.domElement
  el.addEventListener('mousemove', this.onMouseMove)
  el.addEventListener('mousedown', this.onMouseDown)
  el.addEventListener('contextmenu', this.onContextMenu)
  window.addEventListener('keydown', this.onKeyDown)
  window.addEventListener('resize', this.onResize)
}

onMouseMove = (e: MouseEvent) => {
  const r = this.ctx.renderer.domElement.getBoundingClientRect()
  this.ctx.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
}

onMouseDown = (e: MouseEvent) => {
  if (this.ctx.status === 'paused' || this.ctx.status === 'gameover') return
  const cell = this.sys.grid.pickCell()
  if (!cell) return
  if (e.button === 0 && this.ctx.selectedTool) this.sys.towers.tryPlace(this.ctx.selectedTool, cell)
  else if (e.button === 2) this.ctx.selectedTool = null            // cancel tool
}

onContextMenu = (e: Event) => e.preventDefault()

onKeyDown = (e: KeyboardEvent) => {
  if (e.code === 'Escape') { this.ctx.selectedTool = null; return }
  const n = Number(e.key)
  if (n >= 1 && n <= TOWER_ORDER.length) { this.ctx.selectedTool = TOWER_ORDER[n - 1]; this.sys.hud.emit() }
}
```

The React build menu (Tailwind v4 + Radix/shadcn, see `shipshit-engine` for the shell) calls back into the game's public API to set the tool — e.g. `game.selectTool('cannon')` flips `ctx.selectedTool`. The HUD reads `gold`, `baseHealth`, `wave`, and which towers are affordable from the pushed `HUDState`.

## HUD push

Extend `HUDState` (see `games/scourge-survivors/src/game/types.ts`) with TD fields and push from `HudSystem.emit` exactly as the FPS does — React renders the build menu + base/gold readout from the snapshot. Never let React read the game directly.

```ts
// types.ts additions
export interface HUDState {
  status: GameStatus
  gold: number
  baseHealth: number
  maxBaseHealth: number
  wave: number
  totalWaves: number
  building: boolean              // true between waves (build phase)
  buildTimer: number             // seconds until next wave (for a countdown bar)
  selectedTool: string | null
  towers: { id: string; name: string; icon: string; cost: number; affordable: boolean }[]
  creepsAlive: number
  banner: string; bannerSeq: number
  toast: string; toastSeq: number
  outcome: 'win' | 'dead' | null
}
```

## Game.ts loop wiring

Mirror `games/scourge-survivors/src/game/Game.ts`: construct ctx + every system, then run rAF. Per frame, when `status` is `building` or `wave`, update the world; the director's `updateWaves` already handles both phases.

```ts
private update(delta: number) {
  this.ctx.time += delta
  this.sys.grid.updateHover()
  this.sys.towers.updateTowers(delta)
  this.sys.projectiles.updateProjectiles(delta) // tower shots hit creeps
  this.sys.fx.updateEffects(delta)
  this.sys.waves.updateWaves(delta)              // advances creeps + spawns
}
```

## Do

- Reuse `ArenaSystem` + the `ArenaMap` theme/obstacle shape for the neon floor, walls, fog, and rim lights — the TD board should look exactly like an FPS arena from above.
- Keep all numbers in `constants.ts` and all content (`TOWERS`, `CREEPS`, `WAVES`, `lane`) in `data/*.ts`.
- Use `Set<"col,row">` occupancy in `GridSystem`; do place/sell checks against it (O(1)).
- Pool `creeps` like `ctx.enemies` (reuse dead entries via `getFreeCreep`).
- Target the creep **furthest along the lane** (`laneProgress`), so towers shoot leaks.
- Mark lane + exit cells `blocked` so towers can never wall off the path.
- Push every UI value through `HUDState`; let React (build menu, gold/base readout) render from it.
- Match the FPS `ProjectilesSystem` fly/expire/hit loop; just swap the hit target to `Creep`.

## Don't

- Don't import `PointerLockControls` or call `requestPointerLock` — TD is a mouse-pick RTS view.
- Don't store the tower list or grid occupancy on `ctx` — they belong to their owning systems. Only genuinely shared state (`creeps`, `gold`, `baseHealth`, `groundPlane`, `pointer`) goes on `ctx`.
- Don't hardcode tower stats, creep stats, or lane coordinates in system logic — read the data tables.
- Don't raycast against scene meshes to find the build cell — raycast the `groundPlane` and snap to a cell (cheaper + deterministic).
- Don't let React read or mutate the game directly; go through the public API and the `StateListener` snapshot.
- Don't use runtime imports in `systems.ts` — type-only, to avoid import cycles (see `shipshit-engine`).

## Common bugs

- **Pointer NDC ignores the canvas offset.** Always subtract `getBoundingClientRect()` left/top before normalizing, or hover snaps to the wrong cell when the canvas isn't full-bleed.
- **Floor/cell mismatch.** `worldToCell` and `cellToWorld` must use the same `GRID_CELL`/`GRID_HALF`; if towers visually sit between cells, your two functions disagree (use `Math.floor` one way, `+0.5` center the other — as shown).
- **Towers walling off the lane.** Forgetting to add lane cells to `blocked` lets players seal the path; creeps then stop at a wall forever. Rasterize the whole polyline, not just the waypoint cells.
- **Targeting the back of the pack.** Picking the *nearest* creep lets leakers slip through while towers chew the rear. Sort by `laneProgress` descending.
- **Wave never completes.** `completeWave` must trigger when `spawnedThisWave >= count && aliveCount === 0` — count both kills and leaks, or a leaked creep leaves the wave hanging.
- **Orthographic resize.** On `OrthographicCamera` you must recompute `left/right/top/bottom` and `updateProjectionMatrix()` on resize; only updating `renderer.setSize` skews the picture.
- **Disposing on rebuild.** When switching maps, call `grid.markLane()` again and `towers.clearTowers()` — stale occupancy/blocked sets leak into the new board.

## Worked example: place a Cannon and watch it fire

1. Player presses `3` → `InputSystem.onKeyDown` sets `ctx.selectedTool = 'cannon'`; `HudSystem.emit` marks the Cannon card selected.
2. Mouse moves → `GridSystem.updateHover` shows a green quad on buildable cells, red on lane/occupied.
3. Left-click on a green cell → `TowerSystem.tryPlace('cannon', cell)` checks `grid.canBuild` + `gold >= 90`, spends gold, adds the turret mesh, `grid.occupy(cell)`, pushes HUD.
4. Wave starts (`WaveDirectorSystem.startWave`, `status='wave'`); `spawnCreep` drops creeps at `lane[0]`.
5. Each frame `TowerSystem.updateTowers` finds the in-range creep with the highest `laneProgress`, fires `ProjectilesSystem.spawnTowerShot`.
6. The shot tracks the creep; on hit it calls `creep.damage(55)`; at 0 HP `WaveDirectorSystem.onCreepDeath` awards `bounty` gold.
7. Any creep reaching `map.exit` → `baseHealth -= 1`; at 0 → `GameOverSystem.gameOver('dead')`. All waves cleared → `gameOver('win')`.

## Related skills

- `shipshit-engine` — the GameContext/GameSystems registry, loop, and StateListener conventions this skill builds on.
- `fps-arena` — the canonical FPS reference for the arena look, projectiles, and PvE director shape reused here.
- `partykit-multiplayer` — add co-op TD (shared gold/base, synced creeps + tower placements).
- `game-asset-pipeline` — the `assets.json` manifest + loader for tower/creep models and textures.
- `isometric-3d` — a sibling fixed-camera mode; shares the mouse-pick-onto-ground-plane pattern.
- `playwright-game-testing` — drive clicks on the build grid and assert gold/base/wave HUD values.
- `vibe-game-workflow` — the studio loop for vibe-coding a new game like this with Claude Code + Codex.
