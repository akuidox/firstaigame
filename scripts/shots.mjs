// Capture a few in-game views to eyeball lighting/atmosphere.
import { createRequire } from 'module';
import { execSync } from 'child_process';
import { pathToFileURL } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');

const url = pathToFileURL(process.cwd() + '/dist/game.html').href;
const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(300);
await page.evaluate(() => window.__grimhold.startGame());

async function shot(name, setup) {
  await page.evaluate(setup);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `scripts/shot-${name}.png` });
}

// look east down the start room toward the hall door
await shot('spawn', () => { const g = window.__grimhold; g.player.spawn(g.pickups.items[0]?.x ?? 6, 6, -Math.PI / 2); g.player.yaw = -Math.PI / 2; });
// stand in the central hall looking at an imp
await shot('hall', () => {
  const g = window.__grimhold;
  const imp = g.enemies.find((e) => e.kind === 'imp');
  g.player.pos.set(imp.position.x, 1.6, imp.position.z + 4);
  g.player.yaw = Math.PI; g.player._syncCamera();
});
// look at the red door
await shot('reddoor', () => {
  const g = window.__grimhold;
  const d = g.doors.find((x) => x.keyColor === 'r');
  g.player.pos.set(d.mesh.position.x - 3, 1.6, d.mesh.position.z);
  g.player.yaw = -Math.PI / 2; g.player._syncCamera();
});
await browser.close();
console.log('shots written');
