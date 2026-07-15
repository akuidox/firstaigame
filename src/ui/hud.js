// In-game HUD: crosshair, stats, keys, weapon viewmodel (with recoil + muzzle
// flash), damage vignette, boss bar, and a transient message line. Pure DOM
// overlay so it stays crisp at any resolution. This is the seam for the UX/UI
// agent — restyle here without touching gameplay.

import { KEY_COLORS } from '../world/tiles.js';

const AMBER = '#e8c14a';

function dot(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(1.2, r), 0, 7);
  ctx.fill();
}

export class Hud {
  constructor(root) {
    this.root = root;
    this._msg = '';
    this._msgTimer = 0;
    this._hitTimer = 0;
    this._build();
    this._drawViewmodel('staff');
    this._lastWeapon = 'staff';
  }

  setMap(grid) { this._grid = grid; }
  hitmarker() { this._hitTimer = 0.16; }

  _el(tag, style, parent) {
    const e = document.createElement(tag);
    Object.assign(e.style, style);
    (parent || this.overlay).appendChild(e);
    return e;
  }

  _build() {
    this.overlay = document.createElement('div');
    Object.assign(this.overlay.style, {
      position: 'absolute', inset: '0', pointerEvents: 'none',
      fontFamily: "'Courier New', monospace", color: AMBER,
      textShadow: '0 0 4px rgba(0,0,0,0.9)', zIndex: '10',
    });
    this.root.appendChild(this.overlay);

    // damage vignette
    this.vignette = this._el('div', {
      position: 'absolute', inset: '0',
      boxShadow: 'inset 0 0 200px 60px rgba(180,0,0,0.0)',
      transition: 'box-shadow 0.08s linear',
    });
    // full-screen red flash on taking a hit
    this.flashEl = this._el('div', {
      position: 'absolute', inset: '0', background: '#c00000', opacity: '0', mixBlendMode: 'multiply',
    });

    // crosshair
    const ch = this._el('div', {
      position: 'absolute', left: '50%', top: '50%', width: '18px', height: '18px',
      transform: 'translate(-50%,-50%)',
    });
    ch.innerHTML = `<div style="position:absolute;left:8px;top:0;width:2px;height:18px;background:${AMBER};opacity:.8"></div>
                    <div style="position:absolute;left:0;top:8px;width:18px;height:2px;background:${AMBER};opacity:.8"></div>`;

    // hitmarker (an X that pops when a shot connects)
    this.hitMark = this._el('div', {
      position: 'absolute', left: '50%', top: '50%', width: '26px', height: '26px',
      transform: 'translate(-50%,-50%)', opacity: '0',
    });
    this.hitMark.innerHTML = ['0', '90', '180', '270'].map((r) =>
      `<div style="position:absolute;left:50%;top:50%;width:10px;height:3px;background:#fff;
        transform:translate(-50%,-50%) rotate(45deg) translateX(9px) rotate(${r}deg);
        transform-origin:center"></div>`).join('');

    // directional damage indicator (points toward the source of the last hit)
    this.dmgArrow = this._el('div', {
      position: 'absolute', left: '50%', top: '50%', width: '0', height: '0', opacity: '0',
      borderLeft: '13px solid transparent', borderRight: '13px solid transparent',
      borderBottom: '20px solid rgba(255,40,40,0.9)',
    });

    // viewmodel (bottom-center)
    this.viewWrap = this._el('div', {
      position: 'absolute', left: '50%', bottom: '0', transform: 'translateX(-50%)',
      width: '340px', height: '260px', pointerEvents: 'none',
    });
    this.viewCanvas = document.createElement('canvas');
    this.viewCanvas.width = 170; this.viewCanvas.height = 130;
    Object.assign(this.viewCanvas.style, {
      position: 'absolute', left: '0', bottom: '0', width: '100%', height: '100%',
      imageRendering: 'pixelated',
    });
    this.viewWrap.appendChild(this.viewCanvas);
    this.muzzle = this._el('div', {
      position: 'absolute', left: '50%', top: '30px', width: '90px', height: '90px',
      transform: 'translateX(-50%)', borderRadius: '50%', opacity: '0',
      background: 'radial-gradient(circle, rgba(255,220,120,0.95), rgba(255,120,30,0.5) 45%, transparent 70%)',
    }, this.viewWrap);

    // stat panels
    const panel = (side) => this._el('div', {
      position: 'absolute', bottom: '14px', [side]: '18px',
      padding: '8px 14px', background: 'rgba(10,6,12,0.55)',
      border: `2px solid rgba(232,193,74,0.35)`, borderRadius: '4px',
      fontSize: '15px', lineHeight: '1.5', minWidth: '120px',
    });
    this.leftPanel = panel('left');
    this.rightPanel = panel('right');
    this.rightPanel.style.textAlign = 'right';

    // keys (top-left)
    this.keysBox = this._el('div', {
      position: 'absolute', top: '14px', left: '18px', display: 'flex', gap: '8px',
    });

    // minimap / automap (top-right)
    this.mapWrap = this._el('div', {
      position: 'absolute', top: '14px', right: '18px',
      padding: '6px', background: 'rgba(10,6,12,0.6)',
      border: '2px solid rgba(232,193,74,0.35)', borderRadius: '4px',
    });
    this.mapCanvas = document.createElement('canvas');
    this.mapCanvas.width = 150; this.mapCanvas.height = 132;
    Object.assign(this.mapCanvas.style, { display: 'block', width: '150px', height: '132px', imageRendering: 'auto' });
    this.mapWrap.appendChild(this.mapCanvas);
    this._grid = null;

    // message + objective (top-center)
    this.objective = this._el('div', {
      position: 'absolute', top: '14px', left: '50%', transform: 'translateX(-50%)',
      fontSize: '13px', opacity: '0.8', textAlign: 'center', maxWidth: '60%',
    });
    this.message = this._el('div', {
      position: 'absolute', top: '40px', left: '50%', transform: 'translateX(-50%)',
      fontSize: '18px', color: '#fff', textAlign: 'center', opacity: '0',
      transition: 'opacity 0.2s',
    });

    // boss bar (top, below message)
    this.bossWrap = this._el('div', {
      position: 'absolute', top: '70px', left: '50%', transform: 'translateX(-50%)',
      width: '46%', display: 'none', textAlign: 'center',
    });
    this.bossLabel = this._el('div', { fontSize: '12px', letterSpacing: '2px', marginBottom: '3px', color: '#ff8a8a' }, this.bossWrap);
    const barBg = this._el('div', {
      width: '100%', height: '12px', background: 'rgba(60,10,10,0.7)',
      border: '2px solid rgba(255,80,80,0.5)', borderRadius: '3px', overflow: 'hidden',
    }, this.bossWrap);
    this.bossFill = this._el('div', { width: '100%', height: '100%', background: 'linear-gradient(#ff5a5a,#a01010)' }, barBg);
  }

