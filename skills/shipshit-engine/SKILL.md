---
name: shipshit-engine
description: The foundational @shipshitgames/engine architecture every Ship Shit Games title follows — the Game orchestrator + GameContext + GameSystems registry, the system folder layout, data-driven content, the rAF loop, dispose discipline, and the React-shell-for-HUD boundary. Load this FIRST when starting a new studio game or adding/extending any system in an existing one.
license: MIT
metadata:
  version: "0.1.0"
  tags: "game-engine, three.js, architecture, ecs, typescript"
  author: Ship Shit Games
---

# shipshit-engine

The architecture that EVERY studio game shares. Imperative Three.js for the game, React + Tailwind only for the HUD/menu shell. This is the skeleton `@shipshitgames/engine` will encode; the proof implementation is `scourge-survivors` (cited throughout). Read those files before writing — match them exactly.

## The three pillars

1. **`Game`** — a thin orchestrator. Constructs the `GameContext` + the `GameSystems` registry, runs the `requestAnimationFrame` loop, and exposes the public API by delegating to systems. It holds almost no logic of its own.
2. **`GameContext`** — the shared mutable world. Anything touched by more than one system lives here (renderer, scene, camera, controls, clock, raycaster, collision arrays, entity pools, current map, status/outcome). State owned by a single system stays private on that system. Constructed with `(container, listener)`.
3. **`GameSystems`** — a registry interface. Each system is `new XSystem(ctx, sys)` and calls siblings via `this.sys.<name>`. Construction order is irrelevant. The interface uses **type-only imports** so there is no runtime import cycle.

## File layout

```
src/
  main.tsx            # ReactDOM root — NOT in StrictMode (would double-mount the loop)
  App.tsx             # React shell: owns container div, new Game(container, setHud), game.start()
  components/HUD.tsx   # renders entirely from the HUDState snapshot
  game/
    Game.ts            # orchestrator: ctx + sys + loop + public API + dispose
    context.ts         # GameContext (shared mutable world)
    systems.ts         # GameSystems registry interface (type-only imports)
    types.ts           # GameStatus, HUDState, StateListener — the React<->game contract
    constants.ts       # ALL numeric tunables live here
    storage.ts         # localStorage: scores, settings, meta-progression
    data/              # content tables: maps.ts, survivors.ts, ... (data-driven)
    render/            # RenderSystem, ArenaSystem
    entities/          # PlayerSystem, WeaponSystem, ProjectilesSystem, PickupsSystem, FxSystem, Enemy
    modes/             # PveDirectorSystem, SurvivorsSystem, MultiplayerSystem, GameOverSystem
    systems/           # InputSystem, HudSystem
```

## The orchestrator (`game/Game.ts`)

The constructor builds an empty registry, then populates it. Note `{} as GameSystems` — systems only touch siblings at runtime, so they can all reference the not-yet-built registry safely.

```ts
export class Game {
  private ctx: GameContext
  private sys: GameSystems

  constructor(container: HTMLElement, listener: StateListener) {
    const ctx = new GameContext(container, listener)
    this.ctx = ctx
    const sys = {} as GameSystems
    this.sys = sys
    sys.render = new RenderSystem(ctx, sys)
    sys.arena = new ArenaSystem(ctx, sys)
    sys.player = new PlayerSystem(ctx, sys)
    // ...every system, construction order irrelevant...
    sys.hud = new HudSystem(ctx, sys)
  }
```

`start()` does explicit, ordered bootstrap (renderer -> scene -> arena -> input -> reset -> clock.start -> first emit -> loop). The loop is an arrow field so `this` binds and `cancelAnimationFrame` works:

```ts
  private loop = () => {
    if (this.ctx.disposed) return
    this.ctx.raf = requestAnimationFrame(this.loop)

    const delta = Math.min(this.ctx.clock.getDelta(), 0.1) // clamp: a tab-out must not teleport the world
    const elapsed = this.ctx.clock.elapsedTime

    if (this.ctx.status === 'playing') this.update(delta, elapsed)
    else if (this.ctx.status !== 'paused') this.sys.fx.updateEffects(delta) // FX still tick on menus
    // paused: nothing simulates, frame is re-rendered as-is

    this.sys.hud.emitAccumulator += delta
    if (this.sys.hud.emitAccumulator >= 0.1) {  // throttle React to ~10Hz, NOT every frame
      this.sys.hud.emitAccumulator = 0
      this.sys.hud.emit()
    }
    this.sys.render.render()
  }
```

`update(delta, elapsed)` is a flat, explicit ordering of `this.sys.x.update...(delta)` calls — movement, then collisions, then weapons, then mode-specific branches (`if (ctx.multiplayer) ... else if (ctx.survivors) ... else campaign`). Keep update order deterministic and readable; never hide it behind a generic `for (system of systems)` iteration.

Public methods (`startCampaign`, `startSurvivors`, `restart`, `dispose`, ...) are one-liners delegating to a system: `startSurvivors() { this.sys.survivors.startSurvivors() }`.

## The shared world (`game/context.ts`)

