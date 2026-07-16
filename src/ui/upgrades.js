// Between-level intermission: spend skill points on the upgrade tree, then
// descend. Reads a Progression instance and re-renders after each purchase.
// This is the seam for the UX/UI agent to restyle.

import { UPGRADES } from '../systems/progression.js';

const AMBER = '#e8c14a';

export class UpgradeScreen {
  constructor(root) {
    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      position: 'absolute', inset: '0', zIndex: '20', display: 'none',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Courier New', monospace", color: AMBER, pointerEvents: 'auto',
      background: 'radial-gradient(circle at 50% 35%, rgba(20,26,40,0.9), rgba(3,3,7,0.97))',
      padding: '24px', overflow: 'auto',
    });
    root.appendChild(this.el);
  }

  show(prog, cbs) { this._prog = prog; this._cbs = cbs; this.el.style.display = 'flex'; this._render(); }
  hide() { this.el.style.display = 'none'; }

  _render() {
    const p = this._prog;
    const xpNeed = p.xpForLevel();
    const pct = Math.min(100, (p.xp / xpNeed) * 100);
    const rows = UPGRADES.map((u) => {
      const lvl = p.levelOf(u.id), maxed = p.maxedOf(u.id), can = p.canBuy(u.id);
      const pips = Array.from({ length: u.max }, (_, i) =>
        `<span style="display:inline-block;width:10px;height:10px;margin:0 1px;border:1px solid ${AMBER};
          background:${i < lvl ? AMBER : 'transparent'}"></span>`).join('');
      return `<div style="display:flex;align-items:center;gap:12px;padding:8px 12px;margin:5px 0;
                width:520px;max-width:88vw;background:rgba(0,0,0,0.35);border:1px solid rgba(232,193,74,0.25);border-radius:5px">
        <div style="flex:1">
          <div style="font-size:15px;color:#fff">${u.name} <span style="opacity:.6;font-size:12px">${u.desc}</span></div>
          <div style="margin-top:4px">${pips}</div>
        </div>
        <button data-buy="${u.id}" ${can ? '' : 'disabled'} style="
          font-family:inherit;font-size:20px;width:40px;height:40px;cursor:${can ? 'pointer' : 'default'};
          color:${can ? '#0a0a0a' : 'rgba(232,193,74,0.3)'};background:${can ? AMBER : 'transparent'};
          border:2px solid ${can ? AMBER : 'rgba(232,193,74,0.3)'};border-radius:5px">${maxed ? '✓' : '+'}</button>
      </div>`;
    }).join('');

    this.el.innerHTML = `
      <div style="font-size:34px;letter-spacing:4px;color:#8affa0">VAULT CLEARED</div>
      <div style="opacity:.75;margin:6px 0 14px;font-size:14px">${this._cbs.clearedName} — descending to <b>${this._cbs.nextName}</b></div>
      <div style="display:flex;gap:24px;align-items:center;margin-bottom:8px;font-size:14px">
        <div>Level <b style="color:#fff">${p.level}</b></div>
        <div style="width:180px;height:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(232,193,74,0.4);border-radius:4px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:linear-gradient(#c9b0ff,#7a5cff)"></div>
        </div>
        <div>Skill points: <b style="color:${p.skillPoints ? '#8affa0' : '#fff'}">${p.skillPoints}</b></div>
      </div>
      <div>${rows}</div>
      <button id="descend" style="margin-top:16px;font-family:inherit;font-size:20px;letter-spacing:2px;
        color:#fff;background:rgba(122,92,255,0.25);border:2px solid #7a5cff;border-radius:6px;
        padding:10px 26px;cursor:pointer">DESCEND ▶</button>
      <div id="savecode" style="margin-top:10px;font-size:11px;opacity:.55;cursor:pointer">copy save code</div>
    `;

    this.el.querySelectorAll('[data-buy]').forEach((b) =>
      b.addEventListener('click', () => { if (this._cbs.onBuy(b.dataset.buy)) this._render(); }));
    this.el.querySelector('#descend').addEventListener('click', () => this._cbs.onDescend());
    const sc = this.el.querySelector('#savecode');
    sc.addEventListener('click', async () => {
      const code = this._cbs.onExportCode();
      try { await navigator.clipboard.writeText(code); sc.textContent = 'save code copied!'; }
      catch { sc.textContent = code; sc.style.userSelect = 'text'; }
    });
  }
}