  message_(text) {
    this._msg = text;
    this._msgTimer = 2.5;
    this.message.textContent = text;
    this.message.style.opacity = '1';
  }

  tick(dt) {
    if (this._msgTimer > 0) {
      this._msgTimer -= dt;
      if (this._msgTimer <= 0) this.message.style.opacity = '0';
    }
    if (this._hitTimer > 0) this._hitTimer = Math.max(0, this._hitTimer - dt);
    this.hitMark.style.opacity = String((this._hitTimer / 0.16) * 0.95);
  }

  update(s) {
    // stats
    const hpColor = s.health <= 25 ? '#ff5a5a' : AMBER;
    this.leftPanel.innerHTML =
      `<div style="color:${hpColor}">✚ ${Math.ceil(s.health)}</div>` +
      `<div style="color:#7ab8ff">◈ ${Math.ceil(s.armor)}</div>`;
    const ammoStr = s.ammo === Infinity ? '∞' : s.ammo;
    this.rightPanel.innerHTML =
      `<div style="font-size:12px;opacity:.7">${s.weaponName}</div>` +
      `<div style="font-size:20px">⁍ ${ammoStr}</div>`;

    // keys
    this.keysBox.innerHTML = '';
    for (const k of ['r', 'g', 'b']) {
      const has = s.keys.has(k);
      const chip = document.createElement('div');
      Object.assign(chip.style, {
        width: '20px', height: '14px', borderRadius: '2px',
        background: has ? KEY_COLORS[k].hex : 'transparent',
        border: `2px solid ${KEY_COLORS[k].hex}`, opacity: has ? '1' : '0.28',
      });
      this.keysBox.appendChild(chip);
    }

    this.objective.textContent = s.objective || '';

    // damage vignette + flash + directional indicator
    const hurt = Math.max(s.hurt || 0, 0);
    this.vignette.style.boxShadow = `inset 0 0 220px 70px rgba(190,0,0,${hurt * 0.75})`;
    this.flashEl.style.opacity = String(hurt * 0.4);
    const dirA = s.hurtDirActive || 0;
    if (dirA > 0) {
      const deg = (s.hurtDir || 0) * 180 / Math.PI;
      this.dmgArrow.style.opacity = String(Math.min(1, dirA));
      this.dmgArrow.style.transform =
        `translate(-50%,-50%) rotate(${deg}deg) translateY(-94px) rotate(180deg)`;
    } else {
      this.dmgArrow.style.opacity = '0';
    }

    // viewmodel recoil + bob + flash
    if (s.weaponId !== this._lastWeapon) { this._drawViewmodel(s.weaponId); this._lastWeapon = s.weaponId; }
    const kick = (s.recoil || 0) * 26;
    this.viewCanvas.style.transform = `translateY(${kick}px)`;
    this.muzzle.style.opacity = String((s.flash || 0) * 0.95);

    // boss bar
    if (s.boss && s.boss.active) {
      this.bossWrap.style.display = 'block';
      this.bossLabel.textContent = s.boss.name;
      this.bossFill.style.width = Math.max(0, (s.boss.hp / s.boss.maxHp) * 100) + '%';
    } else {
      this.bossWrap.style.display = 'none';
    }

    if (s.map) this._drawMinimap(s.map);
  }

