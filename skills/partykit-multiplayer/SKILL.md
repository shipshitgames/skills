---
name: partykit-multiplayer
description: Add real-time multiplayer to a studio Three.js game using PartyKit (Cloudflare) — write the room server, the typed NetClient, remote-avatar interpolation, room codes/share links, and the dev/deploy workflow. Use whenever a game needs networked PvP, shared rooms, or a "join a friend" feature.
license: MIT
metadata:
  version: "0.1.0"
  tags: "multiplayer, netcode, partykit, cloudflare, websockets"
  author: Ship Shit Games
---

# PartyKit multiplayer

Real-time multiplayer for studio games. The transport is **PartyKit** (a Cloudflare
Durable Object behind a WebSocket), wrapped behind a thin typed client so the rest of
the engine never touches the socket. Networking lives in two places:

- `party/<room>.ts` — the **server**: one Durable Object class per room (the "party").
- `src/net/*` — the **client**: `NetClient` (typed event interface over `partysocket`),
  `RemoteAvatar` (the visual + raycast proxy for another player), and `playerAvatars.ts`
  (shared avatar/slot-color data).

The networked game mode is a normal system in `modes/` (see `fps-arena`): it owns the
`NetClient`, maps server messages onto the world, and pushes scoreboard state to the HUD.

Canonical implementation — read these before writing:
- `games/scourge-survivors/party/arena.ts` — authoritative-ish PvP room server
- `games/scourge-survivors/src/net/NetClient.ts` — typed event-interface client + throttling
- `games/scourge-survivors/src/net/RemoteAvatar.ts` — interpolation + billboard nametag/health
- `games/scourge-survivors/src/net/playerAvatars.ts` — slot colors / avatar ids (shared by client + server)
- `games/scourge-survivors/src/game/modes/MultiplayerSystem.ts` — how a system drives the net layer
- `games/scourge-survivors/partykit.json`, `games/scourge-survivors/DEPLOY.md`, `games/scourge-survivors/package.json` — config + workflow

## File layout

```
party/
  arena.ts            # Party.Server class (one per room "type")
partykit.json         # name + main + compatibilityDate
src/net/
  NetClient.ts        # PartySocket wrapper, NetEvents interface, send throttle
  RemoteAvatar.ts     # Three.js proxy for a remote player (lerp + billboard)
  playerAvatars.ts    # PlayerAvatarId, slot colors — imported by BOTH sides
src/game/modes/
  MultiplayerSystem.ts # the game mode that owns the NetClient
```

## Wire protocol

Messages are JSON objects with a one-letter `t` (type) discriminator. Keep keys short
(`x,y,z,yaw`) — every state packet pays the size on the wire ~22×/sec per player.

| `t`       | direction       | payload |
|-----------|-----------------|---------|
| `welcome` | server → joiner | `{ id, players[] }` — your connection id + everyone already visible |
| `join`    | both ways       | client sends `{ name, avatar }`; server broadcasts `{ player }` |
| `name`    | server → all    | `{ id, name, avatar, slot }` (rebroadcast of join meta) |
| `state`   | both ways       | client sends transform; server rebroadcasts `{ id, x, y, z, yaw, weapon, health }` |
| `hit`     | both ways       | client claims `{ target, dmg }`; server resolves and broadcasts the outcome |
| `leave`   | server → all    | `{ id }` |

**Authority split (the studio default):** clients own their **own transform** (cheap,
hides latency); the server owns **health, kills, respawns** so they can't desync between
peers. A `hit` is a *claim* — the server validates (`target alive`, `dmg > 0`, not self),
applies damage, decides kills/respawns, and broadcasts the truth.

## The room server (`party/arena.ts`)

