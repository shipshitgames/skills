---
name: playwright-game-testing
description: Give a coding agent eyes on a Ship Shit browser game — boot the Vite dev server, drive the imperative-Three.js game with Playwright (click-to-pointer-lock, WASD/mouse/keys), screenshot the WebGL canvas, assert on HUD state, diff screenshots across runs, and run an autonomous screenshot→diagnose→fix→re-screenshot loop. Use whenever you need to verify a visual/gameplay change, reproduce a visual bug, or self-correct without a human looking at the screen.
license: MIT
metadata:
  version: "0.1.0"
  tags: "testing, playwright, visual-testing, game-dev"
  author: Ship Shit Games
---

# Playwright Game Testing — giving the agent eyes

Our games are imperative Three.js drawing into a single `<canvas>`. Unit tests
can't see pixels and the DOM is mostly an empty WebGL surface. This skill is how
an agent **observes the running game**: boot it, drive it like a player, capture
the canvas, read HUD state, and loop on the result until the change actually
looks/behaves right. It is the load-bearing skill for autonomous visual dev.

Two ways to drive Playwright, use both:

- **Playwright MCP server** — interactive, inside your turn. Navigate, click,
  press keys, `browser_take_screenshot`, look at the image, decide, repeat. This
  is the self-correction loop.
- **Playwright test files** (`@playwright/test`) — committed regression specs in
  `tests/`. Use these to lock in behavior once you've verified it via MCP.

## File layout

```
scourge-survivors/
  playwright.config.ts      # webServer: `npm run dev`, baseURL http://localhost:5173
  tests/
    helpers/harness.ts      # boot + lock + drive + snapshot + screenshot helpers
    fps.spec.ts             # the worked example below
    __screenshots__/        # committed baselines for diffing
```

## What the real game exposes (read before you select)

Grounded in the canonical scourge-survivors — **read these before writing selectors**:

- `vite.config.ts` → dev server is **port 5173**, `host: true`.
- `index.html` → `<title>Scourge Survivors</title>`, app mounts in `#root`.
- `src/App.tsx` → root div has class **`game-root`**; in DEV the game instance is
  published as **`window.__fpsGame`** and audio as `window.__fpsAudio`
  (`if (import.meta.env.DEV) (window).__fpsGame = game`). **These hooks do NOT
  exist in a production build** — always test against `npm run dev`.
- `src/game/render/RenderSystem.ts` → the canvas is `renderer.domElement`,
  appended into `.game-root`. Select it as `.game-root canvas`.
- `src/game/types.ts` → `GameStatus = 'pointerlock-needed' | 'playing' |
  'paused' | 'levelup' | 'gameover'`; `outcome: 'win' | 'dead' | null`.
- `src/components/HUD.tsx` → **there are currently NO `data-testid` attributes.**
  Select by visible text / role: buttons read **"Modes"**, **"Survivors"**,
  **"Play"**, **"Multiplayer"**, **"⚔ Join Room"**; the crosshair renders only
  while `status === 'playing'`; game-over shows **"GAME OVER"** or **"VICTORY"**.
  The menu overlay is the only thing with `pointer-events-auto` until you lock.

> **Do this once, early:** add `data-testid` to the handful of elements you
> assert on (status overlays, stat values, action buttons). Text/emoji selectors
> are brittle — they break the moment someone tweaks copy. See Do/Don't.

## The two assertion channels

1. **HUD state (deterministic, fast).** The game pushes a `HUDState` snapshot to
   React every frame. Don't scrape numbers out of styled divs — read the
   structured state. Add a tiny dev hook (in `App.tsx`, DEV-only) so tests can
   grab the latest snapshot synchronously:

   ```ts
   // App.tsx, inside the effect that creates the Game, DEV only:
   if (import.meta.env.DEV) {
     ;(window as any).__hudSnapshot = () => hudRef.current      // latest HUDState
   }
   // keep hudRef updated alongside setHud: hudRef.current = next
   ```

   Then in a test: `const s = await page.evaluate(() => (window as any).__hudSnapshot())`.
   Assert on `s.status`, `s.kills`, `s.playerHealth`, `s.enemiesAlive`, etc.