  _drawMinimap(m) {
    const grid = this._grid;
    if (!grid) return;
    const cv = this.mapCanvas, ctx = cv.getContext('2d');
    const H = grid.length, W = grid[0].length;
    const cell = Math.min(cv.width / W, cv.height / H);
    const ox = (cv.width - cell * W) / 2, oy = (cv.height - cell * H) / 2;
    const S = m.scale;
    const px = (wx, wz) => [ox + (wx / S) * cell, oy + (wz / S) * cell];

    ctx.clearRect(0, 0, cv.width, cv.height);
    // walls vs floor
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const ch = grid[y][x];
        ctx.fillStyle = ch === '#' ? '#4a3d34' : 'rgba(30,22,26,0.55)';
        ctx.fillRect(ox + x * cell, oy + y * cell, cell + 0.5, cell + 0.5);
      }
    }
    // doors (colored while shut, faded once open)
    for (const d of m.doors) {
      ctx.fillStyle = d.open ? 'rgba(120,90,60,0.4)'
        : (d.keyColor ? KEY_COLORS[d.keyColor].hex : '#8a6a3a');
      ctx.fillRect(ox + d.gx * cell, oy + d.gy * cell, cell + 0.5, cell + 0.5);
    }
    // exit
    if (m.exit) { const [x, y] = px(m.exit.x, m.exit.z); dot(ctx, x, y, cell * 0.55, '#7dff8a'); }
    // pickups
    for (const it of m.pickups) {
      if (it.collected) continue;
      const c = it.kind === 'key' ? KEY_COLORS[it.color].hex
        : it.kind === 'health' ? '#ff6a6a' : it.kind === 'ammo' ? '#e8951f' : '#6ad2ff';
      const [x, y] = px(it.x, it.z);
      dot(ctx, x, y, it.kind === 'key' ? cell * 0.5 : cell * 0.38, c);
    }
    // enemies
    for (const e of m.enemies) {
      if (!e.alive) continue;
      const [x, y] = px(e.position.x, e.position.z);
      dot(ctx, x, y, e.isBoss ? cell * 0.7 : cell * 0.4, e.isBoss ? '#ff3030' : '#ff5a4a');
    }
    // player arrow
    const [pxx, pyy] = px(m.px, m.pz);
    const fx = -Math.sin(m.yaw), fy = -Math.cos(m.yaw);
    const rx = -fy, ry = fx, len = cell * 1.1;
    ctx.fillStyle = '#ffe9b0';
    ctx.beginPath();
    ctx.moveTo(pxx + fx * len, pyy + fy * len);
    ctx.lineTo(pxx - fx * len * 0.5 + rx * len * 0.6, pyy - fy * len * 0.5 + ry * len * 0.6);
    ctx.lineTo(pxx - fx * len * 0.5 - rx * len * 0.6, pyy - fy * len * 0.5 - ry * len * 0.6);
    ctx.closePath(); ctx.fill();
  }

  _drawViewmodel(kind) {
    const c = this.viewCanvas, ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    const cx = c.width / 2;
    if (kind === 'inferno') {
      // stubby fire-cannon, held center
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(cx - 26, 70, 52, 60);   // stock
      ctx.fillStyle = '#555'; ctx.fillRect(cx - 16, 40, 32, 40);      // body
      ctx.fillStyle = '#777'; ctx.fillRect(cx - 10, 18, 20, 26);      // barrel
      ctx.fillStyle = '#e8951f'; ctx.fillRect(cx - 8, 12, 16, 8);     // muzzle glow
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(cx - 30, 96, 60, 10);
    } else {
      // arcane staff, held to the right, glowing tip
      ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx + 40, 130); ctx.lineTo(cx + 4, 26); ctx.stroke();
      ctx.fillStyle = '#7a5c9a'; ctx.beginPath(); ctx.arc(cx + 2, 22, 12, 0, 7); ctx.fill();
      ctx.fillStyle = '#c9b0ff'; ctx.beginPath(); ctx.arc(cx + 2, 22, 6, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(180,140,255,0.35)'; ctx.beginPath(); ctx.arc(cx + 2, 22, 18, 0, 7); ctx.fill();
    }
  }

  dispose() { this.overlay.remove(); }
}
