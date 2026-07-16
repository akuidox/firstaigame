// Level 2 — "The Sunken Vaults"
//
// A distinct "carved-from-rock" layout (25 x 19): thick stone with vault
// chambers hollowed out of it and thin flooded passages between them — nothing
// like Level 1's open 2x3 room grid.
//
//                 NORTH GALLERY (cultists + GREEN key g)
//                        |
//   START (SW) --+--> HUB (hounds) --.--G--> BOSS VAULT --E (exit)
//                        |
//                 SOUTH CISTERN (hounds + Chaos Orb + secret)
//
// Critical path: spawn in the start vault with your staff, breach into the hub
// (two hounds), climb the north corridor to the GREEN key past the cultist
// gallery, come back and open the GREEN door G that seals the flooded corridor
// to the boss vault, then destroy the guardian M and step through the exit E.
//
// Two secret push-walls (`%`):
//   - (3,5)  in the start vault's north wall  -> soul-ammo alcove (3,4)
//   - (16,14) in the south cistern's east wall -> fire-ammo alcove (17,14)
// Each alcove is walled off on every other side, so it is only reachable by
// pushing that secret in — that's what makes it count as a secret.
//
// Colder/deeper palette than Level 1 (drowned blue rock, tighter murk).
// See tiles.js for the legend. Every row must be the same length (25).
// Run `node scripts/validate-level.mjs` after editing.

export const level2 = {
  name: 'The Sunken Vaults',
  intro: 'Black water fills the deep vaults, where drowned cultists and their hounds keep the sealed gate and something vast waits where the tunnels end.',
  ambient: 0x101826,
  fog: { color: 0x05070e, near: 3, far: 26 },
  grid: [
    '#########################', //  0
    '#########################', //  1
    '#########t.....t#########', //  2  north gallery (torches)
    '#########.c.....#########', //  3
    '###s#####....gc.#########', //  4  secret alcove loot (3,4) + green key g
    '###%#####..c....#########', //  5  secret push-wall (3,5)
    '##t....h#.......##.....t#', //  6  start vault | north room | boss vault
    '##..P...####+#####.H..h.#', //  7  P start; north door (12,7); boss hound
    '##...e..##.....###......#', //  8  start imp; hub
    '##......+..H.H..HG...M..E', //  9  main spine: door, hub hounds, G, boss M, exit
    '##.a....##....t###......#', // 10
    '##......####+#####.s..c.#', // 11  south door (12,11); boss soul-ammo + cultist
    '##t.....####.#####t.....#', // 12
    '#########......t#########', // 13  south cistern
    '#########.H..o..%a#######', // 14  hound; Chaos Orb; secret (16,14) -> ammo (17,14)
    '#########..cs.H.#########', // 15  cultist; souls; hound
    '#########t..e...#########', // 16  imp
    '#########################', // 17
    '#########################', // 18
  ],
};
