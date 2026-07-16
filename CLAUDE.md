# CLAUDE.md — working notes for Grimhold

Retro dark-fantasy FPS (Doom-like) in Three.js. See `README.md` for the player-
facing overview and full architecture. This file is orientation for agents.

## Commands

- `npm run build` — bundle everything into the single self-contained
  `dist/game.html` (Three.js inlined, no external runtime requests). This file is
  the deliverable the player opens.
- `npm run dev` — esbuild dev server at http://localhost:8000 with live reload.
- `node scripts/validate-level.mjs` — check every level's grid: uniform width,
  sealed border, reachability of exit/weapon, and that no key is softlocked
  behind its own door. Run after any map edit.
- `node scripts/smoke-test.mjs` — headless boot + gameplay smoke test; fails on
  any console error. Run before committing gameplay changes.

## Conventions

- **No external runtime assets.** All textures/sprites are drawn to `<canvas>` in
  `src/core/assets.js`; all SFX are synthesized in `src/core/audio.js`. Keep it
  that way so `dist/game.html` stays a single portable file (and works as a
  sandboxed artifact).
- **Maps are ASCII.** Author levels in `src/world/*.js` using the legend in
  `src/world/tiles.js`. Every row must be the same length. Validate before commit.
- **Systems are decoupled** (weapons / enemies / pickups / doors are data-driven)
  so RPG and rogue-lite features can layer on without rewrites.
- **Episode = a registry.** Levels are listed in `src/world/levels.js`; add one
  by appending. Progression (`systems/progression.js`) carries XP/upgrades and
  derives the stat mods the player/weapons read. Saves (`systems/save.js`) are
  versioned — bump `SAVE_VERSION` on any schema change.
- Rendering vs collision are separate: walls draw via one InstancedMesh; collision
  is a Set of blocked cells that doors mutate when opened.
- Three.js r160 uses physically-correct lighting — point-light intensities are in
  candela (tens, not fractions). Keep that in mind when tuning atmosphere.

## Branch

Work happens on `claude/retro-fps-game-snw3hv`.
