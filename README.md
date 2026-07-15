# GRIMHOLD

A retro, dark-fantasy first-person shooter — a Doom / *Project Warlock*-style
"boomer shooter" built with **Three.js**. One complete level with a full game
loop: start → objectives → end.

> **Status:** playable vertical slice (V1). Core loop works end to end. Designed
> to be *bonified* over time (RPG / rogue-lite systems layer on top — see
> [Roadmap](#roadmap)).

---

## Play it now

**Easiest (best feel):** open `dist/game.html` in any modern browser — just
double-click it. It's a single self-contained file (Three.js is inlined, all
art is generated procedurally), so there's nothing to install and no server
needed. Mouse-look, fullscreen and performance are all best when opened this way.

**With live reload (for development):**

```bash
npm install
npm run dev        # http://localhost:8000, hot-reloads on save
```

**Rebuild the self-contained file:**

```bash
npm run build      # writes dist/game.html
```

---

## How to play

You are the last apprentice of a fallen warlock, descending into the crypts of
Grimhold.

| Input | Action |
| --- | --- |
| `W A S D` / Arrows | Move |
| Mouse | Look |
| Left-click | Fire |
| `1` / `2` / `3` | Select weapon (`Q` to cycle) |
| `E` / `Space` | Open doors / use |
| `Esc` | Release the mouse (click to resume) |

**The loop:** you start with the **Arcane Staff** (unlimited). Fight through the
halls, find the **red sigil** (guarded by cultists), open the sealed red gate,
then slay **the Guardian** blocking the exit. Along the way grab the **Inferno**
(a limited-ammo fire spread) and the **Chaos Orb** (a slow projectile that
explodes for splash damage), and dodge the bolts thrown by cultists and hounds.
The optional **blue sigil** vault holds extra supplies. Reach the exit alive to win.

**Weapons:** `1` Arcane Staff (rapid hitscan, unlimited) · `2` Inferno (6-pellet
spread, fire charges) · `3` Chaos Orb (explosive projectile, souls).
**Enemies:** imps (melee), cultists (ranged bolts), hounds (fast chargers), and
the Guardian boss.

---

## Architecture

Modular ES modules bundled by esbuild. Gameplay, rendering and content are kept
separate so specialised agents can each work in their own lane.

```
src/
  main.js              Game class: renderer, lights, state machine, game loop
  core/
    input.js           keyboard + mouse + pointer lock
    audio.js           synthesized SFX (no audio files)
    assets.js          procedural textures & pixel-art sprites  ← graphiste seam
  world/
    tiles.js           map legend + world constants
    level1.js          the level, authored as ASCII            ← level-design seam
    levelBuilder.js    grid → geometry + collision + spawns
  entities/
    player.js          FPS controller, collision, stats
    enemy.js           billboard sprites + chase/attack AI
  systems/
    weapons.js         data-driven weapons + hitscan combat
    pickups.js         health / ammo / weapon / keys
  ui/
    hud.js             HUD + weapon viewmodel                   ← UX/UI seam
    screens.js         start / win / lose menus
```

### Agent seams

- **Level design** — edit `src/world/level1.js`. The map is plain ASCII; the
  legend is documented at the top of `src/world/tiles.js`. Validate any map with
  `node scripts/validate-level.mjs` (checks reachability + softlocks).
- **Graphiste (art)** — everything visual is generated in `src/core/assets.js`
  (wall/floor/door textures and enemy sprite pixel grids). Restyle there, or swap
  in real textures, without touching gameplay.
- **UX/UI** — `src/ui/hud.js` and `src/ui/screens.js` own all on-screen layout.
- **QA / code** — `node scripts/smoke-test.mjs` boots the built game headless,
  drives combat + the key/door loop, and fails on any console error.

---

## Roadmap

The systems are intentionally decoupled so we can layer on depth:

- **Doom-like + pickups** (V1, done) — arcade core, health/ammo/keys.
- **RPG-lite** — character levels, upgradeable damage/health, small inventory.
- **Rogue-lite** — generated levels (the grid format already supports it),
  permadeath, run-based meta-progression.
- More weapons, enemies, a multi-level episode, music, and a proper art pass.

---

*Built with Three.js. No external runtime assets — textures, sprites and sound
are all generated in code.*
