// Headless smoke test: loads the built game, drives it a little, and fails on
// any console error / page exception. Also drops a screenshot for eyeballing.
import { createRequire } from 'module';
import { execSync } from 'child_process';
import { pathToFileURL } from 'url';

const require = createRequire(import.meta.url);
const gRoot = execSync('npm root -g').toString().trim();
const { chromium } = require(gRoot + '/playwright');

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
    hasGame: !!g,
    hasCanvas: !!document.querySelector('canvas'),
    enemies: g?.enemies?.length,
    total: g?.totalEnemies,
    state: g?.state,
    webgl: (() => { try { return !!g.renderer.getContext(); } catch { return false; } })(),
  };
});

// start a run and exercise systems for ~1.2s
await page.evaluate(() => window.__grimhold.startGame());
await page.waitForTimeout(200);

const combat = await page.evaluate(async () => {
  const g = window.__grimhold;
  g.input.locked = true;                 // pretend pointer lock so firing is allowed
  // fire the staff at nothing (should not throw)
  for (let i = 0; i < 3; i++) g.weapons.tryFire();
  // teleport onto an imp and force damage both ways
  const imp = g.enemies.find((e) => e.kind === 'imp');
  const hpBefore = imp.hp;
  const dead = imp.damage(999);          // kill path
  // stand next to a cultist and let it hit us over a few frames
  const cultist = g.enemies.find((e) => e.kind === 'cultist' && e.alive);
  if (cultist) { g.player.pos.set(cultist.position.x + 1, 1.6, cultist.position.z); cultist.aggro = true; }
  const healthBefore = g.player.health;
  await new Promise((r) => setTimeout(r, 700));
  return {
    state: g.state,
    impKilled: dead,
    impHpDropped: imp.hp < hpBefore,
    kills: g.kills,
    playerHealth: g.player.health,
    tookDamage: g.player.health < healthBefore,
    inferno: g.weapons.owned.has('inferno'),
  };
});

// grab the red key + open the red door programmatically to prove the loop wiring
const loop = await page.evaluate(() => {
  const g = window.__grimhold;
  g.player.keys.add('r');
  const redDoor = g.doors.find((d) => d.keyColor === 'r');
  const res = redDoor.tryOpen(g.player.keys);
  return { redDoorOpens: res === 'opened', objective: g.objectiveText() };
});

await page.screenshot({ path: 'scripts/smoke.png' });
await browser.close();

console.log('boot   ', JSON.stringify(boot));
console.log('combat ', JSON.stringify(combat));
console.log('loop   ', JSON.stringify(loop));
console.log('errors ', errors.length ? errors : 'none');

const ok = boot.hasGame && boot.hasCanvas && boot.webgl && combat.impKilled &&
           combat.tookDamage && loop.redDoorOpens && errors.length === 0;
console.log(ok ? '\nSMOKE OK' : '\nSMOKE FAILED');
process.exit(ok ? 0 : 1);
