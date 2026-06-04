---
name: vibe-game-workflow
description: Ship Shit Games' end-to-end methodology for vibe-coding a 3D browser game with Claude/Codex from idea to deployed — write a TinyPRD, plan-first, build feature-by-feature in dependency order, playtest after each feature, then ship to Vercel + PartyKit. Use this to orchestrate a whole game build or decide which sibling skill to load next.
license: MIT
metadata:
  version: "0.1.0"
  tags: "workflow, game-dev, methodology, planning"
  author: Ship Shit Games
---

# Vibe Game Workflow

The studio's master playbook. Every Ship Shit Games title is one Vite + TypeScript +
imperative Three.js repo, vibe-coded with Claude Code (Opus) + Codex, streamed on the
shipshitshow. This skill is the orchestrator: it tells you what to do, in what order,
and which sibling skill to load at each step. The proof is the FPS reference game at
`games/scourge-survivors/` — cite it when in doubt.

Read this top to bottom once, then drive the loop. Do NOT improvise architecture; every
studio game shares the same shape so shared code can move into `@shipshitgames/engine`.

## The one architecture (identical in every game)

- **Game** = thin orchestrator. Builds a `GameContext` + a `GameSystems` registry, runs
  the rAF loop, exposes the public API by delegating to systems. See `games/scourge-survivors/src/game/Game.ts`.
- **GameContext** = the shared mutable world (renderer, scene, camera, controls, clock,
  raycaster, collision arrays, entity pools, current map, status/outcome). Constructed
  with `(container: HTMLElement, listener: StateListener)`. See `games/scourge-survivors/src/game/context.ts`.
- **GameSystems** = a registry interface. Each system is `new XSystem(ctx, sys)` and calls
  siblings via `this.sys.<name>`. Construction order is irrelevant. Use **type-only imports**
  in the registry to avoid runtime cycles. See `games/scourge-survivors/src/game/systems.ts`.
- Systems grouped in folders: `render/`, `entities/`, `modes/`, `systems/`.
- Content is **data-driven**: tunables in `constants.ts`, content tables in `data/*.ts`.
- UI: systems push a `HUDState` snapshot to React via the `StateListener`; React renders
  the HUD/menus. The game owns a container div; React overlays on top.
- Assets: `assets.json` manifest is the single source of truth; code never hardcodes paths.
- Persistence: `localStorage` for scores, settings, meta-progression.

> Load **shipshit-engine** for the full contract before writing any system code. This
> skill assumes you know it.

## Step 0 — Write a TinyPRD (one page, before any code)

Pin the design so scope can't drift mid-stream. Put it in `docs/PRD.md`:

```md
# <Game Name> — TinyPRD
- **Genre:** fps-arena | tower-defense-3d | isometric-3d
- **Core loop (one sentence):** e.g. "Clear waves of enemies, pick up loot, survive the boss."
- **Win / Lose:** win = clear all waves + boss; lose = health hits 0.
- **Controls:** WASD move, mouse look (pointer lock), LMB fire, R reload, 1-4 weapons, Esc pause.
- **Modes (cut to ONE for v1):** Campaign. (Survivors / Multiplayer are LATER.)
- **Scope cut list (explicitly NOT in v1):** no shop, no meta-progression, one map, no audio polish.
- **Juice budget:** muzzle flash, hit markers, damage numbers, screen-relative banners.
```

Rules: one core loop, one mode, one map for v1. Everything else goes on the cut list.
A TinyPRD that fits on a screen is the strongest scope-discipline tool you have.

### Which spec layer to write (game vs feature vs non-trivial)

The TinyPRD scopes a whole **game**. For everything after — features, bugs, follow-ups —
drop to the right layer instead of bloating the PRD. An agent's implementation guidance
comes from this skill + **shipshit-engine**, never from prose in the spec; so keep every
spec to scope + testable acceptance criteria and let the architecture carry the rest.

| You're defining… | Write | Where | Skill |
|---|---|---|---|
| A new game's v1 | **TinyPRD** (one screen) | `docs/PRD.md` | this skill, Step 0 |
| One feature / bug / enhancement | **Feature PRD** — Problem → Goal → Scope → Acceptance → Tech notes | GitHub issue | **task-prd-creator** |
| A non-trivial feature (3+ files / fuzzy reqs) | **Spec** — spec.md + todo.md + decisions.md, before code | repo | **spec-first** |
| A trivial change (< 50 lines, one file) | nothing — just do it | — | — |

What raises agent success isn't length — it's testable acceptance criteria, a "files likely
affected" + pattern-to-follow pointer, an explicit out-of-scope, and a link to canon
(`loreId`) + the relevant skill. Padding rots; precision ships.

## Step 1 — Plan-first

Enter **plan mode** and produce a feature-ordered build plan derived from the PRD. Do not
write code in plan mode. The plan is the dependency-ordered feature list (Step 3). Get it
agreed, then exit plan mode and build top-down.

## Step 2 — Scaffold the repo

