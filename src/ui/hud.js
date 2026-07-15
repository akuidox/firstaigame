// In-game HUD: crosshair, stats, keys, weapon viewmodel (with recoil + muzzle
// flash), damage vignette, boss bar, and a transient message line. Pure DOM
// overlay so it stays crisp at any resolution. This is the seam for the UX/UI
// agent — restyle here without touching gameplay.

import { KEY_COLORS } from '../world/tiles.js';

const AMBER = '#e8c14a';

export class Hud {
  constructor(root) {
    this.root = root;
    this._msg = '';
    this._msgTimer = 0;
    this._build();
    this._drawViewmodel('staff');
    this._lastWeapon = 'staff';
  }

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

    // crosshair
    const ch = this._el('div', {
      position: 'absolute', left: '50%', top: '50%', width: '18px', height: '18px',
      transform: 'translate(-50%,-50%)',
    });
    ch.innerHTML = `<div style="position:absolute;left:8px;top:0;width:2px;height:18px;background:${AMBER};opacity:.8"></div>
                    <div style="position:absolute;left:0;top:8px;width:18px;height:2px;background:${AMBER};opacity:.8"></div>`;

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

    // damage vignette
    const hurt = Math.max(s.hurt || 0, 0);
    this.vignette.style.boxShadow = `inset 0 0 200px 60px rgba(180,0,0,${hurt * 0.6})`;

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