```ts
import type * as Party from 'partykit/server'

interface PlayerState {
  id: string; name: string; avatar: string; slot: number
  x: number; y: number; z: number; yaw: number
  weapon: string; health: number; kills: number
  alive: boolean; joined: boolean   // joined=false until the client sends `join`
}

export default class Arena implements Party.Server {
  players = new Map<string, PlayerState>()
  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    const sp = spawnPoint()
    const p: PlayerState = { id: conn.id, name: 'Player', avatar: 'ranger',
      slot: this.nextSlot(), x: sp.x, y: 1.8, z: sp.z, yaw: 0,
      weapon: 'Rifle', health: 100, kills: 0, alive: true, joined: false }
    this.players.set(conn.id, p)
    // Only show players who have actually `join`ed (skip half-connected peers).
    const visible = [...this.players.values()].filter((q) => q.id === conn.id || q.joined)
    conn.send(JSON.stringify({ t: 'welcome', id: conn.id, players: visible }))
  }

  onMessage(raw: string, sender: Party.Connection) {
    let m: { t?: string; [k: string]: unknown }
    try { m = JSON.parse(raw) } catch { return }
    const p = this.players.get(sender.id)
    if (!p) return

    if (m.t === 'join') {
      p.name = String(m.name ?? 'Player').slice(0, 16) || 'Player'
      p.avatar = avatarId(m.avatar)
      const wasJoined = p.joined
      p.joined = true
      // broadcast(msg, without[]) — the 2nd arg excludes connection ids.
      if (!wasJoined) this.room.broadcast(JSON.stringify({ t: 'join', player: p }), [sender.id])
      this.room.broadcast(JSON.stringify({ t: 'name', id: p.id, name: p.name, avatar: p.avatar, slot: p.slot }))
    } else if (m.t === 'state') {
      p.x = Number(m.x) || 0; p.y = Number(m.y) || 1.8
      p.z = Number(m.z) || 0; p.yaw = Number(m.yaw) || 0
      if (typeof m.weapon === 'string') p.weapon = m.weapon
      this.room.broadcast(
        JSON.stringify({ t: 'state', id: p.id, x: p.x, y: p.y, z: p.z, yaw: p.yaw, weapon: p.weapon, health: p.health }),
        [sender.id], // never echo a player's own state back to them
      )
    } else if (m.t === 'hit') {
      const target = this.players.get(String(m.target))
      const dmg = Number(m.dmg) || 0
      if (!target || !target.alive || dmg <= 0 || target.id === p.id) return // validate the claim
      target.health = Math.max(0, target.health - dmg)
      let killed = false, respawn: { x: number; y: number; z: number } | null = null
      if (target.health <= 0) {
        killed = true; p.kills += 1
        const s = spawnPoint()
        target.x = s.x; target.y = 1.8; target.z = s.z; target.health = 100; target.alive = true
        respawn = { x: target.x, y: target.y, z: target.z }
      }
      this.room.broadcast(JSON.stringify({ t: 'hit', target: target.id, by: p.id, byName: p.name,
        health: target.health, killed, killerKills: p.kills, respawn }))
    }
  }

  onClose(conn: Party.Connection) {
    this.players.delete(conn.id)
    this.room.broadcast(JSON.stringify({ t: 'leave', id: conn.id }))
  }
}
```

Server-side rules baked into the canonical code:
- **`slot`** is the lowest free integer (1..N), assigned on connect — used for stable team
  colors. See `nextSlot()` in `arena.ts`.
- **Sanitize every input**: clamp `name` length, whitelist `avatar` ids, coerce numbers with
  `Number(x) || fallback`. Never trust a client payload.
- The server holds the **only authoritative copy** of health/kills. State packets carry the
  server's current `health` so a fresh peer (or one that missed a `hit`) self-heals its view.

## The typed client (`src/net/NetClient.ts`)

The whole point: the game subscribes to a **typed `NetEvents` interface**, not a raw socket.
Swapping transports later only touches `NetClient`.

