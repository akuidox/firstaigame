// Level 1 — "Grimhold Crypts"
//
// Layout is a 2 x 3 grid of rooms (25 x 19 cells):
//
//     A (start) --+-- B (hall) --R-- C (boss + exit)
//        |            |               (RED sigil gates R)
//        +            +
//        |            |
//     D (sigil) --+-- E (crossroads) --B-- F (vault)
//                                          (BLUE sigil gates B, optional supplies)
//
// Critical path: start in A with the staff, push into B, drop down to D for the
// RED sigil (cultists guard it), come back up and open the red door R into C,
// kill the boss, step into the exit E. The BLUE sigil + vault F is an optional
// detour for extra health/ammo.
//
// Authored as ASCII so the level-design agent can iterate here directly.
// See tiles.js for the legend. Every row must be the same length.

export const level1 = {
  name: 'Grimhold Crypts',
  intro: 'The crypts stir. Take up your staff, gather the sigils, breach the sealed gate, and destroy what guards the way out.',
  ambient: 0x1a1420,
  fog: { color: 0x0a0710, near: 4, far: 34 },
  grid: [
    '#########################', //  0
    '#t......#.......#......t#', //  1
    '#.P...a.#...w...#.......#', //  2
    '#.......#..e....#.......#', //  3
    '#.......+.......R...M...E', //  4
    '#.....h.#....e..#.......#', //  5
    '#t......#.a.....#.......#', //  6
    '#.......#.......#...t...#', //  7
    '####+######+#############', //  8
    '#.......#.......#.......#', //  9
    '#.......#....b..#...h...#', // 10
    '#.......#.......#...a...#', // 11
    '#.c.....+.......B...t...#', // 12
    '#.......#..e..h.#.......#', // 13
    '#.......#.......#.......#', // 14
    '#...rc..#...c...#.......#', // 15
    '#t......#.......#...t...#', // 16
    '#.......#.......#.......#', // 17
    '#########################', // 18
  ],
};
