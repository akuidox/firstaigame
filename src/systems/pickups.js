// Floating, bobbing pickups. Collection is proximity-based. Keys also cast a
// colored glow so they read at a distance in the dark.

import * as THREE from 'three';
import { KEY_COLORS } from '../world/tiles.js';
import {
  makeHealthTexture, makeAmmoTexture, makeWeaponPickupTexture, makeKeycardTexture, makeOrbTexture,
} from '../core/assets.js';

const VALUES = { health: 25, ammo: 10, weaponAmmo: 14, orbAmmo: 4, soul: 2 };

let _tex = null;
function textures() {
  if (_tex) return _tex;
  _tex = {
    health: makeHealthTexture(),
    ammo: makeAmmoTexture(),
    weapon: makeWeaponPickupTexture(),
    orb: makeOrbTexture('#9a3cff'),
    soul: makeOrbTexture('#6a4cff'),
    keys: { r: makeKeycardTexture(KEY_COLORS.r.hex), g: makeKeycardTexture(KEY_COLORS.g.hex), b: makeKeycardTexture(KEY_COLORS.b.hex) },
  };
  return _tex;
}

export class Pickups {
  constructor(scene, spawns) {
    this.scene = scene;
    this.items = [];
    const T = textures();
    for (const s of spawns.pickups) {
      const tex = s.kind === 'key' ? T.keys[s.color] : T[s.kind];
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, fog: true });
      const sprite = new THREE.Sprite(mat);
      const size = s.kind === 'key' ? 0.7 : 0.8;
      sprite.scale.set(size, size, 1);
      sprite.position.set(s.x, 0.9, s.z);
      scene.add(sprite);

      let light = null;
      if (s.kind === 'key') {
        light = new THREE.PointLight(KEY_COLORS[s.color].light, 5, 7, 1.8);
        light.position.set(s.x, 1.0, s.z);
        scene.add(light);
      }
      this.items.push({ ...s, sprite, light, collected: false, base: 0.9 });
    }
    this._t = 0;
  }

  update(dt, player, weapons, onMessage) {
    this._t += dt;
    for (const it of this.items) {
      if (it.collected) continue;
      it.sprite.position.y = it.base + Math.sin(this._t * 2 + it.x) * 0.12;
      it.sprite.material.rotation += dt * 1.2;

      const dx = player.pos.x - it.x, dz = player.pos.z - it.z;
      if (dx * dx + dz * dz > 1.1 * 1.1) continue;

      // in range — try to collect (some pickups are refused when already full)
      if (this._apply(it, player, weapons, onMessage)) {
        it.collected = true;
        this.scene.remove(it.sprite);
        it.sprite.material.dispose();
        if (it.light) this.scene.remove(it.light);
      }
    }
  }

  _apply(it, player, weapons, onMessage) {
    switch (it.kind) {
      case 'health':
        if (player.health >= player.maxHealth) return false;
        player.heal(VALUES.health);
        onMessage?.(`+${VALUES.health} health`);
        return true;
      case 'ammo':
        weapons.addAmmo('fire', VALUES.ammo);
        onMessage?.(`+${VALUES.ammo} fire charges`);
        return true;
      case 'weapon':
        if (!weapons.owned.has('inferno')) {
          weapons.give('inferno', VALUES.weaponAmmo);
          onMessage?.('Picked up the INFERNO! (press 2)');
        } else {
          weapons.addAmmo('fire', VALUES.weaponAmmo);
          onMessage?.(`+${VALUES.weaponAmmo} fire charges`);
        }
        return true;
      case 'orb':
        if (!weapons.owned.has('chaosorb')) {
          weapons.give('chaosorb', VALUES.orbAmmo);
          onMessage?.('Picked up the CHAOS ORB! (press 3)');
        } else {
          weapons.addAmmo('soul', VALUES.orbAmmo);
          onMessage?.(`+${VALUES.orbAmmo} souls`);
        }
        return true;
      case 'soul':
        weapons.addAmmo('soul', VALUES.soul);
        onMessage?.(`+${VALUES.soul} souls`);
        return true;
      case 'key':
        player.keys.add(it.color);
        onMessage?.(`Found the ${KEY_COLORS[it.color].name} sigil.`);
        return true;
    }
    return false;
  }

  remaining(kind) {
    return this.items.filter((i) => !i.collected && i.kind === kind).length;
  }
}

export function resetPickupTextures() { _tex = null; }
