---
name: game-asset-pipeline
description: Use when generating, optimizing, or wiring 3D models/sprites/textures/audio into a Ship Shit Games title — defines the assets.json manifest as the single source of truth, the loader that reads it, the AI generation toolbox per asset type, and the mandatory per-asset license record.
license: MIT
metadata:
  version: "0.1.0"
  tags: "assets, asset-pipeline, ai-generation, gltf, sprites"
  author: Ship Shit Games
---

# Game asset pipeline

Every studio game treats content as **data**: an `assets.json` manifest is the single
source of truth, and code references assets by **id** — never by hardcoded path,
frame size, or scale. This is the asset-side counterpart to the data-driven
content rule (numbers in `constants.ts`, tables in `data/*.ts`).

The pipeline is always the same five steps:

> **generate (AI) -> post-process -> optimize -> register in manifest -> hot-preview**

Skipping "register in manifest" is the most common mistake. Do not import asset
files directly into systems.

## Why a manifest (the sprite-frame bug class)

In the current scourge-survivors the metadata is scattered: textures are imported one-by-one
in `src/game/spriteAssets.ts`, weapon scales live in `src/game/data/internalTypes.ts`
(`WEAPON_SPRITE_CONFIG`), and enemy per-view scales are hardcoded inline in
`src/game/entities/Enemy.ts` (`spriteScale()`). That fragmentation is exactly what
the manifest fixes. When the size/frame data lives next to the path:

- Frame size and frame count travel **with** the spritesheet, so an artist re-export
  with a different cell size can't silently desync the slicing math (the classic
  "sprite shows half of two frames" bug).
- A missing/renamed file fails **loudly at load** with the offending id, instead of a
  silent black texture three systems away.
- Anchor, color space, and wrap mode are declared once, not re-set at every call site.
- Every asset carries a `license` record (see below).

`@shipshitgames/engine` will export the `AssetCatalog`; scourge-survivors is the proof. New games
start manifest-first.

## File layout

```
src/
  assets/
    assets.json          # the manifest — single source of truth
    sprites/*.webp        # 2D sprites + spritesheets
    textures/*.webp       # tiling material textures
    models/*.glb          # OPTIMIZED glb (Draco + KTX2)
    audio/{sfx,music,voice}/*.webm
  game/
    assets/AssetCatalog.ts # loader: the ONLY code that resolves a path
```

## Manifest schema

See `reference/assets.json` for a full example. Required on every entry: `id`,
`type`, `path`, `license`. Per type:

| type | key extra fields |
| --- | --- |
| `sprite` | `dimensions`, `anchor`, `scale` (and/or `views: {front,side,back}` each with its own `path`+`scale`) |
| `sprite-anim` | `frames`, `frameSize`, `fps`, `loop`, `anchor` |
| `texture` | `dimensions`, `colorSpace`, `wrap`, `repeat` |
| `model` | `optimized: true`, `compression: {geometry,textures}`, `animations[]` |
| `audio` | `category: sfx\|music\|voice`, `volume`, `loop` |

`id` is the contract: stable, kebab-case, referenced from gameplay code. `path` is
manifest-relative (resolved through Vite's `import.meta.glob`, so hashing/bundling
still works).

## The loader

`reference/loadManifest.ts` is a copy-paste `AssetCatalog`. Construct it once, hand it
to the `GameContext`, and let systems pull by id:

```ts
// in a system constructor
const tex = this.ctx.assets.texture('enemy-melee', 'side')
const [w, h] = this.ctx.assets.spriteScale('enemy-melee', 'side')
this.sprite.scale.set(w * flip, h, 1)

const boss = await this.ctx.assets.model('boss-mech') // Draco+KTX2 decoded for you
```

The catalog validates ids at construction (duplicate id = throw), resolves paths
through `import.meta.glob`, caches textures, and wires `DRACOLoader` + `KTX2Loader`
into the `GLTFLoader` so optimized `.glb` files "just work".

## Generation toolbox by asset type

Pick the cheapest tool that clears the quality bar, then optimize. **Verify pricing
and the newest model names live — this landscape moves monthly.**

- **3D models** — Meshy or Tripo (text/image -> 3D, GLB export). Meshy covers the most
  steps in one platform (built-in rig + animation library); Tripo's Smart Mesh gives
  cleaner topology. Hero/animated assets still need human cleanup.
- **Rigging / animation** — Tripo or Meshy auto-rig; for humanoids, Mixamo for the
  retarget + animation clips. Record the rig source in `license.rig`.
- **3D optimization (MANDATORY for web)** — `gltf-transform optimize` with Draco
  geometry compression **and** KTX2/Basis texture compression. Raw GLB is never
  shipped. See command below; never set `optimized: true` without running it.
