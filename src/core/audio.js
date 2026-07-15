// Tiny WebAudio SFX — everything is synthesized, so there are still zero asset
// files. Must be unlocked by a user gesture (the start click calls resume()).

export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }
  resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    }
    this.ctx.resume?.();
  }
  _blip({ type = 'square', f0 = 440, f1 = f0, dur = 0.1, gain = 0.5, noise = false }) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    g.connect(this.master);
    if (noise) {
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = this.ctx.createBufferSource(); src.buffer = buf; src.connect(g); src.start(t);
    } else {
      const o = this.ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      o.connect(g); o.start(t); o.stop(t + dur);
    }
  }
  play(name) {
    switch (name) {
      case 'staff': this._blip({ type: 'sawtooth', f0: 720, f1: 180, dur: 0.12, gain: 0.4 }); break;
      case 'inferno': this._blip({ noise: true, dur: 0.22, gain: 0.6 }); this._blip({ type: 'square', f0: 160, f1: 60, dur: 0.2, gain: 0.4 }); break;
      case 'empty': this._blip({ type: 'square', f0: 120, f1: 90, dur: 0.06, gain: 0.25 }); break;
      case 'hit': this._blip({ type: 'square', f0: 300, f1: 120, dur: 0.08, gain: 0.35 }); break;
      case 'hurt': this._blip({ type: 'sawtooth', f0: 200, f1: 70, dur: 0.2, gain: 0.5 }); break;
      case 'pickup': this._blip({ type: 'triangle', f0: 520, f1: 900, dur: 0.14, gain: 0.4 }); break;
      case 'key': this._blip({ type: 'triangle', f0: 660, f1: 1200, dur: 0.22, gain: 0.45 }); break;
      case 'door': this._blip({ type: 'sawtooth', f0: 90, f1: 50, dur: 0.4, gain: 0.4 }); break;
      case 'locked': this._blip({ type: 'square', f0: 140, f1: 100, dur: 0.12, gain: 0.3 }); break;
      case 'kill': this._blip({ type: 'square', f0: 240, f1: 60, dur: 0.25, gain: 0.45 }); break;
      case 'boss': this._blip({ type: 'sawtooth', f0: 70, f1: 40, dur: 0.6, gain: 0.6 }); break;
      case 'win': this._blip({ type: 'triangle', f0: 440, f1: 880, dur: 0.5, gain: 0.5 }); break;
    }
  }
}
