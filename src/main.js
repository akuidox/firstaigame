// Grimhold — entry point + game state machine.
// menu -> playing -> (win | lose) -> menu/playing
//
// Owns the renderer, scene, lights and the fixed pieces; delegates behaviour to
// Player, WeaponManager, Enemy, Pickups, Hud and Screens.

import * as THREE from 'three';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { buildLevel } from './world/levelBuilder.js';
import { WORLD_SCALE as S } from './world/tiles.js';
import { level1 } from './world/level1.js';
import { Player } from './entities/player.js';
import { Enemy, resetSpriteCache } from './entities/enemy.js';
import { WeaponManager } from './systems/weapons.js';
import { Pickups } from './systems/pickups.js';
import { Hud } from './ui/hud.js';
import { Screens } from './ui/screens.js';

const MAX_TORCH_LIGHTS = 6;

class Game {
  constructor(root) {
    this.root = root;
    this.state = 'menu';
    this.paused = false;

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    root.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(76, window.innerWidth / window.innerHeight, 0.05, 100);
    this.scene = new THREE.Scene();

    // player's torch: the light that "reveals" the dark. Follows the camera.
    this.torch = new THREE.PointLight(0xffb060, 14, 22, 1.4);
    this.scene.add(this.torch);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambient);

    this.input = new Input(this.renderer.domElement);
    this.audio = new Audio();
    this.hud = new Hud(root);
    this.screens = new Screens(root);
    this._buildPauseOverlay();

    this.levelGroup = null;
    this.tracers = [];
    this.clock = new THREE.Clock();

    this.input.onLockChange = (locked) => {
      if (this.state === 'playing') {
        if (!locked) this._pause();
        else this._resume();
      }
    };

    window.addEventListener('resize', () => this._onResize());

