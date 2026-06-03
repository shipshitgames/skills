import * as THREE from 'three'

// Standalone reference. In a real game, TILE_SIZE comes from constants.ts and
// TileDef/IsoLevel from data/levels.ts. Inlined here so the file runs alone.
const TILE_SIZE = 1

export interface TileDef {
  h?: number // terrain height in tiles (0 = floor)
  blocked?: boolean // impassable to movement + building
  terrain?: 'floor' | 'water' | 'rock'
}

export interface IsoLevel {
  id: string
  name: string
  cols: number
  rows: number
  tiles: (TileDef | undefined)[][] // row-major: tiles[tz][tx]
  spawn: { tx: number; tz: number }
}

export interface Tile { tx: number; tz: number }

/**
 * Flat XZ tile grid centered on the origin. Tiles are the source of truth;
 * world positions are derived. tile(0,0) center sits at (-halfW, 0, -halfH).
 */
export class TileGrid {
  readonly cols: number
  readonly rows: number
  private readonly originX: number
  private readonly originZ: number
  private readonly defs: (TileDef | undefined)[][]

  constructor(level: IsoLevel) {
    this.cols = level.cols
    this.rows = level.rows
    this.defs = level.tiles
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

  walkable(tx: number, tz: number) {
    if (!this.inBounds(tx, tz)) return false
    return !this.get(tx, tz)?.blocked
  }

  /** Tile center -> world position. Pass `out` to avoid allocation in loops. */
  tileToWorld(tx: number, tz: number, out = new THREE.Vector3()) {
    return out.set(
      this.originX + tx * TILE_SIZE,
      this.height(tx, tz) * TILE_SIZE,
      this.originZ + tz * TILE_SIZE,
    )
  }

  /** World position -> nearest tile center. Round (not floor) for centered grid. */
  worldToTile(wx: number, wz: number): Tile {
    return {
      tx: Math.round((wx - this.originX) / TILE_SIZE),
      tz: Math.round((wz - this.originZ) / TILE_SIZE),
    }
  }
}
