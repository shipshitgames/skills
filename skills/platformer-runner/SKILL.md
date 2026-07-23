---
name: platformer-runner
description: Build a high-speed side-on courier platformer (Sonic-like) — flow-state running, coyote/jump-buffer physics, seeded procedural courses, spike/bar/gap hazards, a speed-ember chain multiplier, and time/score scoring. Canonical game — Redline.
license: MIT
metadata:
  version: "0.1.0"
  gameType: platformer-runner
  tags: "platformer, runner, sonic-like, three.js, game-dev"
  author: Ship Shit Games
when_to_use: "building a high-speed platformer / courier runner, redline, sonic-like flow platformer, what does a speed platformer need"
disable-model-invocation: true
---

# Build a Platformer-Runner Game

High-speed side-on **courier platformer** (flow-state, Sonic-like). Canonical game:
**Redline**. Machine-readable companion: `blueprint.json` (the Build Plan engine
reads it to match genre + order the MVP worklist).

## Required asset classes (★ = MVP)
- ★ **Sprites** — courier (run/jump/air/dash/hit, side-on), platforms + ramps, spike/bar/gap hazards, speed embers, beacon finish.
- ★ **UI** — speed gauge, time counter, score, chain badge, progress bar. Later: title, results, leaderboard.
- ★ **VFX** — speed lines, dash burst, ember-collect pop, near-miss spark.
- ★ **Music/SFX** — gameplay loop + jump (variable pitch)/land/hurt/gem/victory SFX. Later: menu theme.

## MVP slice
Jump + coyote + jump-buffer physics → seeded procedural course → spike/bar/gap hazards → ramps (launch) → speed-ember chain (max 5x) → beacon finish → HUD (speed, time, score, chain, progress) → 1 courier sprite set.

## Workflow
1. `assetgen build-plan --game <slug>` selects this blueprint; read the MVP-first worklist.
2. `assetgen generate` the courier sprite set first; renders land in the project's assets.
3. `assetgen check --game <slug>` to validate; fix anything broken.
4. Re-plan; repeat until `summary.mvpTasks` is 0.

## Related Skills
- **side-scroller** — precision/infiltration platformer sibling (enemies + stomps, not speed-flow).
- **shipshit-engine** — the core architecture every game follows.