2. **Pixels (the actual look).** Screenshot the canvas and either eyeball it (MCP)
   or diff against a baseline (`toHaveScreenshot`). Use this for "did the muzzle
   flash render", "is the arena lit", "is the enemy on screen".

## Driving the game

```ts
// 1. Boot — wait for the menu overlay, not just load.
await page.goto('/')
await page.getByText('SCOURGE SURVIVORS').waitFor()        // the <h1>

// 2. Acquire pointer lock — MUST be a real click on the canvas (user gesture).
//    Calling game.requestLock() from page.evaluate() is rejected by the browser.
await page.locator('.game-root canvas').click()

// 3. Move / look / shoot. Pointer lock means mouse deltas, use mouse.move steps.
await page.keyboard.down('KeyW')                   // walk forward
await page.waitForTimeout(400)
await page.keyboard.up('KeyW')
await page.mouse.move(120, 0)                       // turn right (relative delta)
await page.mouse.down(); await page.mouse.up()      // fire (L-click)
await page.keyboard.press('KeyR')                   // reload
await page.keyboard.press('Escape')                 // pause
```

Key map (from `HUD.tsx` controls panel): **WASD** move, **Mouse** look,
**L-Click** fire, **R-Click / F** melee, **1–4** weapon, **Space** jump,
**R** reload, **Esc** pause/resume.

### Starting a run deterministically

Menus are React, so click them by text. To skip menu flakiness in regression
specs, drive the **public Game API** through the DEV hook *after* a real
lock-click (the click is the gesture; the API call just changes mode):

```ts
await page.locator('.game-root canvas').click()                 // lock (gesture)
await page.evaluate(() => (window as any).__fpsGame.startSurvivors())
await page.waitForFunction(() => (window as any).__hudSnapshot().status === 'playing')
```

Public methods (from `Game.ts`): `requestLock()`, `start()`, `restart()`,
`startCampaign(mapId?)`, `startSurvivors()`, `startMultiplayer(room,name,avatar)`,
`leaveMultiplayer()`, `pickUpgrade(id)`, `returnToMenu()`.

## Screenshotting the WebGL canvas

A plain `canvas.screenshot()` can come back **black** because Three.js clears the
drawing buffer after each frame. Two fixes:

- **Preferred:** the renderer is created in `RenderSystem.setupRenderer()`. For
  test builds enable `preserveDrawingBuffer: true` in the `WebGLRenderer` options
  (cheap, and only matters when you're capturing).
- **Or** capture inside a rAF callback right after a render, via the page's own
  `toDataURL`. The harness helper below does the robust version.

```ts
// Whole viewport (HUD + canvas) — best for diffing the composited frame:
await expect(page).toHaveScreenshot('survivors-firing.png', { maxDiffPixels: 800 })

// Just the canvas region:
await expect(page.locator('.game-root canvas')).toHaveScreenshot('arena.png')
```

`maxDiffPixels`/`maxDiffPixelRatio` matter: WebGL is non-deterministic across
GPUs and AA. Pin a generous threshold and a fixed `viewport` so baselines are
comparable run-to-run.

## The autonomous loop (MCP)

This is the whole point — close the loop without a human:

1. **Boot + screenshot.** `browser_navigate` to `localhost:5173`, click the
   canvas, start a run, `browser_take_screenshot`.
2. **Diagnose.** Look at the image. Cross-check with
   `__hudSnapshot()` (e.g. screen looks empty but `enemiesAlive: 7` → a render
   bug, not a spawn bug; `playerHealth` dropping with no enemy visible → AI/melee
   range bug).
3. **Fix.** Edit the offending system (`render/`, `entities/`, etc.).
4. **Re-screenshot.** Vite HMR reloads; re-run steps 1–2. Repeat until the pixels
   and the snapshot agree with the intended change.

Always pair a screenshot with a snapshot read — pixels tell you *what looks
wrong*, the HUDState tells you *which system to suspect*.

## Worked example

`tests/fps.spec.ts` (full version in `reference/fps.spec.ts`):

```ts
import { test, expect } from '@playwright/test'

test('survivors: firing into the swarm scores a kill', async ({ page }) => {
  await page.goto('/')
  await page.getByText('SCOURGE SURVIVORS').waitFor()

  // Real click = pointer-lock gesture, then jump straight into a run.
  await page.locator('.game-root canvas').click()
  await page.evaluate(() => (window as any).__fpsGame.startSurvivors())
  await page.waitForFunction(() => (window as any).__hudSnapshot()?.status === 'playing')

  const before = await page.evaluate(() => (window as any).__hudSnapshot())
  expect(before.survivors).toBe(true)

  // Survivors swarms you fast; spray for a couple of seconds.
  for (let i = 0; i < 12; i++) {
    await page.mouse.down(); await page.mouse.up()
    await page.mouse.move(8, 0)            // small sweep so we sample the arc
    await page.waitForTimeout(120)
  }

  // HUD must reflect at least one kill (or visible enemies present to shoot).
  await expect.poll(async () =>
    (await page.evaluate(() => (window as any).__hudSnapshot())).kills,
  ).toBeGreaterThan(before.kills)

  // And the composited frame should still be rendering the arena, not black.
  await expect(page).toHaveScreenshot('survivors-firing.png', { maxDiffPixels: 1200 })
})
```

## Do / Don't

**Do**
- Run against `npm run dev` (port 5173). The `__fpsGame` / `__hudSnapshot` hooks
  are DEV-only (`import.meta.env.DEV`); the production build won't have them.
- Click the canvas with a real Playwright click to get pointer lock.
- Assert on the structured `HUDState` snapshot, not scraped DOM text.
- Pin `viewport` and a `maxDiffPixels` threshold for screenshot diffs.
- Add `data-testid` to the elements you assert on, and to the canvas
  (`<canvas data-testid="game-canvas">` via RenderSystem). Commit that first.
- Pair every screenshot with a snapshot read when diagnosing.

**Don't**
- Don't call `requestLock()` / `startX()` *before* a user-gesture click — the
  Pointer Lock API rejects programmatic locks without a gesture.
- Don't `waitForTimeout` as your only synchronization — prefer
  `waitForFunction(() => __hudSnapshot().status === 'playing')` and `expect.poll`.
- Don't screenshot a WebGL canvas without `preserveDrawingBuffer` (or an in-rAF
  capture) — you'll get a black image and chase a phantom render bug.
