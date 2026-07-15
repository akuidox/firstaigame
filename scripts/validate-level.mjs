// Level sanity checker. Run: node scripts/validate-level.mjs
// Catches the mistakes that make a map unplayable:
//   - rows of unequal length
//   - a non-wall gap in the border that isn't the exit
//   - required things (exit, keys, weapon) unreachable from the start
//   - a key sealed behind the very door it opens (softlock)

import { level1 } from '../src/world/level1.js';
import { LOCKED_DOORS } from '../src/world/tiles.js';

const levels = { level1 };
let failures = 0;
const fail = (msg) => { console.log('  ✗ ' + msg); failures++; };
const ok = (msg) => console.log('  ✓ ' + msg);

function cells(grid, pred) {
  const out = [];
  for (let y = 0; y < grid.length; y++)
    for (let x = 0; x < grid[y].length; x++)
      if (pred(grid[y][x])) out.push([x, y]);
  return out;
}

function reachable(grid, start, blocked) {
  const H = grid.length, W = grid[0].length;
  const seen = new Set();
  const q = [start];
  const key = (x, y) => x + ',' + y;
  seen.add(key(...start));
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (seen.has(key(nx, ny))) continue;
      const ch = grid[ny][nx];
      if (ch === '#') continue;
      if (blocked && blocked(ch)) continue;
      seen.add(key(nx, ny));
      q.push([nx, ny]);
    }
  }
  return seen;
}

for (const [name, lvl] of Object.entries(levels)) {
  console.log(`\n${name} — "${lvl.name}"`);
  const grid = lvl.grid;
  const W = grid[0].length;

  // 1. uniform width
  const bad = grid.map((r, i) => [i, r.length]).filter(([, l]) => l !== W);
  if (bad.length) { bad.forEach(([i, l]) => fail(`row ${i} length ${l}, expected ${W}`)); }
  else ok(`uniform ${W}x${grid.length}`);

  // 2. exactly one player start
  const starts = cells(grid, (c) => c === 'P');
  if (starts.length !== 1) fail(`expected 1 player start, found ${starts.length}`);
  else ok('one player start');

  // 3. border is walls except exits
  let borderBad = 0;
  for (let x = 0; x < W; x++) {
    for (const y of [0, grid.length - 1]) if (!'#E'.includes(grid[y][x])) borderBad++;
  }
  for (let y = 0; y < grid.length; y++) {
    for (const x of [0, W - 1]) if (!'#E'.includes(grid[y][x])) borderBad++;
  }
  if (borderBad) fail(`${borderBad} non-wall border cell(s)`);
  else ok('border sealed');

  if (!starts.length || bad.length) { console.log('  (skipping reachability)'); continue; }

  // 4. reachability (doors passable)
  const reach = reachable(grid, starts[0], null);
  const need = { exit: 'E', weapon: 'w' };
  for (const [label, ch] of Object.entries(need)) {
    const targets = cells(grid, (c) => c === ch);
    if (!targets.length) { fail(`no ${label} (${ch}) on map`); continue; }
    const got = targets.every(([x, y]) => reach.has(x + ',' + y));
    got ? ok(`${label} reachable`) : fail(`${label} (${ch}) unreachable from start`);
  }

  // 5. every locked door has its key, and the key isn't behind that door
  for (const [door, keyCh] of Object.entries(LOCKED_DOORS)) {
    const doors = cells(grid, (c) => c === door);
    const keys = cells(grid, (c) => c === keyCh);
    if (!doors.length) continue;
    if (!keys.length) { fail(`locked door ${door} has no ${keyCh} key on map`); continue; }
    const sealed = reachable(grid, starts[0], (c) => c === door);
    const keyGettable = keys.some(([x, y]) => sealed.has(x + ',' + y));
    keyGettable ? ok(`${keyCh} key reachable without opening ${door}`)
                : fail(`${keyCh} key is softlocked behind door ${door}`);
  }
}

console.log(failures ? `\nFAILED (${failures})` : '\nALL OK');
process.exit(failures ? 1 : 0);
