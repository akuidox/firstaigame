// First-person controller: mouse-look, WASD movement with wall-sliding
// collision, stats, keys, and "use" (open doors). Weapon handling is delegated
// to the WeaponManager so weapons stay modular.

import * as THREE from 'three';
import { WORLD_SCALE as S } from '../world/tiles.js';

const EYE = 1.6;
const RADIUS = S * 0.28;
const SPEED = 7.5;
const ACCEL = 60;
const FRICTION = 12;
const MAX_PITCH = Math.PI / 2 - 0.05;

export class Player {
  constructor(camera, ctx) {
    this.camera = camera;
    this.ctx = ctx;               // { collision, doors, onMessage }
    this.yaw = 0;
    this.pitch = 0;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.health = 100;
    this.maxHealth = 100;
    this.armor = 0;
    this.speedMult = 1;           // set from upgrade mods
    this.keys = new Set();        // 'r' | 'g' | 'b'
    this.alive = true;
    this.bob = 0;
    this._hurtFlash = 0;
    this._shake = 0;
    this.hurtDir = 0;          // angle of last hit, relative to view (0 = ahead)
    this._hurtDirTimer = 0;
    this._useCooldown = 0;
    this.sensitivity = 0.0022;
    camera.rotation.order = 'YXZ';
  }

  spawn(x, z, yaw = 0) {
    this.pos.set(x, EYE, z);
    this.yaw = yaw;
    this.pitch = 0;
    this._syncCamera();
  }

  forwardVec() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  damage(amount, source) {
    if (!this.alive) return;
    // Armor soaks a third of incoming damage.
    if (this.armor > 0) {
      const soak = Math.min(this.armor, amount * 0.5);
      this.armor -= soak;
      amount -= soak;
    }
    this.health -= amount;
    this._hurtFlash = 1;
    this._shake = Math.min(1.2, this._shake + 0.7);
    if (source) {
      // bearing of the hit relative to where we're looking
      const dx = source.x - this.pos.x, dz = source.z - this.pos.z;
      const len = Math.hypot(dx, dz) || 1;
      const fwd = (dx * -Math.sin(this.yaw) + dz * -Math.cos(this.yaw)) / len;
      const rgt = (dx * Math.cos(this.yaw) + dz * -Math.sin(this.yaw)) / len;
      this.hurtDir = Math.atan2(rgt, fwd);
      this._hurtDirTimer = 1;
    }
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.ctx.onDeath?.();
    }
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  update(dt, input) {
    if (!this.alive) return;

    // --- look ---
    this.yaw -= input.mouseDX * this.sensitivity;
    this.pitch -= input.mouseDY * this.sensitivity;
    this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch));

    // --- movement (relative to yaw) ---
    const fwd = this.forwardVec();
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    let ix = 0, iz = 0;
    if (input.down('KeyW') || input.down('ArrowUp')) iz += 1;
    if (input.down('KeyS') || input.down('ArrowDown')) iz -= 1;
    if (input.down('KeyD') || input.down('ArrowRight')) ix += 1;
    if (input.down('KeyA') || input.down('ArrowLeft')) ix -= 1;

    const wish = new THREE.Vector3()
      .addScaledVector(fwd, iz)
      .addScaledVector(right, ix);
    if (wish.lengthSq() > 0) wish.normalize();

    // accelerate toward wish velocity, apply friction otherwise
    const target = wish.multiplyScalar(SPEED * this.speedMult);
    this.vel.x = approach(this.vel.x, target.x, (wish.lengthSq() ? ACCEL : FRICTION) * dt);
    this.vel.z = approach(this.vel.z, target.z, (wish.lengthSq() ? ACCEL : FRICTION) * dt);

    // --- collide & slide, axis by axis ---
    const c = this.ctx.collision;
    const nx = this.pos.x + this.vel.x * dt;
    if (!c.collides(nx, this.pos.z, RADIUS)) this.pos.x = nx; else this.vel.x = 0;
    const nz = this.pos.z + this.vel.z * dt;
    if (!c.collides(this.pos.x, nz, RADIUS)) this.pos.z = nz; else this.vel.z = 0;

    // --- use / open doors ---
    this._useCooldown = Math.max(0, this._useCooldown - dt);
    if ((input.pressed('KeyE') || input.pressed('Space')) && this._useCooldown === 0) {
      this._tryUse();
      this._useCooldown = 0.25;
    }

    // --- head bob ---
    const speed = Math.hypot(this.vel.x, this.vel.z);
    this.bob += dt * speed * 1.6;
    if (this._hurtFlash > 0) this._hurtFlash = Math.max(0, this._hurtFlash - dt * 3.2);
    if (this._shake > 0) this._shake = Math.max(0, this._shake - dt * 3.5);
    if (this._hurtDirTimer > 0) this._hurtDirTimer = Math.max(0, this._hurtDirTimer - dt * 1.2);

    this._syncCamera();
  }

  _tryUse() {
    const fwd = this.forwardVec();
    let best = null, bestDot = 0.2, bestDist = Infinity;
    for (const door of this.ctx.doors) {
      if (door.open) continue;
      const dx = door.mesh.position.x - this.pos.x;
      const dz = door.mesh.position.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > S * 1.6) continue;
      const dot = (dx * fwd.x + dz * fwd.z) / (dist || 1);
      if (dot > bestDot && dist < bestDist) { best = door; bestDist = dist; bestDot = dot; }
    }
    if (!best) return;
    const res = best.tryOpen(this.keys);
    if (res === 'locked') {
      const col = { r: 'red', g: 'green', b: 'blue' }[best.keyColor];
      this.ctx.onMessage?.(`You need the ${col} sigil.`);
    } else if (res === 'opened') {
      if (best.secret) { this.ctx.onMessage?.('You found a secret!'); this.ctx.onSecretFound?.(); }
      else this.ctx.onMessage?.(best.locked ? 'The sealed gate grinds open.' : 'The door creaks open.');
    }
  }

  _syncCamera() {
    const bobY = Math.sin(this.bob * 2) * 0.05;
    const sh = this._shake;
    const sx = sh ? (Math.random() - 0.5) * sh * 0.18 : 0;
    const sy = sh ? (Math.random() - 0.5) * sh * 0.18 : 0;
    this.camera.position.set(this.pos.x + sx, this.pos.y + bobY + sy, this.pos.z);
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = sh ? (Math.random() - 0.5) * sh * 0.04 : 0;
  }

  get hurtFlash() { return this._hurtFlash; }
  get hurtDirActive() { return this._hurtDirTimer; }
}

function approach(v, target, maxDelta) {
  if (v < target) return Math.min(v + maxDelta, target);
  if (v > target) return Math.max(v - maxDelta, target);
  return v;
}
