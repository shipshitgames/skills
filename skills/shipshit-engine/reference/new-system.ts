// Template for a new studio system. Copy into game/<group>/FooSystem.ts.
//
// Then, in game/systems.ts:
//   import type { FooSystem } from './<group>/FooSystem'
//   export interface GameSystems { /* ... */ foo: FooSystem }
// And in game/Game.ts constructor:
//   sys.foo = new FooSystem(ctx, sys)
// Call one-time setup from Game.start(); call update(delta) from Game.update().

import type { GameContext } from '../context'
import type { GameSystems } from '../systems'

/** One paragraph: what slice of the world this system owns. */
export class FooSystem {
  // Per-system PRIVATE state. Anything a sibling needs goes on ctx instead.
  private timer = 0

  constructor(private ctx: GameContext, private sys: GameSystems) {}

  /** One-time setup, called from Game.start() (after RenderSystem bootstrap). */
  setup() {
    // build meshes, register raycast targets on ctx, etc.
  }

  /** Per-frame tick, called from Game.update() in a deterministic order. */
  update(delta: number) {
    this.timer += delta
    // read the world via this.ctx, call siblings via this.sys.<name>:
    // this.sys.fx.spawnBurst(this.ctx._dir)
    // this.sys.hud.showToast('...')
  }

  /** Only if this system owns DOM/window listeners. Wire teardown into Game.dispose(). */
  bindEvents() {
    // window.addEventListener('...', this.onThing)
  }
  removeListeners() {
    // window.removeEventListener('...', this.onThing)
  }
}
