// Moving projectiles shared by the player's Chaos Orb (AoE) and enemy ranged
// attacks (dodgeable bolts). Kept generic so new projectile weapons/enemies
// just call spawn() with different numbers.

import * as THREE from 'three';
import { WORLD_SCALE as S } from '../world/tiles.js';
import { makeOrbTexture } from '../core/assets.js';

const _texCache = {};
function orbTex(hex) {
  const key = hex;
  if (!_texCache[key]) _texCache[key] = makeOrbTexture(hex);
  return _texCache[key];
}

export class Projectiles {
  constructor(scene, ctx) {
    // ctx: { collision, player, getEnemies, onPlayerDamage, onKill, onHit, onExplode }
    this.scene = scene;
    this.ctx = ctx;
    this.list = [];
  }

  // opts: { x, z, dx, dz, speed, damage, from:'player'|'enemy', splash?, color, size? }
  spawn(opts) {
    const y = 1.2;
    const size = opts.size || (opts.from === 'player' ? 0.7 : 0.5);
    const hex = opts.color || (opts.from === 'player' ? '#9a3cff' : '#8affff');
    const mat = new THREE.SpriteMaterial({ map: orbTex(hex), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(size, size, 1);
    sprite.position.set(opts.x, y, opts.z);
    this.scene.add(sprite);
    const len = Math.hypot(opts.dx, opts.dz) || 1;
    this.list.push({
      sprite, x: opts.x, y, z: opts.z,
      vx: (opts.dx / len) * opts.speed, vz: (opts.dz / len) * opts.speed,
      damage: opts.damage, splash: opts.splash || 0, from: opts.from,
      color: hex, radius: size * 0.5, life: 4,
    });
  }

  update(dt) {
    const player = this.ctx.player;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      p.x += p.vx * dt; p.z += p.vz * dt;
      p.sprite.position.set(p.x, p.y, p.z);
      p.sprite.material.rotation += dt * 6;

      let hit = false;
      // walls
      if (this.ctx.collision.collides(p.x, p.z, p.radius)) hit = true;

      if (!hit && p.from === 'player') {
        for (const e of this.ctx.getEnemies()) {
          if (!e.alive) continue;
          const dx = e.position.x - p.x, dz = e.position.z - p.z;
          if (dx * dx + dz * dz < (e.hitRadius + p.radius) ** 2) { hit = true; break; }
        }
      } else if (!hit && p.from === 'enemy') {
        const dx = player.pos.x - p.x, dz = player.pos.z - p.z;
        if (dx * dx + dz * dz < (S * 0.3 + p.radius) ** 2) { hit = true; }
      }

      if (hit || p.life <= 0) {
        if (hit) this._impact(p);
        this._remove(i);
      }
    }
  }

  _impact(p) {
    if (p.from === 'player') {
      let any = false;
      if (p.splash > 0) {
        for (const e of this.ctx.getEnemies()) {
          if (!e.alive) continue;
          const d = Math.hypot(e.position.x - p.x, e.position.z - p.z);
          if (d <= p.splash) {
            const falloff = 1 - d / p.splash * 0.6;
            const dead = e.damage(p.damage * falloff, { x: p.x, z: p.z });
            any = true;
            if (dead) this.ctx.onKill?.(e);
          }
        }
      }
      if (any) this.ctx.onHit?.();
      this.ctx.onExplode?.({ x: p.x, y: p.y, z: p.z }, p.splash, p.color);
    } else {
      // enemy bolt hitting the player
      this.ctx.onPlayerDamage?.(p.damage, { x: p.x, z: p.z });
      this.ctx.onExplode?.({ x: p.x, y: p.y, z: p.z }, 0.6, p.color);
    }
  }

  _remove(i) {
    const p = this.list[i];
    this.scene.remove(p.sprite);
    p.sprite.material.dispose();
    this.list.splice(i, 1);
  }

  clear() { for (let i = this.list.length - 1; i >= 0; i--) this._remove(i); }
}
