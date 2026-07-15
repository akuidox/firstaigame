// Enemies are billboarded sprites (they always face the camera — the classic
// Doom/Wolf3D look) with lightweight chase/attack AI. Types are data-driven so
// the level-design / graphiste agents can add or restyle them easily.

import * as THREE from 'three';
import { WORLD_SCALE as S } from '../world/tiles.js';
import { makeEnemySprite } from '../core/assets.js';

export const ENEMY_TYPES = {
  imp: {
    hp: 30, speed: 3.4, height: 1.7, damage: 8,
    melee: S * 0.95, awaken: 16, cooldown: 0.9, ranged: false, tint: 0xffffff,
  },
  cultist: {
    hp: 26, speed: 2.2, height: 1.8, damage: 11,
    melee: S * 0.9, awaken: 20, cooldown: 1.7, ranged: true, rangedRange: S * 7,
    tracer: 0x9a5cff, tint: 0xffffff,
  },
  boss: {
    hp: 280, speed: 2.7, height: 2.9, damage: 20, isBoss: true,
    melee: S * 1.15, awaken: 26, cooldown: 1.1, ranged: true, rangedRange: S * 9,
    tracer: 0xff4a4a, tint: 0xffdddd,
  },
};

// Cheap sampled line-of-sight over the collision grid.
function hasLOS(collision, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const dist = Math.hypot(dx, dz);
  const steps = Math.max(2, Math.ceil(dist / (S * 0.4)));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + dx * t, z = az + dz * t;
    const gx = Math.round(x / S), gy = Math.round(z / S);
    if (collision.isCellBlocked(gx, gy)) return false;
  }
  return true;
}

let _spriteCache = {};

export class Enemy {
  constructor(kind, x, z, ctx) {
    this.kind = kind;
    this.def = ENEMY_TYPES[kind] || ENEMY_TYPES.imp;
    this.ctx = ctx;                 // { scene, player, collision, onPlayerDamage, onTracer }
    this.hp = this.def.hp;
    this.maxHp = this.def.hp;
    this.alive = true;
    this.aggro = false;
    this.attackTimer = 0;
    this.hitRadius = this.def.height * 0.35;
    this.position = new THREE.Vector3(x, this.def.height * 0.5, z);
    this.isBoss = !!this.def.isBoss;

    if (!_spriteCache[kind]) _spriteCache[kind] = makeEnemySprite(kind);
    const { texture, aspect } = _spriteCache[kind];
    const mat = new THREE.SpriteMaterial({ map: texture, color: this.def.tint, transparent: true, fog: true });
    this.sprite = new THREE.Sprite(mat);
    this.sprite.center.set(0.5, 0);      // anchor feet to the floor
    const h = this.def.height;
    this.sprite.scale.set(h * aspect, h, 1);
    this.sprite.position.set(x, 0.02, z);
    ctx.scene.add(this.sprite);

    this._flash = 0;
  }

  damage(amount) {
    if (!this.alive) return false;
    this.hp -= amount;
    this.aggro = true;                   // getting shot wakes it
    this._flash = 1;
    if (this.hp <= 0) { this._die(); return true; }
    return false;
  }

  _die() {
    this.alive = false;
    this.ctx.scene.remove(this.sprite);
    this.sprite.material.dispose();
  }

  update(dt) {
    if (!this.alive) return;
    const player = this.ctx.player;
    const px = player.pos.x, pz = player.pos.z;
    const dx = px - this.position.x, dz = pz - this.position.z;
    const dist = Math.hypot(dx, dz);

    if (this._flash > 0) {
      this._flash = Math.max(0, this._flash - dt * 4);
      this.sprite.material.color.setRGB(1, 1 - this._flash * 0.7, 1 - this._flash * 0.7);
    }

    // wake up
    if (!this.aggro && dist < this.def.awaken && hasLOS(this.ctx.collision, this.position.x, this.position.z, px, pz)) {
      this.aggro = true;
    }
    if (!this.aggro) { this._syncSprite(); return; }

    this.attackTimer = Math.max(0, this.attackTimer - dt);
    const los = hasLOS(this.ctx.collision, this.position.x, this.position.z, px, pz);

    const inMelee = dist <= this.def.melee;
    const wantRanged = this.def.ranged && los && dist <= this.def.rangedRange && dist > this.def.melee;

    if (!inMelee && !wantRanged) {
      // chase: move toward the player, sliding along walls
      const nx = this.position.x + (dx / (dist || 1)) * this.def.speed * dt;
      const nz = this.position.z + (dz / (dist || 1)) * this.def.speed * dt;
      const r = this.hitRadius;
      if (!this.ctx.collision.collides(nx, this.position.z, r)) this.position.x = nx;
      if (!this.ctx.collision.collides(this.position.x, nz, r)) this.position.z = nz;
    }

    // attacks
    if (inMelee && this.attackTimer === 0) {
      this.attackTimer = this.def.cooldown;
      this.ctx.onPlayerDamage(this.def.damage, this);
    } else if (wantRanged && this.attackTimer === 0) {
      this.attackTimer = this.def.cooldown;
      this.ctx.onPlayerDamage(this.def.damage * 0.8, this);
      const from = this.position.clone(); from.y = 1.2;
      const to = new THREE.Vector3(px, 1.4, pz);
      this.ctx.onTracer?.(from, to, this.def.tracer);
    }

    this._syncSprite();
  }

  _syncSprite() {
    // subtle idle/chase bob
    const t = performance.now() * 0.004;
    this.sprite.position.set(this.position.x, 0.02 + (this.aggro ? Math.abs(Math.sin(t)) * 0.12 : 0), this.position.z);
  }
}

export function resetSpriteCache() { _spriteCache = {}; }