- Don't select by deep Tailwind class strings — they churn. Use text/role/testid.
- Don't commit screenshot baselines taken on a different GPU/headed-vs-headless
  without re-generating; AA differences will fail the diff.

## Common bugs (read this when a test is flaky)

- **Black screenshot.** Drawing buffer not preserved, or you captured between
  frames / before the first render. Enable `preserveDrawingBuffer` or capture
  in rAF; also `waitForFunction(status==='playing')` before shooting.
- **Pointer lock never acquired.** No user gesture (you evaluated `requestLock`),
  or the canvas wasn't actually under the click point (menu overlay still on top
  with `pointer-events-auto`). Click `.game-root canvas` only after the overlay
  is dismissable.
- **`__fpsGame` is undefined.** You're on a production/preview build, or the page
  hasn't finished mounting. Gate on `waitForFunction(() => !!window.__fpsGame)`.
- **`kills` never increments.** In Survivors enemies spawn over time — poll for a
  few seconds. If `enemiesAlive > 0` but you can't hit them, you're aiming away;
  the camera faces -Z at spawn, sweep the mouse. If `enemiesAlive` stays 0 the
  director isn't spawning — that's a real gameplay bug, not a test bug.
- **Diff fails by a few hundred px every run.** Animations (crosshair, muzzle
  flash, damage numbers) are live. Screenshot a quiescent moment, mask animated
  regions, or raise `maxDiffPixels`. The `hud-paused` class freezes HUD anims —
  pause (`Escape`) before a deterministic HUD screenshot.
- **Audio autoplay warnings spam the console.** Expected — `audio.unlock()` runs
  on the lock click. Filter them out of console assertions.

## Related skills

- **fps-arena** — the game these tests drive; selectors, modes, HUD states.
- **shipshit-engine** — the `GameContext` / `GameSystems` shape and the
  `StateListener` HUD-snapshot pattern these assertions rely on.
- **vibe-game-workflow** — where the screenshot→diagnose→fix loop sits in the
  overall dev loop.
- **partykit-multiplayer** — driving two pages for multiplayer/PvP tests.
- **game-asset-pipeline** — verifying assets actually rendered (no missing-texture
  magenta) via canvas screenshots.
