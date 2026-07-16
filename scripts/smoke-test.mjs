// Headless smoke test: loads the built game, drives it, and fails on any console
// error / page exception. Covers combat, the key/door loop, level transition +
// carry-over, upgrades, and the export/import save round-trip. Drops a screenshot.
import { createRequire } from 'module';
import { execSync } from 'child_process';
import { pathToFileURL } from 'url';

const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');

const url = pathToFileURL(process.cwd() + '/dist/game.html').href;
const errors = [];

const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(400);

const boot = await page.evaluate(() => {
  const g = window.__grimhold;
  return {
    hasGame: !!g, hasCanvas: !!document.querySelector('canvas'),
    enemies: g?.enemies?.length, levels: g?.levelIndex,
    webgl: (() => { try { return !!g.renderer.getContext(); } catch { return false; } })(),
  };
});

await page.evaluate(() => window.__grimhold.newGame());
await page.waitForTimeout(150);

const combat = await page.evaluate(async () => {
  const g = window.__grimhold;
  g.input.locked = true;
  for (let i = 0; i < 3; i++) g.weapons.tryFire();       // fire staff, must not throw
  const imp = g.enemies.find((e) => e.kind === 'imp');
  const dead = imp.damage(999);
  const cultist = g.enemies.find((e) => e.kind === 'cultist' && e.alive);
  if (cultist) { g.player.pos.set(cultist.position.x + 1, 1.6, cultist.position.z); cultist.aggro = true; }
  const healthBefore = g.player.health;
  await new Promise((r) => setTimeout(r, 600));
  return { impKilled: dead, tookDamage: g.player.health < healthBefore };
});

// key/door loop on level 1 (red gate)
const loop = await page.evaluate(() => {
  const g = window.__grimhold;
  g.player.keys.add('r');
  const redDoor = g.doors.find((d) => d.keyColor === 'r');
  return { redDoorOpens: redDoor.tryOpen(g.player.keys) === 'opened', objective: g.objectiveText() };
});

// upgrade + descend to level 2, verifying carry-over
const prog = await page.evaluate(() => {
  const g = window.__grimhold;
  g.progression.skillPoints = 2;
  const bought = g.progression.buy('vitality');       // +20 max health
  g.weapons.give('inferno', 20);
  const boss = g.enemies.find((e) => e.isBoss);
  if (boss) boss.damage(99999, { x: 0, z: 0 });        // clear the guardian
  g.completeLevel();                                   // -> intermission (2 levels)
  const midState = g.state;
  g.descend();                                         // -> level 2
  return {
    bought, midState, levelIndex: g.levelIndex, level2Enemies: g.enemies.length,
    carriedInferno: g.weapons.owned.has('inferno'), maxHealth: g.player.maxHealth,
    secretsTotal: g.secretsTotal,
  };
});

// export/import save round-trip (independent of localStorage, which file:// may block)
const save = await page.evaluate(() => {
  const g = window.__grimhold;
  const code = g.exportCode();
  g.levelIndex = 0;                                    // corrupt, then restore from code
  const okLoad = g.loadCode(code);
  return { codeLen: code.length, okLoad, levelIndexAfter: g.levelIndex };
});

await page.screenshot({ path: 'scripts/smoke.png' });
await browser.close();

console.log('boot   ', JSON.stringify(boot));
console.log('combat ', JSON.stringify(combat));
console.log('loop   ', JSON.stringify(loop));
console.log('prog   ', JSON.stringify(prog));
console.log('save   ', JSON.stringify(save));
console.log('errors ', errors.length ? errors : 'none');

const ok = boot.hasGame && boot.hasCanvas && boot.webgl &&
  combat.impKilled && combat.tookDamage && loop.redDoorOpens &&
  prog.bought && prog.midState === 'intermission' && prog.levelIndex === 1 &&
  prog.level2Enemies > 0 && prog.carriedInferno && prog.maxHealth === 120 &&
  save.codeLen > 0 && save.okLoad && save.levelIndexAfter === 1 &&
  errors.length === 0;
console.log(ok ? '\nSMOKE OK' : '\nSMOKE FAILED');
process.exit(ok ? 0 : 1);
