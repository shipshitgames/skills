# Do and Don't — Authoring Game Skills

## Do

- Ground every pattern in the canonical `fpsdemo`; cite real files by path.
- Teach the `GameContext` / `GameSystems` registry + data-driven conventions.
- Front-load `description` with WHAT + WHEN (this single line is the trigger).
- Put `version`/`tags` inside the `metadata:` block as quoted strings.
- Prefer real TypeScript snippets over prose; include a Do/Don't list and a common-bugs section.
- End with a `## Related skills` section linking siblings.

## Don't

- Don't recommend react-three-fiber as the default — we use **imperative Three.js**.
- Don't hardcode asset paths — use `assets.json` (see `game-asset-pipeline`).
- Don't allocate in hot paths — reuse scratch vectors on the context.
- Don't use top-level `version`/`tags`, or `auto_activate`/`auto_trigger`/`risk` fields.
- Don't hide update order behind a generic `for (system of systems)` loop — keep it explicit.