One repo per game (e.g. `shipshitgames/<game>`). Match `games/scourge-survivors/package.json`: Vite +
TS + Three.js for the game, React + Tailwind v4 + Radix/shadcn for the shell ONLY, PartyKit
for multiplayer. The game `package.json` name is the game (e.g. `fps-arena`). Scripts:

```jsonc
"dev": "vite",
"dev:all": "concurrently -k -n game,party -c cyan,magenta \"vite\" \"partykit dev\"",
"build": "tsc && vite build",
"typecheck": "tsc --noEmit",
"party:dev": "partykit dev",
"party:deploy": "partykit deploy"
```

Lay down the skeleton so the loop has somewhere to land (empty systems are fine):

```
src/
  main.tsx              # React root -> <App/>
  App.tsx               # owns container div; new Game(container, setHud); game.start()
  game/
    Game.ts             # orchestrator (loop + public API)
    context.ts          # GameContext (shared mutable world)
    systems.ts          # GameSystems registry (type-only imports)
    types.ts            # GameStatus, HUDState, StateListener
    constants.ts        # numeric tunables
    data/maps.ts        # content tables (data-driven)
    render/   entities/   modes/   systems/
  components/HUD.tsx     # React HUD, renders from HUDState
  audio/AudioEngine.ts
  assets/               # webp sprites/textures (registered in assets.json)
party/arena.ts          # PartyKit room server
assets.json             # asset manifest (single source of truth)
```

The `Game.start()` body literally is the build order — see `games/scourge-survivors/src/game/Game.ts:54`:
`setupRenderer -> setupScene -> buildArena -> buildWeapon -> bindEvents -> resetPlayer ->
startWaveSystem -> hud.emit -> loop`.

## Step 3 — Build feature-by-feature in dependency order

Build ONE feature, get it on screen, playtest (Step 4), then the next. Never start a
feature whose dependency isn't visibly working. Canonical order:

1. **Arena** — `RenderSystem` (renderer/scene/camera/lights) + `ArenaSystem` (floor, walls,
   obstacles from a map in `data/maps.ts`). You should see a room you can't yet move in.
   → load **fps-arena** (or **tower-defense-3d** / **isometric-3d** per genre).
2. **Camera / Input** — `InputSystem`: pointer lock, key/mouse state into `ctx.move`/`ctx.firing`.
3. **Player movement** — `PlayerSystem.updatePlayerMovement` + `resolveCollisions` against
   `ctx.obstacleBoxes`. Now you can walk the arena.
4. **Enemies** — `Enemy` entity + `PveDirectorSystem` spawning/AI. Things to shoot.
5. **Combat** — `WeaponSystem` (raycast hits via `ctx.raycaster`/`ctx.raycastTargets`),
   `ProjectilesSystem`, damage/death. The core loop is now playable.
6. **HUD** — `HudSystem.emit()` pushes `HUDState`; `HUD.tsx` renders health/ammo/score/banners.
   → load **shipshit-engine** for the StateListener pattern; see `games/scourge-survivors/src/game/types.ts`.
7. **Juice** — `FxSystem`: muzzle flash, hit markers, damage numbers, banners, screen feel.
8. **Audio** — `AudioEngine` sfx hooks from systems (`audio.sfx('hit')`).
9. **Multiplayer** (only if in the PRD) — `MultiplayerSystem` + `party/arena.ts`.
   → load **partykit-multiplayer**.

Each new system: add the field to `GameSystems` (type-only import), `new XSystem(ctx, sys)`
in `Game.ts`, and a `this.sys.x.update(delta)` call in the loop's `update()`. Cross-system
state goes on `GameContext`; private state stays on the system.

## Step 4 — Playtest after EVERY feature (non-negotiable)

Right after a feature renders, run the **playwright-game-testing** loop: launch the dev
server, drive the canvas (click to lock, WASD, fire), screenshot, and read the console for
errors. Fix before moving on. Bugs are cheapest the frame you create them. The studio
exposes `window.__fpsGame` in dev (see `App.tsx:98`) specifically so tests can poke the
game; do the same in every game.

→ load **playwright-game-testing**.

## Step 5 — Generate + register assets

When a feature needs art (sprites, textures), generate it via **game-asset-pipeline** and
register every file in `assets.json`. The loader reads the manifest; code references assets
by id, never by hardcoded path. Keep gameplay logic free of asset URLs.

→ load **game-asset-pipeline**.

## Step 6 — Deploy

Two pieces (see `games/scourge-survivors/DEPLOY.md`):

```bash
# 1. Multiplayer room server (only if the game has multiplayer)
npm run party:deploy            # prints fps-arena.<you>.partykit.dev

# 2. Static SPA -> Vercel (set the PartyKit host as a build env var)
echo "VITE_PARTYKIT_HOST=<game>.<you>.partykit.dev" >> .env
npm run build                   # tsc && vite build -> dist/
vercel --prod                   # or push to GitHub + Import Project (auto-detects Vite)
```

Single-player works with just the Vercel front end; multiplayer needs PartyKit.

## Scope discipline