```ts
export class GameContext {
  constructor(
    public readonly container: HTMLElement,
    public readonly listener: StateListener,
  ) {}

  // core three objects — created by RenderSystem during start(), hence definite-assignment `!`
  renderer!: THREE.WebGLRenderer
  scene!: THREE.Scene
  camera!: THREE.PerspectiveCamera
  controls!: PointerLockControls
  readonly clock = new THREE.Clock()
  readonly raycaster = new THREE.Raycaster()
  raf = 0
  disposed = false

  // world collision / hit-test targets (shared across systems -> live here)
  solidMeshes: THREE.Mesh[] = []
  obstacleBoxes: THREE.Box3[] = []
  raycastTargets: THREE.Object3D[] = []
  enemies: Enemy[] = []          // pooled — holds dead entries too

  status: GameStatus = 'pointerlock-needed'
  outcome: 'win' | 'dead' | null = null

  // reused scratch vectors — never allocate per-frame in hot paths
  readonly _dir = new THREE.Vector3()
  readonly _fwd = new THREE.Vector3()

  get aliveCount(): number {     // derived state -> getter, never a stored duplicate
    let n = 0
    for (const e of this.enemies) if (e.alive) n++
    return n
  }
}
```

Rules: shared state -> `ctx`; single-system state -> private field on that system. Use `!` for objects RenderSystem assigns in `start()`. Use `readonly` scratch vectors for hot-path math. Expose derived values as getters.

## The registry (`game/systems.ts`) — type-only imports

```ts
import type { RenderSystem } from './render/RenderSystem'
import type { PlayerSystem } from './entities/PlayerSystem'
// ...type-only...

export interface GameSystems {
  render: RenderSystem
  player: PlayerSystem
  // ...one key per system...
  hud: HudSystem
}
```

`import type` is mandatory: every system imports `GameSystems`, so a value import would create a cycle. The registry is a pure compile-time contract.

## A system

Every system has the identical shape: `constructor(private ctx, private sys)`, public methods the orchestrator/siblings call, private per-frame `update*(delta)` methods. Reach the world via `this.ctx`, siblings via `this.sys.<name>`.

```ts
import type { GameContext } from '../context'
import type { GameSystems } from '../systems'

export class WeaponSystem {
  private fireCooldown = 0          // private: only WeaponSystem touches it
  constructor(private ctx: GameContext, private sys: GameSystems) {}

  buildWeapon() { /* called once from Game.start() */ }

  updateWeapon(delta: number) {
    this.fireCooldown -= delta
    if (this.ctx.firing && this.fireCooldown <= 0) {
      this.sys.projectiles.spawnTracer(/* ... */)  // call a sibling
      this.sys.hud.addDamageNumber(/* ... */)
    }
  }
}
```

## Data-driven content

Numeric tunables -> `constants.ts`. Content tables -> `data/*.ts`. Gameplay logic NEVER hardcodes content.

```ts
// constants.ts — tunables, units ~meters/seconds
export const GRAVITY = 30
export const PLAYER_MAX_HEALTH = 100
export interface WeaponSpec { id: WeaponId; damage: number; fireInterval: number; magazineSize: number; /* ... */ }
export const WEAPONS: Record<WeaponId, WeaponSpec> = { rifle: { /* ... */ }, smg: { /* ... */ } }

// data/maps.ts — content table + lookup
export const MAPS: Record<string, ArenaMap> = { foundry: { /* ... */ } }
export const DEFAULT_MAP_ID = 'foundry'
export function getMap(id: string): ArenaMap { return MAPS[id] ?? MAPS[DEFAULT_MAP_ID] }
```

Systems read these (`WEAPONS[ctx.activeWeapon]`, `getMap(id)`); they never inline magic numbers. To add a weapon/map/upgrade you edit data, not logic.

## The React-shell boundary (`main.tsx`, `App.tsx`, `types.ts`)

The game owns a container `<div>`; React overlays the HUD. The ONLY channel from game to React is a `StateListener` that pushes an immutable `HUDState` snapshot; the ONLY channel back is the `Game` public-API methods.

```ts
// types.ts — the contract
export interface HUDState { status: GameStatus; playerHealth: number; ammo: number; /* ...flat, serialisable... */ }
export type StateListener = (state: HUDState) => void
```

```tsx
// App.tsx — one game per mount
const [hud, setHud] = useState<HUDState>(INITIAL_STATE)
useEffect(() => {
  const game = new Game(containerRef.current!, setHud)   // listener === setHud
  gameRef.current = game
  game.start()
  return () => { game.dispose(); gameRef.current = null }  // cleanup MUST dispose
}, [])
// user actions delegate to the game:
const handleLock = () => gameRef.current?.requestLock()
```

```tsx
// main.tsx — NOT StrictMode (it double-invokes effects -> two WebGL contexts / two loops)
ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
```

HudSystem builds the snapshot from `ctx` and calls `ctx.listener(snapshot)`. Throttled to ~10Hz via `emitAccumulator` (see the loop) — never call `setHud` 60×/sec. Use monotonic `*Seq` counters in `HUDState` (`hitMarkerSeq`, `bannerSeq`) to trigger one-shot React animations from the snapshot.