- **2D sprites / sprite animations** — PixelLab (pixel/sprite-native, multi-view +
  walk cycles), Scenario or Layer (style-consistent sheets), fal.ai (fast generic
  image gen) as a fallback.
- **UI / icons** — Recraft or Ideogram (clean vector-ish icons, reliable text).
- **Textures (tiling materials)** — Leonardo for base art; Materialize or Substance
  to derive normal/roughness/AO and make it tile.
- **Music** — Soundraw or Beatoven (clean **perpetual** commercial license).
  **AVOID Udio** (license uncertainty). ElevenLabs Music: trailers/marketing only,
  not in-game loops.
- **SFX** — ElevenLabs SFX or OptimizerAI. Export, normalize, encode to `.webm`.
- **Voice** — ElevenLabs v3.

## 3D optimization command (mandatory)

```bash
# Draco geometry + KTX2/Basis textures; raw glb in, web-ready glb out.
npx @gltf-transform/cli optimize raw/boss-mech.glb src/assets/models/boss-mech.glb \
  --texture-compress ktx2 --compress draco
# then mark optimized: true and add compression metadata in assets.json
```

KTX2 textures upload straight to the GPU (no CPU decode) and cut VRAM ~4-8x vs
PNG/JPEG; Draco shrinks geometry ~60-90%. Both are non-negotiable for browser games.

2D/texture rule of thumb: ship **.webp** (sprites/UI) and **.webm/opus** (audio);
keep textures at power-of-two dimensions; raw PSD/PNG masters live outside `src/`.

## Do / Don't

**Do**
- Add an entry to `assets.json` for every asset, with a `license` record, before
  referencing it.
- Reference assets by `id`; get scale/frame/anchor metadata from the catalog.
- Run `gltf-transform optimize` (Draco + KTX2) on every model before `optimized: true`.
- Encode finals (`.webp`, `.webm`); keep masters out of the bundle.

**Don't**
- `import bossUrl from '../assets/...'` inside a system (legacy pattern — migrate it).
- Hardcode frame sizes, scales, or anchors in gameplay code.
- Ship a raw `.glb`, `.png` texture, or `.wav`.
- Use Udio for in-game music, or ElevenLabs Music for in-game loops.
- Generate an asset without logging its tool + plan tier + date.

## Common bugs

- **Half-frame / smeared sprite** — `frameSize` in the manifest doesn't match the
  spritesheet cell size after a re-export. Fix the manifest, never the slicing math.
- **Black / invisible mesh** — KTX2/Draco loaders not attached to `GLTFLoader`, or
  the model was shipped un-optimized while the loader expects KTX2. The catalog wires
  both; don't construct a bare `GLTFLoader`.
- **Color washed out** — texture `colorSpace` wrong. Color/albedo = `srgb`;
  data maps (normal/roughness/AO) = `linear`. Declared in the manifest, set once.
- **Tiling seam** — `wrap` not `repeat` or non-power-of-two source dimensions.
- **Silent missing asset** — only happens when code bypasses the catalog. Going
  through `assets.json` turns it into a load-time throw naming the id.
- **License gap** — an asset with no `license` record. Raw AI output is **not
  US-copyrightable** and tool terms shift monthly; an unrecorded asset is a legal
  unknown you cannot audit later.

## License record (keep it per-asset)

Every entry carries `license: { tool, plan, date, kind, scope?, rig? }`. Record it at
generation time — you cannot reconstruct which plan tier produced a file months later,
and the studio ships open-source, so the provenance trail must be auditable. Treat the
manifest's license fields as the studio's content ledger.

## Worked example: add a new enemy sprite

1. Generate front/side/back in PixelLab (Pro). Post-process to 512x512, transparent bg.
2. Export each as `.webp` into `src/assets/sprites/` (`enemy-drone{,-side,-back}.webp`).
3. Register one entry, `type: "sprite"`, with `views` (each path + `scale`) and a
   `license` record. No optimize step for 2D beyond `.webp`.
4. In `Enemy.ts`, swap the hardcoded scale + import for
   `this.ctx.assets.texture('enemy-drone', view)` and
   `this.ctx.assets.spriteScale('enemy-drone', view)`.
5. Hot-preview: Vite HMR re-picks the manifest; the drone renders with correct frames.

## Related skills

- **shipshit-engine** — `GameContext`/`GameSystems` registry that owns the `AssetCatalog`.
- **fps-arena** — the reference game consuming these sprites and textures.
- **tower-defense-3d**, **isometric-3d** — sibling games that reuse this manifest+loader.
- **game-asset-pipeline** consumers wire audio via the same catalog; see **partykit-multiplayer**
  for syncing avatar ids across clients.
- **vibe-game-workflow** — where generate/optimize/register fits the streamed build loop.
- **playwright-game-testing** — assert assets load (no missing-id throws) in CI.
