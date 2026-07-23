---
name: side-scroller
description: Build an infiltration side-scroller platformer (Mario-like) — precise single-saboteur platforming with enemies, stomp-kills, moving platforms, hazards, and infiltrate→escape level phases. Canonical game — Rothulk.
license: MIT
metadata:
  version: "0.1.0"
  gameType: side-scroller
  tags: "platformer, side-scroller, mario-like, three.js, game-dev"
  author: Ship Shit Games
when_to_use: "building an infiltration / precision side-scroller platformer, rothulk, mario-like platformer, what does a side-scroller need"
disable-model-invocation: true
---

# Build a Side-Scroller Game

Infiltration **side-scroller platformer** (precise, Mario-like). Canonical game:
**Rothulk**. Machine-readable companion: `blueprint.json` (read by the Build Plan
engine to match genre + order the MVP worklist).

## Required asset classes (★ = MVP)
- ★ **Sprites** — hero (idle/run/jump/hurt), 3 enemies (blood-blob/spitter/charger), projectiles, static + moving platforms, acid/spike hazards, embers.
- ★ **UI** — lives (x3), HP bar, objective text, progress bar, ember counter. Later: title, level-complete, game-over.
- ★ **VFX** — stomp pop, acid splash, hit flash.
- ★ **Music/SFX** — gameplay loop + jump/stomp/hurt/ember SFX. Later: escape-phase theme.

## MVP slice
Hero physics (jump/land/coyote) → static AABB + moving-platform carry collision → 3 enemies (patrol/lobber/dash) → stomp-kill → acid/spike hazards → phases (infiltrate → core ignition → escape) → 2 levels → HUD (lives, HP, objective, progress, embers).

## Workflow
1. `assetgen build-plan --game <slug>` selects this blueprint; read the MVP-first worklist.
2. `assetgen generate` the hero + enemy sprites first; renders land in the project's assets.
3. `assetgen check --game <slug>` to validate; fix anything broken.
4. Re-plan; repeat until `summary.mvpTasks` is 0.

## Related Skills
- **platformer-runner** — high-speed flow sibling (no enemies/stomps; speed-chain scoring).
- **shipshit-engine** — the core architecture every game follows.
