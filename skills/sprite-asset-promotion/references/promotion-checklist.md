# Sprite Promotion Checklist

Before replacing a runtime sprite:

- Approved concept is linked from `lore/Art/Generation-History.md`.
- Source PNG is preserved in `src/assets/sprites/drafts/`.
- Final image has alpha.
- Corners are transparent.
- Feet/claws are not cropped.
- The silhouette is readable at target game scale.
- Filename follows existing runtime convention.
- Existing file overwrite was explicitly approved.
- `assets.json` or legacy imports were updated.
- `npm run typecheck` and `npm run build` pass.
- A visual preview was taken when possible.