- v1 = one mode, one map, the core loop only. Modes/shop/meta-progression are post-v1.
- If a feature isn't in the TinyPRD, it goes on the cut list, not in the code.
- Prefer more maps/enemies via **data tables** over more systems. New content should be a
  table entry, not new code (see how `data/maps.ts` adds maps with zero logic changes).
- A new mode is a new `modes/*` system + a branch in the loop's `update()` — not a fork.

## Context-compaction tips (long streamed sessions)

- Keep the TinyPRD + the feature checklist in `docs/` and re-read them after a compaction;
  they are the cheapest way to restore intent.
- Work one feature per focused session; commit at each green playtest so state is recoverable.
- When the context gets heavy, summarize "what's working / what's next" into the PRD's
  checklist rather than trusting recall.
- Reference canonical files by path (`games/scourge-survivors/src/game/Game.ts`) instead of pasting them;
  re-read on demand.
- One system per file keeps each unit small enough to load without dragging in the world.

## Per-game repo + @shipshitgames/engine convention

- Each game is its own repo under `shipshitgames/`. Shared cross-game code (the
  GameContext/GameSystems contract, loop helpers, loader, input, math) lives in the npm
  package `@shipshitgames/engine` (still forming — `scourge-survivors` is its proof). Until it ships,
  copy the patterns from `scourge-survivors`; when it lands, depend on it and delete the duplicates.
- Genre skills (**fps-arena**, **tower-defense-3d**, **isometric-3d**) layer genre systems
  on top of the engine contract. Always load **shipshit-engine** + the one genre skill.

## Do / Don't

- DO write the TinyPRD first and cut scope to one mode + one map for v1.
- DO build in dependency order; never start a feature whose dependency isn't on screen.
- DO playtest with playwright after every single feature.
- DO put tunables in `constants.ts` and content in `data/*.ts`; add content as table rows.
- DO keep cross-system state on `GameContext`; reach siblings via `this.sys.<name>`.
- DON'T use react-three-fiber. React is the HUD/menu shell ONLY; the game is imperative Three.js.
- DON'T hardcode asset paths in gameplay code — go through `assets.json`.
- DON'T fork the orchestrator per mode; add a `modes/*` system + a loop branch.
- DON'T let React own game state; React renders from the pushed `HUDState` snapshot only.

## Common bugs

- **Runtime import cycle in the registry** — `systems.ts` must use `import type`. A value
  import there crashes at module load.
- **System used before populated** — only *call* siblings inside `update()`/methods, never
  in a constructor (construction order is intentionally undefined).
- **HUD churn / React re-render storms** — throttle `hud.emit()` (the loop accumulates and
  emits ~10 Hz, see `Game.ts:79`); don't emit every frame.
- **WebGL context not disposed on unmount** — `Game.dispose()` must cancel the rAF, unlock
  pointer, dispose geometries/materials/renderer, and remove the canvas (see `Game.ts:152`).
  React StrictMode double-mounts in dev; a leaky dispose doubles your GPU memory.
- **delta spikes after a tab pause** — clamp it: `Math.min(clock.getDelta(), 0.1)` (`Game.ts:72`).
- **Multiplayer "connecting…" forever** — the PartyKit server isn't running; use `npm run dev:all`.
- **Building features out of order** — combat before player movement gives you nothing to
  test against; follow the Step 3 order.

## Worked example (the studio's actual first 30 minutes)

1. `docs/PRD.md`: FPS arena, core loop "clear waves + boss on one map", win/lose, WASD+mouse,
   v1 = Campaign only, cut list = Survivors/Multiplayer/shop.
2. Plan mode: agree the 9-feature order above. Exit plan mode.
3. Scaffold matching `games/scourge-survivors/package.json`; empty systems registered in `systems.ts`.
4. Feature 1 (Arena): `RenderSystem` + `ArenaSystem` from a single map in `data/maps.ts`.
   Playwright: launch, screenshot — a lit room appears. Commit.
5. Feature 2-3 (Input + movement): pointer lock, WASD, collisions. Playwright: walk around. Commit.
6. Feature 4-5 (Enemies + combat): spawn, raycast fire, kills. Playwright: shoot an enemy,
   watch it die in the console. Commit.
7. Feature 6 (HUD): `HudSystem.emit()` -> `HUD.tsx` shows health/ammo/score. Commit.
8. Generate sprites via game-asset-pipeline, register in `assets.json`, swap placeholders.
9. `npm run build` -> `vercel --prod`. Ship it on stream.

## Related skills

- **shipshit-engine** — the GameContext/GameSystems contract; load this first, every build.
- **fps-arena**, **tower-defense-3d**, **isometric-3d** — pick the one genre skill per game.
- **partykit-multiplayer** — the multiplayer feature step.
- **game-asset-pipeline** — generate art + the `assets.json` manifest (Step 5).
- **playwright-game-testing** — the per-feature playtest loop (Step 4).
- **task-prd-creator** — write the Feature PRD (GitHub issue) for a single feature/bug/enhancement.
- **spec-first** — spec → plan → execute → verify for a non-trivial feature (3+ files / fuzzy reqs).
