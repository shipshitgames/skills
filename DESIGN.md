---
version: 0.1.0
name: Ship Shit Games
description: >-
  DOOM-grade visual identity for the Ship Shit Games universe — brutal, metal,
  blood, and hellfire. Dark, heavy, high-contrast. Not neon, not clean sci-fi.
colors:
  void: "#0a0a0a"
  coal: "#121214"
  iron: "#1e1e22"
  gunmetal: "#34343c"
  blood: "#c1121f"
  bloodHot: "#ff2a18"
  hellfire: "#ff6a00"
  rust: "#8a4b2a"
  bone: "#e9e3d6"
  ash: "#9b958a"
  toxic: "#8bdc1f"
typography:
  display:
    fontFamily: "Oswald, 'Arial Narrow', 'Helvetica Neue', sans-serif"
    fontWeight: 700
    letterSpacing: "-0.01em"
    textTransform: "uppercase"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontWeight: 400
    lineHeight: 1.6
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, monospace"
rounded:
  none: "0px"
  sm: "2px"
  md: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
elevation:
  flat: "none"
  ember: "0 0 0 1px rgba(255,106,0,0.35), 0 0 26px -6px rgba(193,18,31,0.65)"
components:
  button.primary:
    background: "{colors.blood}"
    color: "{colors.bone}"
    rounded: "{rounded.sm}"
    hoverShadow: "{elevation.ember}"
  button.ghost:
    border: "{colors.hellfire}"
    color: "{colors.hellfire}"
    rounded: "{rounded.sm}"
  card:
    background: "{colors.coal}"
    border: "{colors.gunmetal}"
    rounded: "{rounded.sm}"
  badge.playable: { border: "{colors.hellfire}", color: "{colors.hellfire}" }
  badge.inDev: { border: "{colors.blood}", color: "{colors.blood}" }
  badge.concept: { border: "{colors.gunmetal}", color: "{colors.ash}" }
---

# Overview

The single source of design truth for **everything** — the website, every game's HUD and
menus, and every AI-generated asset. The aesthetic is **DOOM**: brutal, metal, blood, and
hellfire. Dark, heavy, gritty, high-contrast. This supersedes the earlier "neon-industrial"
direction — there is **no magenta/cyan neon**. An agent that reads this file should produce
black-void surfaces, gunmetal panels, bone headlines in heavy uppercase Oswald, and
blood-red call-to-action buttons with an ember glow. The lore [[Style-Bible]] points here.

## Colors

| Token | Hex | Use |
|-------|-----|-----|
| `void` | `#0a0a0a` | page / scene background |
| `coal` | `#121214` | panels, cards |
| `iron` | `#1e1e22` | raised surfaces |
| `gunmetal` | `#34343c` | borders, dividers, metal |
| `blood` | `#c1121f` | **primary** — danger, CTAs, kills |
| `bloodHot` | `#ff2a18` | hot / hover states |
| `hellfire` | `#ff6a00` | secondary — embers, highlights |
| `rust` | `#8a4b2a` | grime, texture, muted accent |
| `bone` | `#e9e3d6` | headings / strong text |
| `ash` | `#9b958a` | body / dim text |
| `toxic` | `#8bdc1f` | **the Scourge only** — sickly bio-glow, sparingly |

Rule: **red + fire + metal + bone.** Toxic-green is reserved for the Scourge. Never neon.

## Typography

- **Display** — Oswald 700, UPPERCASE, tight tracking. Militaristic, heavy. Titles, HUD labels.
- **Body** — Inter 400/600. Utilitarian, legible.
- **Mono** — system monospace. Counters, ammo, timers, HUD numerics.

## Layout

- Centered max-width containers (~`72rem` for marketing); generous vertical rhythm from the
  `spacing` scale. Card grids: 1 col → 2 → 3 at `md`/`lg`.
- In-game: HUD hugs the screen edges; heavy corners; numerics in mono.

## Elevation & Depth

- **No soft neon glow.** Depth comes from value contrast, hard 1–2px borders, and inset
  shadows. The only glow is **ember** (`elevation.ember`) — orange→red — used sparingly on
  hot/active elements (Play buttons, alarms, breach FX).

## Shapes

- Near-square. `rounded.sm` (2px) is the default; `rounded.none` for HUD/industrial chrome.
- Hard edges, riveted/stencilled metal, warning-stripe motifs. No pill/`rounded-2xl` softness.

## Components

- **button.primary** — `blood` bg, `bone` text, `rounded.sm`, `ember` glow on hover. Main CTA.
- **button.ghost** — transparent, `hellfire` border + text. Secondary (e.g. "Source").
- **card** — `coal` bg, `gunmetal` border, `rounded.sm`; hover border → `blood`.
- **badge** — `playable` = hellfire, `inDev` = blood, `concept` = gunmetal/ash.

## Do's and Don'ts

**Do:** lead with red + fire + metal + bone; UPPERCASE Oswald headers; reserve toxic-green
for the Scourge; use ember glow sparingly; keep edges hard and high-contrast.

**Don't:** magenta/cyan or any neon; soft/large glows; pastel or low-contrast text;
heavy rounding; clean/minimal sci-fi. If it doesn't feel like blood on gunmetal, it's wrong.