    this.buildWorld();
    this.screens.showStart(() => this.startGame());
    this.renderer.setAnimationLoop(() => this._frame());
  }

  _buildPauseOverlay() {
    this.pauseEl = document.createElement('div');
    Object.assign(this.pauseEl.style, {
      position: 'absolute', inset: '0', zIndex: '15', display: 'none',
      alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      background: 'rgba(4,2,6,0.6)', color: '#e8c14a', fontFamily: "'Courier New', monospace",
      fontSize: '22px', letterSpacing: '3px', pointerEvents: 'auto',
    });
    this.pauseEl.textContent = 'PAUSED — CLICK TO RESUME';
    this.pauseEl.addEventListener('click', () => this.input.requestLock());
    this.root.appendChild(this.pauseEl);
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  buildWorld() {
    // tear down previous level
    if (this.levelGroup) {
      this.scene.remove(this.levelGroup);
      this.levelGroup.traverse((o) => {
        o.geometry?.dispose?.();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
    }
    for (const e of this.enemies || []) if (e.alive) this.scene.remove(e.sprite);
    for (const t of this.tracers) this.scene.remove(t.line);
    this.tracers = [];
    resetSpriteCache();

    const lvl = level1;
    this.scene.background = new THREE.Color(lvl.fog.color);
    this.scene.fog = new THREE.Fog(lvl.fog.color, lvl.fog.near, lvl.fog.far);
    this.ambient.color.setHex(lvl.ambient);
    this.ambient.intensity = 0.22;

    const built = buildLevel(this.scene, lvl);
    this.levelGroup = built.group;
    this.collision = built.collision;
    this.doors = built.doors;
    this.solids = built.solids;
    const spawns = built.spawns;
    this.exit = spawns.exit;

    // torch lights (capped) + flame sprites
    spawns.torches.forEach((t, i) => {
      if (i < MAX_TORCH_LIGHTS) {
        const l = new THREE.PointLight(0xff8030, 10, 13, 1.6);
        l.position.set(t.x, 2.1, t.z);
        this.levelGroup.add(l);
      }
      const flame = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, fog: false }));
      flame.scale.set(0.35, 0.5, 1);
      flame.position.set(t.x, 2.1, t.z);
      this.levelGroup.add(flame);
    });

    // player
    this.player = new Player(this.camera, {
      collision: this.collision,
      doors: this.doors,
      onMessage: (m) => { this.hud.message_(m); if (/gate|door/i.test(m)) this.audio.play('door'); if (/need/i.test(m)) this.audio.play('locked'); },
      onDeath: () => this.lose(),
    });
    this.player.spawn(spawns.player.x, spawns.player.z, 0);

    // weapons
    this.weapons = new WeaponManager({
      camera: this.camera, scene: this.scene,
      getEnemies: () => this.enemies,
      getSolids: () => this.solids.filter((s) => s.visible),
      onKill: (e) => this.onKill(e),
      onFire: (kind) => this.audio.play(kind === 'empty' ? 'empty' : (this.weapons.current === 'inferno' ? 'inferno' : 'staff')),
    });

    // enemies
    const enemyCtx = {
      scene: this.scene, player: this.player, collision: this.collision,
      onPlayerDamage: (amt) => { this.player.damage(amt); this.audio.play('hurt'); },
      onTracer: (from, to, color) => this.spawnTracer(from, to, color, 0.08),
    };
    this.enemies = spawns.enemies.map((s) => new Enemy(s.kind, s.x, s.z, enemyCtx));
    this.boss = this.enemies.find((e) => e.isBoss) || null;
    this.totalEnemies = this.enemies.length;

    // pickups
    this.pickups = new Pickups(this.scene, spawns);

    this.kills = 0;
    this._menuYaw = 0;
  }

  startGame() {
    if (this.state === 'playing') return;
    this.audio.resume();
    if (this.state !== 'menu') this.buildWorld(); // fresh run after win/lose
    this.screens.hide();
    this.state = 'playing';
    this.paused = false;
    this.startTime = performance.now();
    this.input.requestLock();
  }

  _pause() { this.paused = true; this.pauseEl.style.display = 'flex'; }
  _resume() { this.paused = false; this.pauseEl.style.display = 'none'; }

  onKill(e) {
    this.kills++;
    this.audio.play(e.isBoss ? 'boss' : 'kill');
    if (e.isBoss) this.hud.message_('The guardian falls. The gate lies open ahead.');
  }

  spawnTracer(from, to, color, life) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 }));
    this.scene.add(line);
    this.tracers.push({ line, life, max: life });
  }

  _updateTracers(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / t.max) * 0.85;
      if (t.life <= 0) { this.scene.remove(t.line); t.line.geometry.dispose(); t.line.material.dispose(); this.tracers.splice(i, 1); }
    }
  }

  objectiveText() {
    if (!this.player.keys.has('r')) return 'Objective: find the RED sigil';
    const redDoor = this.doors.find((d) => d.keyColor === 'r');
    if (redDoor && !redDoor.open) return 'Objective: open the sealed RED gate';
    if (this.boss && this.boss.alive) return 'Objective: slay the guardian';
    return 'Objective: escape through the gate!';
  }

  win() {
    if (this.state !== 'playing') return;
    this.state = 'win';
    this.input.exitLock();
    this.audio.play('win');
    const secs = Math.max(0, (performance.now() - this.startTime) / 1000);
    const time = `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;
    this.screens.showWin({ time, kills: this.kills, total: this.totalEnemies, keys: this.player.keys.size }, () => this.startGame());
  }

  lose() {
    if (this.state !== 'playing') return;
    this.state = 'lose';
    this.audio.play('hurt');
    this.input.exitLock();
    this.screens.showLose(() => this.startGame());
  }

  _frame() {
    const dt = Math.min(0.05, this.clock.getDelta());

    if (this.state === 'playing' && !this.paused) {
      this.player.update(dt, this.input);
      this.weapons.update(dt, this.input);
      for (const e of this.enemies) e.update(dt);
      this.pickups.update(dt, this.player, this.weapons, (m) => {
        this.hud.message_(m);
        this.audio.play(/sigil/i.test(m) ? 'key' : 'pickup');
      });
      for (const d of this.doors) d.update(dt);
      this._updateTracers(dt);

      // exit: requires the guardian dead
      if (this.exit) {
        const dx = this.player.pos.x - this.exit.x, dz = this.player.pos.z - this.exit.z;
        if (dx * dx + dz * dz < (S * 0.8) ** 2) {
          if (this.boss && this.boss.alive) this.hud.message_('The gate resists — the guardian still lives.');
          else this.win();
        }
      }

      this.hud.tick(dt);
      this.hud.update({
        health: this.player.health, armor: this.player.armor, maxHealth: this.player.maxHealth,
        ammo: this.weapons.currentAmmo(), weaponName: this.weapons.def().name, weaponId: this.weapons.current,
        keys: this.player.keys, hurt: this.player.hurtFlash, flash: this.weapons.flash, recoil: this.weapons.recoil,
        objective: this.objectiveText(),
        boss: this.boss ? { active: this.boss.aggro && this.boss.alive, hp: this.boss.hp, maxHp: this.boss.maxHp, name: 'THE GUARDIAN' } : null,
      });

      // torch follows the eye
      this.torch.position.copy(this.camera.position);
    } else if (this.state === 'menu') {
      // slow idle orbit behind the title
      this._menuYaw += dt * 0.15;
      const s = this.player ? this.player.pos : new THREE.Vector3();
      this.camera.position.set(s.x, 1.6, s.z);
      this.camera.rotation.set(0, this._menuYaw, 0);
      this.torch.position.copy(this.camera.position);
    }

    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }
}

// boot
const root = document.getElementById('game');
window.__grimhold = new Game(root);
