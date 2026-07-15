// Turns a text-grid level into Three.js geometry, a collision map, doors, and a
// list of spawn points. Rendering and collision are kept separate: walls are
// drawn with an InstancedMesh (fast), while collision is a Set of blocked cells
// that doors mutate as they open.

import * as THREE from 'three';
import { WORLD_SCALE as S, WALL_HEIGHT as H, KEY_COLORS, LOCKED_DOORS, isBlockingChar } from './tiles.js';
import {
  makeWallTexture, makeFloorTexture, makeCeilingTexture, makeDoorTexture,
} from '../core/assets.js';

// Grid cell -> world center. Y is up; the floor sits at y=0.
export function cellToWorld(gx, gy) {
  return new THREE.Vector3(gx * S, 0, gy * S);
}

class Collision {
  constructor(W, Hgt) {
    this.W = W; this.H = Hgt;
    this.blocked = new Set();
  }
  key(gx, gy) { return gx + ',' + gy; }
  set(gx, gy, on) { on ? this.blocked.add(this.key(gx, gy)) : this.blocked.delete(this.key(gx, gy)); }
  isCellBlocked(gx, gy) {
    if (gx < 0 || gy < 0 || gx >= this.W || gy >= this.H) return true;
    return this.blocked.has(this.key(gx, gy));
  }
  // Circle vs blocked-cell test in world space. Cell (gx,gy) spans a square of
  // side S centered on its world position.
  collides(x, z, r) {
    const cx = Math.round(x / S), cz = Math.round(z / S);
    for (let gy = cz - 1; gy <= cz + 1; gy++) {
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        if (!this.isCellBlocked(gx, gy)) continue;
        const minX = gx * S - S / 2, maxX = gx * S + S / 2;
        const minZ = gy * S - S / 2, maxZ = gy * S + S / 2;
        const nx = Math.max(minX, Math.min(x, maxX));
        const nz = Math.max(minZ, Math.min(z, maxZ));
        const dx = x - nx, dz = z - nz;
        if (dx * dx + dz * dz < r * r) return true;
      }
    }
    return false;
  }
}

class Door {
  constructor(mesh, gx, gy, collision, opts) {
    this.mesh = mesh;
    this.gx = gx; this.gy = gy;
    this.collision = collision;
    this.locked = opts.locked || false;
    this.keyColor = opts.keyColor || null;   // 'r' | 'g' | 'b'
    this.opening = false;
    this.open = false;
    this.t = 0;
    this.closedY = mesh.position.y;
  }
  // Try to open. Returns 'opened' | 'locked' | 'busy' | null.
  tryOpen(heldKeys) {
    if (this.open || this.opening) return null;
    if (this.locked && !heldKeys.has(this.keyColor)) return 'locked';
    this.opening = true;
    return 'opened';
  }
  update(dt) {
    if (!this.opening) return;
    this.t = Math.min(1, this.t + dt * 1.6);
    this.mesh.position.y = this.closedY + this.t * (H + 0.2);
    if (this.t >= 1 && !this.open) {
      this.open = true;
      this.opening = false;
      this.collision.set(this.gx, this.gy, false); // walkable now
      this.mesh.visible = false;
    }
  }
}