```ts
import PartySocket from 'partysocket'

export interface NetEvents {
  onWelcome: (selfId: string, players: RemotePlayerInfo[]) => void
  onJoin:   (p: RemotePlayerInfo) => void
  onLeave:  (id: string) => void
  onState:  (id: string, x: number, y: number, z: number, yaw: number, weapon: string, health: number) => void
  onName:   (id: string, name: string, avatar: string, slot: number) => void
  onHit:    (msg: HitMessage) => void
  onStatus: (connected: boolean) => void
}

// Dev → local `partykit dev`; prod → build-time env var. Empty string = single-player only.
export const PARTYKIT_HOST: string =
  (import.meta.env.VITE_PARTYKIT_HOST as string | undefined) || (import.meta.env.DEV ? 'localhost:1999' : '')

export class NetClient {
  socket: PartySocket | null = null
  selfId = ''
  private events: NetEvents
  private lastSent = 0
  constructor(events: NetEvents) { this.events = events }

  connect(room: string, name: string, avatar: string, host = PARTYKIT_HOST) {
    this.socket = new PartySocket({ host, room, party: 'main' }) // `party` must match partykit.json default
    this.socket.addEventListener('open', () => { this.events.onStatus(true); this.rawSend({ t: 'join', name, avatar }) })
    this.socket.addEventListener('close', () => this.events.onStatus(false))
    this.socket.addEventListener('message', (e: MessageEvent) => this.onMessage(e.data as string))
  }

  /** Throttled to ~22 Hz; safe to call every frame. */
  sendState(x: number, y: number, z: number, yaw: number, weapon: string, health: number) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    if (now - this.lastSent < 45) return  // 45ms ≈ 22 packets/sec
    this.lastSent = now
    this.rawSend({ t: 'state', x, y, z, yaw, weapon, health })
  }

  sendHit(target: string, dmg: number) { this.rawSend({ t: 'hit', target, dmg }) }

  private rawSend(obj: unknown) {
    if (this.socket && this.socket.readyState === 1) this.socket.send(JSON.stringify(obj))
  }
  disconnect() { if (this.socket) { this.socket.close(); this.socket = null } }
}
```

`partysocket` auto-reconnects on drop, so `onStatus` may flip true→false→true; treat it as
a connection indicator, not a one-shot. Read incoming messages with a `switch (m.t)` that
coerces every field (`Number(m.x)`, `String(m.id)`) before calling the typed callback.

## Remote avatars (interpolation)

State arrives at ~22 Hz; the screen renders at 60+. Never snap remote players to incoming
positions — **store a target and lerp toward it every frame** so motion is smooth. The
frame-rate-independent lerp factor is `k = 1 - 0.001 ** delta`; yaw is wrapped into
`[-π, π]` before lerping so it takes the short way around.

```ts
setTarget(x: number, y: number, z: number, yaw: number) {
  this.target.set(x, y - 1.8, z)   // group sits on the floor; camera y is eye height
  this.targetYaw = yaw
}
update(delta: number, cameraQuat: THREE.Quaternion, cameraPos: THREE.Vector3) {
  const k = 1 - Math.pow(0.001, delta)
  this.group.position.lerp(this.target, k)
  let dy = this.targetYaw - this.group.rotation.y
  while (dy > Math.PI) dy -= Math.PI * 2
  while (dy < -Math.PI) dy += Math.PI * 2
  this.group.rotation.y += dy * k
  this.billboard.quaternion.copy(cameraQuat) // nametag/health face the camera
  this.nameSprite.quaternion.copy(cameraQuat)
}
```

The avatar also carries **hidden hit meshes** (a body capsule + head sphere) tagged with
`userData = { remoteId, part }` and pushed into `ctx.raycastTargets`. The local shooter
raycasts those, reads `remoteId`/`part`, and calls `net.sendHit(remoteId, dmg)`. The server
decides the rest. See `RemoteAvatar.ts` for the full billboard/sprite-facing logic.

## Slot colors & avatars are SHARED data

`src/net/playerAvatars.ts` is imported by both the client *and* (the equivalent whitelist
in) the server. Keep avatar ids and slot colors in one module so server validation and
client rendering can never drift:

```ts
export type PlayerAvatarId = 'ranger' | 'heavy' | 'scout' | 'medic'
export const PLAYER_SLOT_COLORS = [0x35e0ff, 0xff4dcb, 0xffb02e, 0x39d353, 0x9b5cff, 0xff3b6b]
export function playerColorHex(slot: number | undefined, fallbackKey: string): number { /* slot→color, hash fallback */ }
```

## The game mode (`modes/MultiplayerSystem.ts`)

