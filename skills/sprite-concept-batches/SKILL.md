---
name: sprite-concept-batches
description: Generate repeatable lore-backed 2D sprite concept batches for Ship Shit Games characters, enemies, pilots, ships, and bosses. Use when creating first-pass sprite concepts, style variants, faction roster batches, prompt sets, generation ledgers, or draft image batches before final front/side/back production sprites.
license: MIT
metadata:
  version: "0.1.0"
  tags: "sprites, image-generation, concepts, lore, asset-pipeline"
  author: Ship Shit Games
---

# Sprite Concept Batches

Generate draft sprite concepts from canon targets before producing final game views.
This skill is the repeatable loop for "try variants, compare, iterate" without losing
provenance.

## Contract

Inputs:
- Lore stubs in `lore/Characters/` or `lore/Bestiary/`
- Art rules in `lore/DESIGN.md`, `lore/Art/Character-Sprite-Direction.md`, and `lore/Art/Variation-Matrix.md`
- Target game folder, usually `games/scourge-survivors`

Outputs:
- Chroma-key source images and optional cutout drafts under `src/assets/sprites/drafts/<batch-id>/`
- Prompt batch notes under `lore/Art/Prompt-Batches/`
- Ledger entries in `lore/Art/Generation-History.md`

Creates/Modifies:
- Draft asset files only; never replace runtime sprites in this skill
- Lore prompt/history markdown

External Side Effects:
- Uses image generation tools; no deploys

Confirmation Required:
- Ask before promoting a draft over an existing runtime asset

Delegates To:
- `sprite-asset-promotion` after a concept is approved
- `game-asset-pipeline` when registering finals in `assets.json`

## Workflow

1. Read the canon target.
   - Character: `lore/Characters/<Name>.md`
   - Creature/craft: `lore/Bestiary/<Name>.md`
   - Shared art rules: `lore/DESIGN.md`

2. Choose batch scope.
   - Keep first batches small: 4-8 concepts.
   - Prefer one full-body concept per target before front/side/back turnarounds.
   - Use front/side/back only after a design is approved.

3. Name the batch.
   - Format: `YYYY-MM-DD-<theme>`
   - Example: `2026-06-03-first-concepts`
   - Save drafts to `src/assets/sprites/drafts/<batch-id>/`.

4. Build prompts from the target stubs.
   - Include role, gameplay read, visual motifs, sprite brief, and prompt seed.
   - Add the design suffix from `lore/DESIGN.md`: dark, gritty, DOOM-like, blood/rust/gunmetal/bone/hellfire, high contrast, no neon.
   - For Scourge targets, make parasite/host takeover mandatory: invasive tendrils,
     ruptured host tissue, chitin over stolen bone/metal, fused wreckage, embedded breach
     cores. Avoid generic standalone demons or aliens.
   - For Scourge targets, choose and record a host family from `lore/Bestiary/Scourge-Host-Families.md`.
     Default to Rot-Infested Flesh Host for the first Scourge Survivors batch, then vary
     Chitin Warhost, Mycelial Spore Host, Machine-Graft Host, Bone Titan Host, and Voidship Host.
   - For Scourge only, allow toxic green biology; do not use magenta/cyan/cyberpunk glow.

5. Generate sources.
   - Use a perfectly flat `#00ff00` chroma-key background.
   - Save generated originals from `$CODEX_HOME/generated_images/...` into the draft batch.
   - Keep rejected variants when they teach a useful constraint, suffixing with `-rejected-<reason>-source.png`.

6. Create draft cutouts if possible.
   - Use `sprite-asset-promotion` for repeatable cutout/alpha checks.
   - Draft cutouts are for review only; they are not runtime assets.

7. Inspect and score.
   - Role readability
   - Faction readability
   - Sprite usability
   - Canon fit
   - Prompt drift

8. Log every serious output.
   - Append to `lore/Art/Generation-History.md`.
   - Include prompt summary, source path, workspace path, post-processing, notes, and decision.

## Prompt Shape

Use this structure for each target:

```text
Use case: stylized-concept
Asset type: 2D game character/enemy concept sprite, full-body cutout for <game>.
Primary request: Create one full-body concept sprite for <canon target>, <role>.

Style: dark, gritty, DOOM-like game sprite rendering; blood, rust, gunmetal, bone,
hellfire ember light, grimy industrial surfaces, high contrast, heavy shadows, NO neon;
sharp painterly game asset, not pixel art, not photorealistic.

Character/Creature design: <from lore stub prompt seed + gameplay read>. For Scourge,
state the host family and show the parasite wearing, consuming, or rewriting that host/medium.

Composition: single centered full-body pose, three-quarter front concept angle, feet/claws
visible and aligned to one ground baseline, generous padding, readable at small game size.

Background/removal requirements: perfectly flat solid #00ff00 chroma-key background for
background removal. One uniform color. No shadows, gradients, texture, reflections, floor
plane, watermark, UI, text, or cropped feet.

Avoid: <target-specific drift risks>.
```

## Batch Notes

Create `lore/Art/Prompt-Batches/<batch-id>.md` for batch-level notes:

```markdown
# <Batch ID>

## Targets
- [[Ranger]]
- [[Bulwark]]

## Shared Prompt Rules
- DOOM-like blood/rust/gunmetal/bone/hellfire.
- No neon.
- Flat #00ff00 source background.

## Results
| Target | Host Family | Source | Cutout | Decision | Notes |
| --- | --- | --- | --- | --- | --- |
```

## Do / Don't

Do:
- Generate concepts against lore stubs, not loose vibes.
- Keep originals and cutouts separate.
- Log rejected variants when they reveal useful prompt constraints.
- Stop after concepts until a human picks winners.

Don't:
- Replace runtime assets from this skill.
- Generate front/side/back for an unapproved design.
- Leave generated files only under `$CODEX_HOME/generated_images`.
- Use `#00ff00` inside the subject; it breaks chroma-key removal.
