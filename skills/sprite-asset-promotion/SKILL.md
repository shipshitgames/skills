---
name: sprite-asset-promotion
description: Promote approved Ship Shit Games sprite drafts into game-ready transparent assets. Use when converting chroma-key sprite concepts into alpha PNG/WebP files, resizing to renderer expectations, replacing placeholder sprites, updating sprite imports or assets.json entries, recording license/provenance, and hot-previewing the result.
license: MIT
metadata:
  version: "0.1.0"
  tags: "sprites, webp, cutout, assets-json, promotion"
  author: Ship Shit Games
---

# Sprite Asset Promotion

Turn an approved concept into a runtime asset. Use this only after `sprite-concept-batches`
has produced a selected design.

## Contract

Inputs:
- Approved source/cutout draft path
- Target runtime asset id or filename
- Current renderer expectations from game code or `assets.json`

Outputs:
- Transparent PNG/WebP final asset in the game asset folder
- Updated import/manifest metadata when needed
- Verification notes and generation ledger update

Creates/Modifies:
- Runtime asset files
- Optional `src/assets/assets.json`, `src/game/spriteAssets.ts`, scale metadata
- `lore/Art/Generation-History.md`

External Side Effects:
- None beyond local files

Confirmation Required:
- Ask before overwriting any existing runtime sprite

Delegates To:
- `game-asset-pipeline` for manifest registration or loader migration
- `playwright-game-testing` for visual/browser verification

## Workflow

1. Confirm the source is approved.
   - Do not promote "interesting" drafts without a decision.
   - Preserve the original generated source.

2. Inspect current runtime requirements.
   - Check dimensions and alpha of the placeholder being replaced.
   - Check view naming: `front`, `side`, `back`, or single arcade sprite.
   - Check hardcoded scale metadata if the game is still legacy-import based.

3. Create or verify alpha.
   - Prefer the script in `scripts/chroma_cutout.sh` for flat green sources.
   - Validate transparent corners and subject coverage.
   - If cutout quality is poor, regenerate or use native transparency tooling before promotion.

4. Resize and encode.
   - Runtime still sprites should ship as `.webp`.
   - Keep source/cutout PNGs in `src/assets/sprites/drafts/`.
   - Match the existing target dimensions unless intentionally changing scale.

5. Promote non-destructively by default.
   - If replacing, confirm with the user first.
   - Otherwise write a versioned filename such as `player-ranger-front-v2.webp`.

6. Register.
   - Manifest-first games: update `src/assets/assets.json` with path, dimensions, views, scale, and license.
   - Legacy games: update `src/game/spriteAssets.ts` imports and any scale tables.
   - Always record license/provenance.

7. Verify.
   - Run typecheck/build.
   - Hot-preview in game when a server is available.
   - Use screenshots for final visual QA when changing visible assets.

8. Log.
   - Append final asset path, processing command, and decision to `lore/Art/Generation-History.md`.

## Commands

Cut out a flat green source:

```bash
skills/skills/sprite-asset-promotion/scripts/chroma_cutout.sh \
  path/to/source.png \
  path/to/cutout.png
```

Inspect image dimensions and alpha:

```bash
sips -g pixelWidth -g pixelHeight -g hasAlpha path/to/image.png
```

Encode a PNG cutout as WebP with alpha:

```bash
ffmpeg -y -i cutout.png -c:v libwebp -lossless 0 -q:v 90 -pix_fmt yuva420p final.webp
```

## Renderer Targets

For the current `scourge-survivors` renderer:

- Player billboard sets: `player-<id>-front.webp`, `player-<id>-side.webp`, `player-<id>-back.webp`.
- Enemy billboard sets: `enemy-<kind>.webp`, `enemy-<kind>-side.webp`, `enemy-<kind>-back.webp`.
- Boss sets: `boss.webp`, `boss-side.webp`, `boss-back.webp`.
- Side views are mirrored in code, so one side view is enough.
- Runtime sprites must have alpha and feet anchored visually to the bottom.
- Scourge runtime sprites must preserve the parasite/host read after resizing.

## Promotion Gates

Do not promote if:
- The subject has cropped feet/claws.
- The cutout has visible green fringe.
- The view does not match current renderer expectations.
- The asset has no provenance record.
- The style violates `lore/DESIGN.md`.
- A Scourge asset loses its parasite/host-takeover read at gameplay size.

Use draft filenames until all gates pass.