export function buildLevel(scene, level) {
  const grid = level.grid;
  const Hgt = grid.length, W = grid[0].length;
  const group = new THREE.Group();
  scene.add(group);

  const collision = new Collision(W, Hgt);
  const doors = [];
  const spawns = { player: null, enemies: [], pickups: [], exit: null, torches: [] };

  // --- floor & ceiling (segmented so torch light falls off smoothly) ---------
  const floorTex = makeFloorTexture();
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(W, Hgt);
  const ceilTex = makeCeilingTexture();
  ceilTex.wrapS = ceilTex.wrapT = THREE.RepeatWrapping;
  ceilTex.repeat.set(W, Hgt);

  const planeGeo = new THREE.PlaneGeometry(W * S, Hgt * S, W, Hgt);
  const cx = (W - 1) * S / 2, cz = (Hgt - 1) * S / 2;

  const floor = new THREE.Mesh(planeGeo, new THREE.MeshLambertMaterial({ map: floorTex }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  group.add(floor);

  const ceil = new THREE.Mesh(planeGeo, new THREE.MeshLambertMaterial({ map: ceilTex }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(cx, H, cz);
  group.add(ceil);

  // --- walls (instanced) -----------------------------------------------------
  const wallCells = [];
  for (let gy = 0; gy < Hgt; gy++)
    for (let gx = 0; gx < W; gx++)
      if (grid[gy][gx] === '#') wallCells.push([gx, gy]);

  const wallGeo = new THREE.BoxGeometry(S, H, S);
  const wallMat = new THREE.MeshLambertMaterial({ map: makeWallTexture() });
  const walls = new THREE.InstancedMesh(wallGeo, wallMat, wallCells.length);
  const m = new THREE.Matrix4();
  wallCells.forEach(([gx, gy], i) => {
    m.makeTranslation(gx * S, H / 2, gy * S);
    walls.setMatrixAt(i, m);
    collision.set(gx, gy, true);
  });
  walls.instanceMatrix.needsUpdate = true;
  group.add(walls);
  const solids = [walls]; // things that occlude shots; door meshes appended below

  // --- everything else, cell by cell -----------------------------------------
  for (let gy = 0; gy < Hgt; gy++) {
    for (let gx = 0; gx < W; gx++) {
      const ch = grid[gy][gx];
      const p = cellToWorld(gx, gy);

      switch (ch) {
        case 'P':
          spawns.player = { x: p.x, z: p.z, gx, gy };
          break;
        case 'e': spawns.enemies.push({ kind: 'imp', x: p.x, z: p.z }); break;
        case 'c': spawns.enemies.push({ kind: 'cultist', x: p.x, z: p.z }); break;
        case 'M': spawns.enemies.push({ kind: 'boss', x: p.x, z: p.z }); break;
        case 'h': spawns.pickups.push({ kind: 'health', x: p.x, z: p.z }); break;
        case 'a': spawns.pickups.push({ kind: 'ammo', x: p.x, z: p.z }); break;
        case 'w': spawns.pickups.push({ kind: 'weapon', x: p.x, z: p.z }); break;
        case 'r': case 'g': case 'b':
          spawns.pickups.push({ kind: 'key', color: ch, x: p.x, z: p.z });
          break;
        case 't':
          spawns.torches.push({ x: p.x, z: p.z });
          break;
        case 'E':
          spawns.exit = { x: p.x, z: p.z, gx, gy };
          break;
        default:
          if (ch === '+' || LOCKED_DOORS[ch]) {
            const locked = !!LOCKED_DOORS[ch];
            const keyColor = locked ? LOCKED_DOORS[ch] : null;
            const hex = locked ? KEY_COLORS[keyColor].hex : '#6a4a2a';
            const doorGeo = new THREE.BoxGeometry(S, H, S * 0.35);
            const doorMat = new THREE.MeshLambertMaterial({ map: makeDoorTexture(hex) });
            const mesh = new THREE.Mesh(doorGeo, doorMat);
            // Orient the door across the corridor: face whichever axis is open.
            const openNS = !isBlockingChar(grid[gy - 1]?.[gx] ?? '#') || !isBlockingChar(grid[gy + 1]?.[gx] ?? '#');
            const openEW = !isBlockingChar(grid[gy]?.[gx - 1] ?? '#') || !isBlockingChar(grid[gy]?.[gx + 1] ?? '#');
            if (openEW && !openNS) mesh.rotation.y = Math.PI / 2;
            mesh.position.set(p.x, H / 2, p.z);
            group.add(mesh);
            solids.push(mesh);
            collision.set(gx, gy, true); // blocks until opened
            doors.push(new Door(mesh, gx, gy, collision, { locked, keyColor }));
          }
          break;
      }
    }
  }

  return { group, collision, doors, spawns, solids, walls, dims: { W, H: Hgt } };
}
