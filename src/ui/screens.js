// Full-screen menus: start, victory, game-over. Each captures a click and fires
// a callback. Kept separate from the HUD so the game's state machine can show
// exactly one at a time.

const AMBER = '#e8c14a';

export class Screens {
  constructor(root) {
    this.root = root;
    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      position: 'absolute', inset: '0', zIndex: '20', display: 'none',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', fontFamily: "'Courier New', monospace", color: AMBER,
      background: 'radial-gradient(circle at 50% 40%, rgba(30,10,20,0.82), rgba(4,2,6,0.95))',
      cursor: 'pointer', pointerEvents: 'auto', userSelect: 'none', padding: '24px',
    });
    root.appendChild(this.el);
    this._onClick = null;
    this.el.addEventListener('click', () => this._onClick?.());
  }

  _show(html, onClick) {
    this.el.innerHTML = html;
    this._onClick = onClick;
    this.el.style.display = 'flex';
  }

  hide() { this.el.style.display = 'none'; this._onClick = null; }

  showStart(onStart) {
    this._show(`
      <div style="font-size:64px;letter-spacing:10px;color:#e8c14a;text-shadow:0 0 24px rgba(180,60,255,0.5)">GRIMHOLD</div>
      <div style="font-size:16px;opacity:.7;margin:6px 0 26px">The Crypts of the Fallen Warlock</div>
      <div style="max-width:520px;font-size:14px;line-height:1.9;opacity:.9;background:rgba(0,0,0,0.35);border:2px solid rgba(232,193,74,0.3);padding:16px 22px;border-radius:6px">
        <div style="color:#c9b0ff;margin-bottom:8px">Gather the sigils. Open the sealed gate. Slay what guards the way out.</div>
        <div><b>WASD / Arrows</b> — move &nbsp;·&nbsp; <b>Mouse</b> — look &nbsp;·&nbsp; <b>Click</b> — fire</div>
        <div><b>1 / 2</b> — weapons &nbsp;·&nbsp; <b>Q</b> — cycle &nbsp;·&nbsp; <b>E / Space</b> — open doors</div>
        <div><b>Esc</b> — release mouse</div>
      </div>
      <div style="margin-top:30px;font-size:22px;color:#fff;animation:none">▶ CLICK TO DESCEND</div>
    `, onStart);
  }

  showWin(stats, onRestart) {
    this._show(`
      <div style="font-size:52px;letter-spacing:6px;color:#8affa0;text-shadow:0 0 24px rgba(80,255,120,0.4)">THE GATE IS BREACHED</div>
      <div style="font-size:16px;opacity:.85;margin:16px 0 8px">You escape the crypts of Grimhold — for now.</div>
      <div style="font-size:15px;opacity:.8;line-height:1.8;margin-top:10px">
        Time: <b>${stats.time}</b> &nbsp;·&nbsp; Foes slain: <b>${stats.kills}/${stats.total}</b> &nbsp;·&nbsp; Sigils: <b>${stats.keys}</b>
      </div>
      <div style="margin-top:34px;font-size:20px;color:#fff">▶ CLICK TO DESCEND AGAIN</div>
    `, onRestart);
  }

  showLose(onRestart) {
    this._show(`
      <div style="font-size:56px;letter-spacing:6px;color:#ff5a5a;text-shadow:0 0 24px rgba(255,40,40,0.4)">YOU HAVE FALLEN</div>
      <div style="font-size:16px;opacity:.85;margin:16px 0 8px">The dark of Grimhold claims another soul.</div>
      <div style="margin-top:34px;font-size:20px;color:#fff">▶ CLICK TO RISE AGAIN</div>
    `, onRestart);
  }
}
