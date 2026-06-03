import type { TileGrid, Tile } from './TileGrid'

// A* over the tile grid. Pure — no Three.js, no system deps. 4-neighbour.
// Linear-scan open set is fine for small boards; swap in a binary heap if your
// boards exceed ~50x50 and pathing shows up in the profile.

const key = (tx: number, tz: number) => tx * 10000 + tz
const NEI = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const

/** Shortest tile path start->goal, or null if goal is blocked/unreachable. */
export function findPath(grid: TileGrid, start: Tile, goal: Tile): Tile[] | null {
  if (!grid.walkable(goal.tx, goal.tz)) return null
  const heuristic = (a: Tile) => Math.abs(a.tx - goal.tx) + Math.abs(a.tz - goal.tz)
  const open: Tile[] = [start]
  const came = new Map<number, number>()
  const g = new Map<number, number>([[key(start.tx, start.tz), 0]])

  while (open.length) {
    let bi = 0
    for (let i = 1; i < open.length; i++) {
      const fi = g.get(key(open[i].tx, open[i].tz))! + heuristic(open[i])
      const fb = g.get(key(open[bi].tx, open[bi].tz))! + heuristic(open[bi])
      if (fi < fb) bi = i
    }
    const cur = open.splice(bi, 1)[0]
    if (cur.tx === goal.tx && cur.tz === goal.tz) return reconstruct(came, cur)

    for (const [dx, dz] of NEI) {
      const nx = cur.tx + dx
      const nz = cur.tz + dz
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
  const path: Tile[] = [end]
  let k = came.get(key(end.tx, end.tz))
  while (k !== undefined) {
    path.unshift({ tx: Math.floor(k / 10000), tz: k % 10000 })
    k = came.get(k)
  }
  return path
}
