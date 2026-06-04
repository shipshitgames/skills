---
name: sprite-animation-gyms
description: Produce and validate animated 2D/billboard sprites for a Ship Shit Games title — generate animations with VIDEO models (Grok Imagine, 1s-clip rule) instead of image-gen sheets, pixel-snap AI art to real pixels, and validate every asset in single-scene "gym" harnesses (collision/attack bounds, hit-frame selection, platform collision strips). Also covers the 2D level atlas + JSON manifest and a gizmo-based level editor that persists to level.json. Use when generating/animating sprites, debugging floating or mis-hitting characters, or building element/level editors.
license: MIT
metadata:
  version: "0.1.0"
  tags: "sprites, animation, ai-generation, gym, level-editor, 2d"
  author: Ship Shit Games
when_to_use: "animate a sprite, generate a walk cycle, character looks like it's floating, attack doesn't register on the right frame, build a character gym, build a level editor, pixel-snap AI art, parallax background, sprite atlas"
---

# Sprite Animation & Gyms

How the studio turns raw AI art into **animated, game-ready** sprites and proves they're
correct before they hit a game. This is the animation + QA-harness counterpart to
**game-asset-pipeline** (which owns the `assets.json` manifest, the loader, and the
generation toolbox). Generate art there; animate and validate it here.

Provenance: distilled from the AI-Oriented-Dev *Robin Chute* build
(`youtube.com/watch?v=x_P855cmBxQ`) and adapted to our stack. The raw transcript→rules
tool is `@shipshitgames/research` in the studio monorepo (Studio cockpit → **Rules** pane).

The whole loop, one line:

> **concept → anchor → animate (video) → snap → slice → atlas → gym → level → game**

## Art pipeline (per character/enemy)

- Generate a **front-facing concept at the highest resolution available**: neutral pose,
  **stable silhouette, readable at game scale**. Pass the game concept so it keeps key features.
- Re-prompt to a **game-ready version on a chroma-green background** so the background keys
  out cleanly for transparency.
- **Pixel-snap** the result. AI models only *spoof* pixel art — zoom in and edges are mushy.
  Snapping gives crisp, **infinitely scalable** real pixels. Our tool: `assetgen pixelize`
  (see `packages/assetgen/src/pixelize.ts`); the author used Sprite Fusion Pixel Snapper.
- Generate a **west/left-facing** anchor and **flip horizontally** for the right-facing one —
  don't generate both.

## Animation — prefer VIDEO generation

The biggest lever in the source build. Image-gen sprite sheets have two failure modes:
**uneven frame spacing** (you must re-cut and re-anchor to kill drift) and **broken walk
cycles**. Death/attack sometimes survive image-gen; locomotion does not.

- **Use a video model for animations** (the author uses **Grok Imagine**), then split frames →
  key out background → stitch into a sheet. Frames come out **already temporally consistent**,
  so you skip the frame-picking cleanup.
- **Keep each clip ≤1 second (2s absolute max).** Longer clips drift and add motion you have to
  clean. Short clips also cost less (~7¢/clip at 1s in the source).
- Register the finished sheet as a **`sprite-anim`** entry in `assets.json` (`frames`,
  `frameSize`, `fps`, `loop`, `anchor`) — see **game-asset-pipeline**. Never hardcode frame math.

## Parallax & backgrounds

- Build depth from **3 layers scrolling at different speeds** (far sky, mid, near).
- **The background must never compete with the gameplay layer.** Keep far layers softer and
  lower-contrast; if the near layer is as crisp as the playable layer, players can't tell what's
  interactive. When in doubt, re-prompt: "less busy, more game-like, colors must not conflict
  with the game layer."

## Gyms — single-scene QA harnesses

A **gym** is a throwaway single-scene playground (its own Vite entry) whose only job is to let
you *see* what the AI produced and fix it. Three you always want:

- **Character gym** — cycle every animation (catch too-small / desynced / incomplete clips);
  visualize **collision bounds** and **attack bounds**; pick **which frames register a hit**.
  - Collision bounds must hug the character *inside* the frame, not the empty padding — otherwise
    the character **floats above the ground**.
  - Attack bounds must cover only the striking limb; select the exact frames where it's extended
    (e.g. frames 5–6 of a punch). Otherwise a hit lands on a windup frame and reads as broken.
- **Element/editor gym** — fix **platform collision strips** so a character stands *on* the
  surface (a little grass at the top), not floating above or sunk into it.
- **Playground gym** — drop the character on real elements and confirm movement, facing, and
  attacks all play correctly together.

Add an **asset-label toggle** to gyms (show which asset id each tile uses) so a bad bound traces
straight back to the offending entry.

## Atlas + JSON manifest (2D level art)

- Pack level art into a **single chroma atlas + a JSON map** of region→id; the engine crops the
  region it needs. Don't ship dozens of loose images.
- Keep **two atlases**: **platforming elements** vs **props/pickups** (background dressing). The
  split keeps collision-bearing art separate from decoration.

## Level editor & persistence

- Build a level editor early — agents are good at this. Give it **gizmos** (say "like Blender /
  Unity / Unreal") to move elements along an axis or freely, and a **type switcher** to drop
  different element kinds.
- **Save to `level.json` on disk**, not browser session — session state vanishes on deploy.
  Levels become **shareable data**, never hardcoded in game code (mirrors our data-driven rule).

## Enemies

- Two cheap, readable archetypes cover a lot: a **static turret** (detection **radius** +
  fire **cooldown** + HP) and a **same-platform chaser** (patrol speed + detection + chase speed).
- Tune **knockback, chase speed, recovery cooldown** for *readable* combat, and **save the configs**
  so they persist across the whole game. Do this in the enemy gym, not by editing code per-tweak.

## HUD & polish

- Generate the HUD with image-gen: a **chroma-key health bar** (portrait + a transparent region
  you fill/empty as a mask). The chroma region is what lets you animate the fill.
- Small polish that punches above its weight: **tween pickups toward the scoreboard** on collect.

## Splash screen

- Prompt the splash as a **stylized poster, NOT an in-game screenshot.** Image-gen defaults to a
  mock-up that looks like gameplay; explicitly ask for poster framing or it won't read as a title.

## Do / Don't

**Do**
- Animate locomotion with a video model; keep clips ≤1s; stitch into a `sprite-anim` sheet.
- Pixel-snap every AI sprite before slicing (`assetgen pixelize`).
- Validate bounds + hit-frames in a gym before wiring the asset into a game.
- Persist levels and enemy configs to JSON on disk.

**Don't**
- Image-gen a walk cycle and hope the spacing is even — it won't be.
- Base collision on the full frame (floating characters) or the full attack frame (phantom hits).
- Let the parallax near-layer compete with the playable layer.
- Hardcode level layout, frame sizes, or enemy tunables in gameplay code.

## Related skills

- **game-asset-pipeline** — the `assets.json` manifest, the `sprite-anim` schema, the loader, and
  the generation toolbox. Generate + register there; animate + validate here.
- **sprite-concept-batches**, **sprite-asset-promotion** — batch concept exploration and promoting
  drafts to finals.
- **fps-arena** — consumes animated **billboard** sprites in the Three.js engine (DOOM-style).
- **shipshit-engine** — `GameContext`/`GameSystems`; gyms are standalone harnesses against the same systems.
- **vibe-game-workflow** — where this fits the overall feature-by-feature build loop.