The system constructs the `NetClient` with closures over `this`, maps each event onto the
world, and pushes a scoreboard snapshot via the HUD's `StateListener` (`this.sys.hud.emit()`).
Per frame, `updateMultiplayer(delta)` lerps every remote avatar and calls `net.sendState(...)`
with the camera transform (yaw via a reused `THREE.Euler(... 'YXZ')`).

```ts
startMultiplayer(room: string, name: string, avatar: PlayerAvatarId = 'ranger') {
  this.leaveMultiplayer(false)               // tear down any prior session first
  this.sys.arena.buildArena(getMap(DEFAULT_MAP_ID))
  this.ctx.multiplayer = true
  this.net = new NetClient({
    onStatus:  (c) => { this.connected = c; this.sys.hud.emit() },
    onWelcome: (selfId, players) => { for (const p of players) {
      if (p.id === selfId) this.ctx.camera.position.set(p.x, PLAYER_HEIGHT, p.z)
      else this.addRemote(p) } this.sys.hud.emit() },
    onJoin:  (p) => { this.addRemote(p); this.sys.hud.emit() },
    onLeave: (id) => { this.removeRemote(id); this.sys.hud.emit() },
    onState: (id, x, y, z, yaw, w, h) => { const r = this.remotePlayers.get(id)
      if (r) { r.setTarget(x, y, z, yaw); r.setHealth(h) } },
    onName:  (id, nm, av, slot) => { this.remotePlayers.get(id)?.setMeta(nm, /*kills*/0, av, slot); this.sys.hud.emit() },
    onHit:   (msg) => this.onNetHit(msg),
  })
  this.net.connect(room, name, avatar)
}
```

`onNetHit` is where the authoritative truth lands on the local world: if `msg.target` is
me, set `ctx.health` and (on `killed`) teleport the camera to `msg.respawn`; if `msg.by` is
me and `killed`, bump `ctx.kills = msg.killerKills` and fire the FRAG toast/sfx. Always
`addRemote`/`removeRemote` in pairs that also add/remove the hit meshes from
`ctx.raycastTargets` and `dispose()` the Three.js resources — see `MultiplayerSystem.ts`.

## Room codes & share links

A room is just a string. The studio convention: an uppercased code in the URL query
(`?room=ARENA-AB12`). On load, `App.tsx` reads it and prefills the join screen; on join it
writes it back with `history.replaceState`; a "Copy room link" button copies the full URL.

```ts
// read on boot (App.tsx)
const initialRoom = (new URLSearchParams(location.search).get('room') || '').toUpperCase().slice(0, 24)
// write when joining
const setRoomInUrl = (room: string) =>
  history.replaceState(null, '', room ? `${location.pathname}?room=${encodeURIComponent(room)}` : location.pathname)
// share (HUD.tsx)
const roomShareUrl = (room: string) => `${location.origin}${location.pathname}?room=${encodeURIComponent(room)}`
```

No "create room" call exists — connecting to a never-seen room name lazily spins up the
Durable Object. Sharing the link *is* the invite flow.

## Dev workflow & deploy

`package.json` scripts (multiplayer needs BOTH processes running locally):

```jsonc
"dev":          "vite",
"dev:all":      "concurrently -k -n game,party -c cyan,magenta \"vite\" \"partykit dev\"",
"party:dev":    "partykit dev",      // ws server on http://127.0.0.1:1999
"party:deploy": "partykit deploy"    // → fps-arena.<username>.partykit.dev
```

`partykit.json`:

```json
{ "$schema": "https://www.partykit.io/schema.json", "name": "fps-arena",
  "main": "party/arena.ts", "compatibilityDate": "2024-09-01" }
```

- **Local:** `npm run dev:all` (vite + `partykit dev` together). The client auto-targets
  `localhost:1999` in dev. If multiplayer shows "connecting…" forever, the room server isn't
  running — `npm run dev` alone starts only the game.
- **Deploy:** `npm run party:deploy` (deploys `party/arena.ts` to the Cloudflare edge, prints
  the host), then set `VITE_PARTYKIT_HOST=fps-arena.<username>.partykit.dev` as a **build-time**
  Vercel env var. Unset host in prod = single-player still works; "Join Room" just can't connect.

## The `@shipshitgames/net` abstraction (keep the transport swappable)

