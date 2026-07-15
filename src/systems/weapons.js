// Weapon system. Weapons are data (WEAPONS table) driven by one hitscan firing
// routine, so adding a weapon later means adding a row here — not new code.
// The viewmodel + muzzle flash are drawn by the HUD, which reads `flash`,
// `recoil`, and `current` off the manager.

import * as THREE from 'three';

export const WEAPONS = {
  staff: {
    id: 'staff', name: 'Arcane Staff', ammo: null, // unlimited
    damage: 22, cooldown: 0.26, pellets: 1, spread: 0, range: 42,
    tracer: 0x9a6cff,
  },
  inferno: {
    id: 'inferno', name: 'Inferno', ammo: 'fire',
    damage: 11, cooldown: 0.72, pellets: 6, spread: 0.13, range: 24, ammoPerShot: 1,
    tracer: 0xff7a2a,
  },
  chaosorb: {
    id: 'chaosorb', name: 'Chaos Orb', ammo: 'soul', kind: 'projectile',
    damage: 70, splash: 2.8, cooldown: 0.85, ammoPerShot: 1, projSpeed: 15, color: '#9a3cff',
  },
};

const ORDER = ['staff', 'inferno', 'chaosorb'];

// ray (origin,dir) vs sphere(center,r) -> distance along ray or Infinity
function raySphere(origin, dir, center, r) {
  const ox = origin.x - center.x, oy = origin.y - center.y, oz = origin.z - center.z;
  const b = ox * dir.x + oy * dir.y + oz * dir.z;
  const c = ox * ox + oy * oy + oz * oz - r * r;
  if (c > 0 && b > 0) return Infinity;
  const disc = b * b - c;
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : Infinity;
}

export class WeaponManager {
  constructor(ctx) {
    this.ctx = ctx;                 // { camera, scene, getEnemies, getSolids, onKill, onFire }
    this.owned = new Set(['staff']);
    this.current = 'staff';
    this.ammo = { fire: 0, soul: 0 };
    this.cooldown = 0;
    this.flash = 0;                 // 0..1, decays; HUD renders muzzle flash
    this.recoil = 0;                // 0..1, decays; HUD kicks the viewmodel
    this.raycaster = new THREE.Raycaster();
    this._tracers = [];
  }

  give(weaponId, ammoAmount = 0) {
    this.owned.add(weaponId);
    const def = WEAPONS[weaponId];
    if (def.ammo) this.ammo[def.ammo] += ammoAmount;
    this.current = weaponId;        // auto-switch to a freshly grabbed weapon
  }

  addAmmo(type, amount) { this.ammo[type] = (this.ammo[type] || 0) + amount; }

  switchTo(idOrIndex) {
    const id = typeof idOrIndex === 'number' ? ORDER[idOrIndex] : idOrIndex;
    if (id && this.owned.has(id)) this.current = id;
  }

  cycle(dir = 1) {
    const owned = ORDER.filter((w) => this.owned.has(w));
    const i = owned.indexOf(this.current);
    this.current = owned[(i + dir + owned.length) % owned.length];
  }

  def() { return WEAPONS[this.current]; }

  currentAmmo() {
    const d = this.def();
    return d.ammo ? this.ammo[d.ammo] : Infinity;
  }

  tryFire() {
    if (this.cooldown > 0) return;
    const d = this.def();
    const need = d.ammoPerShot || 0;
    if (d.ammo && this.ammo[d.ammo] < need) {
      this.ctx.onFire?.('empty');
      this.cooldown = 0.2;
      return;
    }
    if (d.ammo) this.ammo[d.ammo] -= need;
    this.cooldown = d.cooldown;
    this.flash = 1;
    this.recoil = 1;

    const cam = this.ctx.camera;
    const origin = cam.getWorldPosition(new THREE.Vector3());
    const baseDir = cam.getWorldDirection(new THREE.Vector3());

    // projectile weapons spawn a slow orb instead of a hitscan ray
    if (d.kind === 'projectile') {
      this.ctx.spawnProjectile({
        x: origin.x, z: origin.z, dx: baseDir.x, dz: baseDir.z,
        speed: d.projSpeed, damage: d.damage, splash: d.splash, from: 'player', color: d.color,
      });
      this.ctx.onFire?.('shot');
      return;
    }

    const enemies = this.ctx.getEnemies();
    const solids = this.ctx.getSolids();

    let hitAny = false, hitPoint = null;
    for (let p = 0; p < d.pellets; p++) {
      const dir = baseDir.clone();
      if (d.spread) {
        dir.x += (Math.random() - 0.5) * d.spread;
        dir.y += (Math.random() - 0.5) * d.spread;
        dir.z += (Math.random() - 0.5) * d.spread;
        dir.normalize();
      }
      // wall occlusion distance
      this.raycaster.set(origin, dir);
      this.raycaster.far = d.range;
      let wallDist = d.range;
      const hits = this.raycaster.intersectObjects(solids, false);
      if (hits.length) wallDist = hits[0].distance;

      // nearest enemy in front, closer than the wall
      let target = null, tDist = wallDist;
      for (const e of enemies) {
        if (!e.alive) continue;
        const t = raySphere(origin, dir, e.position, e.hitRadius);
        if (t < tDist) { tDist = t; target = e; }
      }
      const endDist = Math.min(tDist, wallDist);
      const end = origin.clone().addScaledVector(dir, endDist);
      this._spawnTracer(origin, end, d.tracer);
      if (target) {
        hitAny = true; hitPoint = end;
        const dead = target.damage(d.damage, origin);
        if (dead) this.ctx.onKill?.(target);
      }
    }
    if (hitAny) this.ctx.onHit?.(hitPoint);
    this.ctx.onFire?.('shot');
  }

  _spawnTracer(a, b, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geo, mat);
    this.ctx.scene.add(line);
    this._tracers.push({ line, life: 0.06 });
  }

  update(dt, input) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.flash = Math.max(0, this.flash - dt * 6);
    this.recoil = Math.max(0, this.recoil - dt * 5);

    if (input) {
      if (input.pressed('Digit1')) this.switchTo('staff');
      if (input.pressed('Digit2')) this.switchTo('inferno');
      if (input.pressed('Digit3')) this.switchTo('chaosorb');
      if (input.pressed('KeyQ')) this.cycle(1);
      if (input.fireHeld || input.firePressed) this.tryFire();
    }

    for (let i = this._tracers.length - 1; i >= 0; i--) {
      const t = this._tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.06) * 0.9;
      if (t.life <= 0) {
        this.ctx.scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        this._tracers.splice(i, 1);
      }
    }
  }
}