## Dispose / teardown discipline

`dispose()` (`Game.ts`) must fully unwind a mount; React StrictMode/HMR/route changes WILL call it. The order in scourge-survivors:

```ts
dispose() {
  this.ctx.disposed = true                 // guards loop() and emit()
  cancelAnimationFrame(this.ctx.raf)
  this.sys.multiplayer.leaveMultiplayer(false)
  this.sys.input.removeListeners()         // EVERY addEventListener has a matching removeEventListener
  if (this.ctx.controls.isLocked) this.ctx.controls.unlock()
  this.ctx.controls.dispose()
  for (const enemy of this.ctx.enemies) enemy.dispose()
  this.ctx.scene.traverse((o) => {         // dispose geometries + materials (arrays too)
    if (o instanceof THREE.Mesh) { o.geometry.dispose(); const m = o.material; Array.isArray(m) ? m.forEach(x => x.dispose()) : m.dispose() }
  })
  this.ctx.renderer.dispose()
  if (this.ctx.renderer.domElement.parentElement === this.ctx.container) this.ctx.container.removeChild(this.ctx.renderer.domElement)
}
```

Mirror this: bind listeners in a system's `bindEvents()`, tear them down in `removeListeners()` (see `systems/InputSystem.ts`); dispose every WebGL resource you create.

## Do / Don't

**Do**
- Keep `Game` thin — orchestration + loop + delegation only.
- Put shared state in `ctx`, single-system state private on the system.
- Use `import type` in `systems.ts` and for `ctx`/`sys` types in every system.
- Clamp `delta` (`Math.min(getDelta(), 0.1)`); branch the loop on `ctx.status`.
- Throttle HUD emits; push immutable flat snapshots.
- Reuse scratch vectors from `ctx`; pool entities.
- Drive everything from `constants.ts` + `data/*.ts`.

**Don't**
- Don't run the game inside `<React.StrictMode>`.
- Don't import a sibling system directly — go through `this.sys`.
- Don't read DOM/React from a system, or reach into Three objects from React.
- Don't `setHud` every frame, or send class instances / `THREE.*` objects through the listener.
- Don't allocate vectors/materials per frame in `update`.
- Don't hardcode content numbers in logic.
- Don't depend on system construction order (everything's populated before `start()`).

## Common bugs

- **Two loops / black or flickering canvas** — game mounted under StrictMode, or `useEffect` cleanup didn't call `dispose()`. Mount once, NOT in StrictMode.
- **Runtime "Cannot access before initialization" / circular import** — a value import in `systems.ts` (or a system value-importing a sibling). Use `import type`.
- **`ctx.renderer` is undefined** — touched a `!` field before `RenderSystem.setupRenderer()` ran in `start()`. Respect the bootstrap order.
- **HUD frozen / stutters** — forgot to reset `emitAccumulator`, or emitted from a system without `if (ctx.disposed) return`.
- **Physics explodes after tab-out** — unclamped `delta`. Always clamp.
- **GPU memory leak across restarts** — `dispose()` skipped a geometry/material, or a listener wasn't removed.
- **Stale React animation re-fires** — reused a `*Seq` counter without bumping it, or didn't clear a banner on run start.

## Recipe: add a NEW system

1. Create `game/<group>/FooSystem.ts` with `constructor(private ctx, private sys)` and type-only `ctx`/`sys` imports.
2. Add `foo: FooSystem` to the `GameSystems` interface in `systems.ts` (type-only import).
3. Construct it in `Game` ctor: `sys.foo = new FooSystem(ctx, sys)`.
4. Put cross-system state on `ctx`; keep the rest private.
5. Call any one-time setup from `Game.start()`; call `this.sys.foo.update(delta)` from `Game.update()` in the right order.
6. If it owns DOM/window listeners, add `bindEvents()`/`removeListeners()` and wire teardown into `dispose()`.
7. If it adds HUD fields, extend `HUDState` in `types.ts`, the `INITIAL_STATE` in `App.tsx`, and `HudSystem.emit()`.

See `reference/new-system.ts`.

## Recipe: a NEW game skeleton

Copy the layout above. Minimum to boot: `context.ts`, `systems.ts` (with just `render`), `RenderSystem`, `Game.ts`, `types.ts` (`HUDState`/`StateListener`), and an `App.tsx` that does `new Game(container, setHud); game.start()` with a `dispose()` cleanup. Grow by adding systems via the recipe above. A runnable starter is in `reference/new-game-skeleton.ts`.

## Related skills

- **fps-arena** — the FPS gameplay systems built on this engine.
- **tower-defense-3d**, **isometric-3d** — other genres reusing this orchestrator/registry pattern.
- **partykit-multiplayer** — how `MultiplayerSystem` plugs a netcode mode into the loop.
- **game-asset-pipeline** — the `assets.json` manifest + loader the systems read from.
- **playwright-game-testing** — driving the game via its `window.__game` dev handle.
- **vibe-game-workflow** — the end-to-end Claude Code + Codex authoring loop.