</skillMd>
<parameter name="extraFiles">[{"relPath":"reference/fps.spec.ts","content":"// Reference Playwright regression spec for the Ship Shit FPS (scourge-survivors).\n//\n// Run against the DEV server (npm run dev, port 5173) so the DEV-only debug\n// hooks (window.__fpsGame / window.__hudSnapshot) exist. See playwright.config\n// below the spec for the matching config.\n//\n//   npm i -D @playwright/test && npx playwright install chromium\n//   npx playwright test\n\nimport { test, expect, type Page } from '@playwright/test'\n\n// ---- tiny inline harness (or import from helpers/harness.ts) -----------------\n\ntype HudSnapshot = {\n  status: 'pointerlock-needed' | 'playing' | 'paused' | 'levelup' | 'gameover'\n  outcome: 'win' | 'dead' | null\n  kills: number\n  headshots: number\n  score: number\n  playerHealth: number\n  enemiesAlive: number\n  survivors: boolean\n  level: number\n}\n\nasync function snapshot(page: Page): Promise<HudSnapshot> {\n  return page.evaluate(() => (window as any).__hudSnapshot())\n}\n\n// Boot the app and wait for the menu + the DEV game hook to be live.\nasync function boot(page: Page) {\n  await page.goto('/')\n  await page.getByText('SCOURGE SURVIVORS').waitFor()\n  await page.waitForFunction(() => !!(window as any).__fpsGame)\n}\n\n// Pointer lock requires a real user gesture: physically click the canvas.\n// (Calling requestLock() from evaluate() is rejected by the browser.)\nasync function lock(page: Page) {\n  await page.locator('.game-root canvas').click()\n}\n\nasync function waitForStatus(page: Page, status: HudSnapshot['status']) {\n  await page.waitForFunction(\n    (s) => (window as any).__hudSnapshot()?.status === s,\n    status,\n  )\n}\n\n// -----------------------------------------------------------------------------\n\ntest.describe('Scourge Survivors', () => {\n  test.use({ viewport: { width: 1280, height: 720 } })\n\n  test('boots to the main menu', async ({ page }) => {\n    await boot(page)\n    const s = await snapshot(page)\n    expect(s.status).toBe('pointerlock-needed')\n    await expect(page.getByText('SCOURGE SURVIVORS')).toBeVisible()\n  })\n\n  test('survivors: firing into the swarm scores a kill and keeps rendering', async ({ page }) => {\n    await boot(page)\n    await lock(page)                                       // user-gesture lock\n    await page.evaluate(() => (window as any).__fpsGame.startSurvivors())\n    await waitForStatus(page, 'playing')\n\n    const before = await snapshot(page)\n    expect(before.survivors).toBe(true)\n    expect(before.status).toBe('playing')\n\n    // Spray + sweep so we sample the firing arc; swarms spawn over time.\n    for (let i = 0; i < 14; i++) {\n      await page.mouse.down()\n      await page.mouse.up()\n      await page.mouse.move(8, 0)\n      await page.waitForTimeout(120)\n    }\n\n    await expect\n      .poll(async () => (await snapshot(page)).kills, { timeout: 8000 })\n      .toBeGreaterThan(before.kills)\n\n    // Composited frame must still be drawing the arena (not a black buffer).\n    // Requires preserveDrawingBuffer in the renderer for a non-black capture.\n    await expect(page).toHaveScreenshot('survivors-firing.png', { maxDiffPixels: 1200 })\n  })\n\n  test('campaign: Escape pauses and resume returns to play', async ({ page }) => {\n    await boot(page)\n    await lock(page)\n    await page.evaluate(() => (window as any).__fpsGame.startCampaign())\n    await waitForStatus(page, 'playing')\n\n    await page.keyboard.press('Escape')\n    await waitForStatus(page, 'paused')\n    await expect(page.getByText('Paused')).toBeVisible()\n\n    await page.getByRole('button', { name: /Resume/ }).click()\n    await waitForStatus(page, 'playing')\n  })\n})\n"},{"relPath":"reference/harness.ts","content":"// Reusable Playwright harness for driving a Ship Shit imperative-Three.js game.\n// Import into specs: `import { boot, lock, startSurvivors, snapshot } from './helpers/harness'`\n//\n// Assumes the DEV server (npm run dev) so window.__fpsGame and __hudSnapshot\n// exist (both gated on import.meta.env.DEV in App.tsx).\n\nimport { expect, type Page } from '@playwright/test'\n\nexport type HudSnapshot = {\n  status: 'pointerlock-needed' | 'playing' | 'paused' | 'levelup' | 'gameover'\n  outcome: 'win' | 'dead' | null\n  kills: number\n  headshots: number\n  score: number\n  playerHealth: number\n  maxPlayerHealth: number\n  enemiesAlive: number\n  ammo: number\n  reserve: number\n  wave: number\n  survivors: boolean\n  multiplayer: boolean\n  level: number\n}\n\nexport const CANVAS = '.game-root canvas'\n\n/** Navigate to the app and wait for the menu + the DEV game hook. */\nexport async function boot(page: Page): Promise<void> {\n  await page.goto('/')\n  await page.getByText('SCOURGE SURVIVORS').waitFor()\n  await page.waitForFunction(() => !!(window as any).__fpsGame)\n}\n\n/** Acquire pointer lock. MUST be a real click (user gesture) on the canvas. */\nexport async function lock(page: Page): Promise<void> {\n  await page.locator(CANVAS).click()\n}\n\nexport async function snapshot(page: Page): Promise<HudSnapshot> {\n  return page.evaluate(() => (window as any).__hudSnapshot())\n}\n\nexport async function waitForStatus(page: Page, status: HudSnapshot['status']): Promise<void> {\n  await page.waitForFunction((s) => (window as any).__hudSnapshot()?.status === s, status)\n}\n\n// --- mode launchers (lock first, these only switch mode) ---------------------\n\nexport async function startSurvivors(page: Page): Promise<void> {\n  await lock(page)\n  await page.evaluate(() => (window as any).__fpsGame.startSurvivors())\n  await waitForStatus(page, 'playing')\n}\n\nexport async function startCampaign(page: Page, mapId?: string): Promise<void> {\n  await lock(page)\n  await page.evaluate((id) => (window as any).__fpsGame.startCampaign(id), mapId)\n  await waitForStatus(page, 'playing')\n}\n\n// --- input helpers -----------------------------------------------------------\n\n/** Fire a burst, optionally sweeping the aim each shot. */\nexport async function fire(page: Page, shots = 1, sweepX = 0): Promise<void> {\n  for (let i = 0; i < shots; i++) {\n    await page.mouse.down()\n    await page.mouse.up()\n    if (sweepX) await page.mouse.move(sweepX, 0)\n    await page.waitForTimeout(100)\n  }\n}\n\n/** Hold a movement key for `ms` then release. e.g. move(page, 'KeyW', 500). */\nexport async function move(page: Page, key: string, ms: number): Promise<void> {\n  await page.keyboard.down(key)\n  await page.waitForTimeout(ms)\n  await page.keyboard.up(key)\n}\n\n/** Turn by a relative mouse delta (pointer lock -> deltas, not absolute). */\nexport async function look(page: Page, dx: number, dy = 0): Promise<void> {\n  await page.mouse.move(dx, dy)\n}\n\n// --- visual assertions -------------------------------------------------------\n\n/**\n * Robust canvas capture as a data URL. Use when preserveDrawingBuffer is OFF:\n * captures inside a rAF right after a render so the buffer is intact.\n */\nexport async function captureCanvasDataUrl(page: Page): Promise<string> {\n  return page.evaluate(\n    (sel) =>\n      new Promise<string>((resolve) => {\n        const c = document.querySelector(sel) as HTMLCanvasElement\n        requestAnimationFrame(() => resolve(c.toDataURL('image/png')))\n      }),\n    CANVAS,\n  )\n}\n\n/** Pause (freezes HUD anims via .hud-paused) for a deterministic HUD diff. */\nexport async function pauseForScreenshot(page: Page): Promise<void> {\n  await page.keyboard.press('Escape')\n  await waitForStatus(page, 'paused')\n}\n\n/** Whole-viewport screenshot diff with sane WebGL defaults. */\nexport async function expectFrame(page: Page, name: string, maxDiffPixels = 1000): Promise<void> {\n  await expect(page).toHaveScreenshot(name, { maxDiffPixels })\n}\n"}]