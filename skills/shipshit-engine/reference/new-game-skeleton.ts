// Minimal runnable skeleton for a brand-new studio game. Split into the files
// noted in the headers; collapsed here for reference. Boots a black scene that
// pushes a HUDState snapshot to React. Grow it with the "new system" recipe.
import * as THREE from 'three'

// ----------------------------------------------------------------- types.ts
export type GameStatus = 'menu' | 'playing' | 'paused' | 'gameover'
export interface HUDState {
  status: GameStatus
  score: number
  // ...flat, serialisable fields only. No class instances, no THREE.* objects.
}
export type StateListener = (state: HUDState) => void

// --------------------------------------------------------------- context.ts
export class GameContext {
  constructor(
    public readonly container: HTMLElement,
    public readonly listener: StateListener,
  ) {}
  renderer!: THREE.WebGLRenderer
  scene!: THREE.Scene
  camera!: THREE.PerspectiveCamera
  readonly clock = new THREE.Clock()
  raf = 0
  disposed = false
  status: GameStatus = 'menu'
  score = 0
}

// --------------------------------------------------------------- systems.ts
//   import type { RenderSystem } from './render/RenderSystem'
export interface GameSystems {
  render: RenderSystem
  hud: HudSystem
}

// ------------------------------------------------- render/RenderSystem.ts
class RenderSystem {
  constructor(private ctx: GameContext, private sys: GameSystems) {}
  setup() {
    this.ctx.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.ctx.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.ctx.renderer.setSize(this.ctx.container.clientWidth, this.ctx.container.clientHeight)
    this.ctx.container.appendChild(this.ctx.renderer.domElement)
    this.ctx.scene = new THREE.Scene()
    this.ctx.camera = new THREE.PerspectiveCamera(75, this.ctx.container.clientWidth / this.ctx.container.clientHeight, 0.05, 500)
    this.ctx.scene.add(new THREE.AmbientLight(0xffffff, 1))
  }
  render() { this.ctx.renderer.render(this.ctx.scene, this.ctx.camera) }
}

// ----------------------------------------------------- systems/HudSystem.ts
class HudSystem {
  emitAccumulator = 0
  constructor(private ctx: GameContext, private sys: GameSystems) {}
  emit() {
    if (this.ctx.disposed) return
    this.ctx.listener({ status: this.ctx.status, score: this.ctx.score })
  }
}

// ------------------------------------------------------------------ Game.ts
export class Game {
  private ctx: GameContext
  private sys: GameSystems
  constructor(container: HTMLElement, listener: StateListener) {
    const ctx = new GameContext(container, listener)
    this.ctx = ctx
    const sys = {} as GameSystems
    this.sys = sys
    sys.render = new RenderSystem(ctx, sys)
    sys.hud = new HudSystem(ctx, sys)
  }
  start() {
    this.sys.render.setup()
    this.ctx.clock.start()
    this.sys.hud.emit()
    this.loop()
  }
  private loop = () => {
    if (this.ctx.disposed) return
    this.ctx.raf = requestAnimationFrame(this.loop)
    const delta = Math.min(this.ctx.clock.getDelta(), 0.1)
    if (this.ctx.status === 'playing') this.update(delta)
    this.sys.hud.emitAccumulator += delta
    if (this.sys.hud.emitAccumulator >= 0.1) { this.sys.hud.emitAccumulator = 0; this.sys.hud.emit() }
    this.sys.render.render()
  }
  private update(_delta: number) { /* this.sys.x.update(delta) in deterministic order */ }
  dispose() {
    this.ctx.disposed = true
    cancelAnimationFrame(this.ctx.raf)
    this.ctx.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose()
        const m = o.material
        Array.isArray(m) ? m.forEach((x) => x.dispose()) : m.dispose()
      }
    })
    this.ctx.renderer.dispose()
    if (this.ctx.renderer.domElement.parentElement === this.ctx.container) {
      this.ctx.container.removeChild(this.ctx.renderer.domElement)
    }
  }
}

// --------------------------------------------------------- App.tsx (sketch)
// const [hud, setHud] = useState<HUDState>(INITIAL_STATE)
// useEffect(() => {
//   const game = new Game(containerRef.current!, setHud)
//   game.start()
//   return () => game.dispose()
// }, [])
// main.tsx: render <App/> WITHOUT React.StrictMode.
