// Procedural art: everything is drawn to a <canvas> at build/run time, so the
// game ships with zero image files and still looks deliberately retro.
//
// This module is the seam for the *graphiste* agent: to restyle the game,
// change the pixel grids and palettes here (or swap in real textures) without
// touching gameplay code. Keep the returned object shapes stable.

import * as THREE from 'three';

// --- low-level helpers -------------------------------------------------------

function canvas(size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function retro(texture) {
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Draw a grid of colored pixels described by `rows` (array of strings) using a
// palette map { char: '#rrggbb' | null }. `null`/space = transparent.
function drawPixels(ctx, rows, palette, px) {
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const col = palette[row[x]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x * px, y * px, px, px);
    }
  }
}

function value(seed) {
  // deterministic pseudo-random in [0,1)
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// --- world textures ----------------------------------------------------------

export function makeWallTexture() {
  const c = canvas(64);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2a2320';
  ctx.fillRect(0, 0, 64, 64);
  // stone bricks, offset per row
  const bw = 32, bh = 16;
  for (let row = 0; row < 4; row++) {
    const offset = row % 2 ? bw / 2 : 0;
    for (let x = -bw; x < 64 + bw; x += bw) {
      const bx = x + offset, by = row * bh;
      const shade = 34 + Math.floor(value(row * 7 + x) * 22);
      ctx.fillStyle = `rgb(${shade + 8}, ${shade}, ${shade - 6})`;
      ctx.fillRect(bx + 1, by + 1, bw - 2, bh - 2);
      // mortar shadow
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(bx, by, bw, 1);
      ctx.fillRect(bx, by, 1, bh);
      // speckle
      ctx.fillStyle = 'rgba(255,240,200,0.05)';
      ctx.fillRect(bx + 4 + (value(bx) * 20 | 0), by + 4 + (value(by) * 6 | 0), 2, 2);
    }
  }
  return retro(new THREE.CanvasTexture(c));
}

export function makeFloorTexture() {
  const c = canvas(64);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#191512';
  ctx.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 16) {
    for (let x = 0; x < 64; x += 16) {
      const shade = 20 + Math.floor(value(x * 3 + y) * 16);
      ctx.fillStyle = `rgb(${shade + 4}, ${shade}, ${shade - 4})`;
      ctx.fillRect(x + 1, y + 1, 14, 14);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x, y, 16, 1);
      ctx.fillRect(x, y, 1, 16);
    }
  }
  return retro(new THREE.CanvasTexture(c));
}

export function makeCeilingTexture() {
  const c = canvas(64);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#141013';
  ctx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 200; i++) {
    const shade = 12 + Math.floor(value(i) * 14);
    ctx.fillStyle = `rgb(${shade}, ${shade - 2}, ${shade + 2})`;
    ctx.fillRect((value(i * 2) * 64) | 0, (value(i * 3) * 64) | 0, 2, 2);
  }
  return retro(new THREE.CanvasTexture(c));
}

export function makeDoorTexture(hex = '#8a1c1c') {
  const c = canvas(64);
  const ctx = c.getContext('2d');
  // metal frame
  ctx.fillStyle = '#3a3330';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = hex;
  ctx.fillRect(6, 4, 52, 56);
  // rivets
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  for (const [x, y] of [[10, 8], [54, 8], [10, 56], [54, 56]]) {
    ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill();
  }
  // keyhole crest
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(28, 26, 8, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(8, 6, 48, 2);
  return retro(new THREE.CanvasTexture(c));
}

// --- sprites (billboarded pixel art) -----------------------------------------

// Palettes keyed to the grids below.
const P = {
  imp: { r: '#7a1f14', d: '#4a120b', y: '#e8a33d', w: '#ffe9b0', k: '#1a0805', e: '#ffd23f', '.': null, ' ': null },
  boss: { r: '#5a0f2a', d: '#2e0714', y: '#c9433f', h: '#e8c14a', k: '#120306', e: '#ff3b3b', b: '#8b1a1a', '.': null, ' ': null },
  cultist: { r: '#3a2a5a', d: '#221540', s: '#c9b48a', y: '#e8d29a', k: '#0e0820', e: '#8affff', '.': null, ' ': null },
};

const SPRITES = {
  imp: [
    '..k..k..',
    '.kkrrkk.',
    'krerrekr',
    'krrrrrrk',
    'kryrrykr',
    '.krrrrk.',
    '.dk..kd.',
    '.d....d.',
  ],
  cultist: [
    '..dddd..',
    '.dksskd.',
    '.dseesd.',
    '.dkkkkd.',
    'ddrrrrdd',
    'drrrrrrd',
    '.drrrrd.',
    '.dd..dd.',
  ],
  boss: [
    '.b.bb.b.',
    'bbrrrrbb',
    'brereereb',
    'brrrrrrb',
    'bhyrryhb',
    'bbrrrrbb',
    '.brrrrb.',
    'bd.bb.db',
  ],
};

export function makeEnemySprite(kind) {
  const rows = SPRITES[kind] || SPRITES.imp;
  const px = 8;
  const w = rows[0].length * px;
  const h = rows.length * px;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  drawPixels(ctx, rows, P[kind] || P.imp, px);
  const tex = retro(new THREE.CanvasTexture(c));
  return { texture: tex, aspect: w / h };
}

// --- pickup icons (for both the 3D world sprite and the HUD) -----------------

function iconCanvas(draw, size = 32) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  return c;
}

export function makeKeycardTexture(hex) {
  const c = iconCanvas((ctx, s) => {
    ctx.fillStyle = hex;
    ctx.fillRect(s * 0.2, s * 0.28, s * 0.6, s * 0.44);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(s * 0.28, s * 0.36, s * 0.18, s * 0.12);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(s * 0.2, s * 0.28, s * 0.6, 2);
  });
  return retro(new THREE.CanvasTexture(c));
}

export function makeHealthTexture() {
  const c = iconCanvas((ctx, s) => {
    ctx.fillStyle = '#e8e0d0';
    ctx.fillRect(s * 0.18, s * 0.18, s * 0.64, s * 0.64);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(s * 0.42, s * 0.28, s * 0.16, s * 0.44);
    ctx.fillRect(s * 0.28, s * 0.42, s * 0.44, s * 0.16);
  });
  return retro(new THREE.CanvasTexture(c));
}

export function makeAmmoTexture() {
  const c = iconCanvas((ctx, s) => {
    ctx.fillStyle = '#e8951f';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(s * (0.24 + i * 0.2), s * 0.3, s * 0.12, s * 0.4);
      ctx.fillStyle = '#ffd27f';
      ctx.fillRect(s * (0.24 + i * 0.2), s * 0.26, s * 0.12, s * 0.06);
      ctx.fillStyle = '#e8951f';
    }
  });
  return retro(new THREE.CanvasTexture(c));
}

export function makeWeaponPickupTexture() {
  const c = iconCanvas((ctx, s) => {
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(s * 0.2, s * 0.44, s * 0.6, s * 0.14); // stock
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(s * 0.5, s * 0.3, s * 0.34, s * 0.1); // barrel
    ctx.fillStyle = '#e8951f';
    ctx.fillRect(s * 0.76, s * 0.28, s * 0.1, s * 0.14); // muzzle glow
  });
  return retro(new THREE.CanvasTexture(c));
}