Cloudflare acquired PartyKit; isolate the dependency so a future migration to raw Durable
Objects or Colyseus is a one-file change:
- Game code depends only on `NetClient` + the `NetEvents` **interface** and the JSON message
  shapes — never on `partysocket` or `partykit/server` types directly.
- `PARTYKIT_HOST` resolution and the `new PartySocket(...)` call live solely inside
  `NetClient.connect`. To swap transports, reimplement `connect/sendState/sendHit/disconnect`
  and the `onMessage` switch behind the same `NetEvents` contract; nothing else changes.
- The wire format is plain JSON with a `t` discriminator — portable to any WebSocket backend.

## Do / Don't

- **Do** keep the server authoritative for anything contestable (health, kills, respawns);
  let clients own only their own transform.
- **Do** throttle `sendState` (~45ms) and call it freely from the frame loop.
- **Do** interpolate remote avatars toward a target; never snap to incoming packets.
- **Do** validate and coerce every server-side field; whitelist enum-ish ids (avatar).
- **Do** exclude the sender from rebroadcasts (`broadcast(msg, [sender.id])`).
- **Do** route everything through the typed `NetEvents` interface so the transport is swappable.
- **Don't** import `partysocket`/`partykit/server` outside `src/net/*` and `party/*`.
- **Don't** trust client `hit` packets — they are *claims*; the server applies damage.
- **Don't** hardcode the host; use `VITE_PARTYKIT_HOST` with the dev `localhost:1999` fallback.
- **Don't** keep heavy per-frame logic on the server — PvP servers should mostly relay + arbitrate.

## Common bugs

- **Seeing your own ghost:** the server echoed your `state` back. Always pass `[sender.id]`
  as the broadcast exclusion list, and on the client guard `addRemote` with
  `info.id === net.selfId`.
- **Remote players teleport / stutter:** you set `group.position` directly from packets
  instead of `setTarget` + per-frame `lerp`. Snap only on respawn.
- **Yaw spins the long way:** forgetting to wrap `dy` into `[-π, π]` before lerping rotation.
- **"connecting…" forever locally:** `partykit dev` isn't running — use `npm run dev:all`.
- **Works locally, dead in prod:** `VITE_PARTYKIT_HOST` not set at *build* time (Vite inlines
  `import.meta.env.*` at build, not runtime — re-deploy after adding it).
- **`party` mismatch:** `new PartySocket({ party: 'main' })` must match the server's party
  name (the default for a single `main` entry). A typo connects to an empty room.
- **Leaked Three.js resources:** removing a remote avatar without `dispose()` and without
  pruning its hit meshes from `ctx.raycastTargets` leaks GPU memory and ghost hitboxes.
- **Half-connected peers visible:** broadcast/include only players with `joined === true`
  (set on the client's `join` message), not everyone who merely opened a socket.

## Worked example: spectating a new player

1. Friend opens `…/?room=ARENA-AB12` → `App.tsx` prefills the join screen.
2. They submit → `startMultiplayer('ARENA-AB12', name, avatar)` → `net.connect(...)`.
3. Socket opens → client sends `{ t:'join', name, avatar }`; server sets `joined=true`,
   broadcasts `{ t:'join', player }` to everyone *else* and a `{ t:'name', … }` to all.
4. Your client's `onJoin` runs `addRemote(player)`: a `RemoteAvatar` is added to the scene
   and its hit meshes to `ctx.raycastTargets`.
5. Each frame your client lerps that avatar toward the latest `state` packet and billboards
   its nametag. When you shoot it, you raycast the hidden meshes, read `remoteId`, and call
   `net.sendHit(remoteId, dmg)` — the server decides the kill.

## Related skills

- **shipshit-engine** — GameContext / GameSystems registry the MultiplayerSystem plugs into.
- **fps-arena** — the PvP game mode that consumes this net layer end-to-end.
- **game-asset-pipeline** — avatar sprites / previews referenced by `RemoteAvatar`.
- **playwright-game-testing** — driving two browser contexts to test a shared room.
- **vibe-game-workflow** — where `dev:all` and `party:deploy` fit in the studio loop.
