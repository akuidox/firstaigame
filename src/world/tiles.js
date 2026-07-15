// Tile legend for the text-grid map format.
//
// A level is an array of equal-length strings. Each character is one cell of a
// square grid (WORLD_SCALE units across). This is intentionally Doom/Wolf3D
// simple so the *level-design* agent can author maps by typing ASCII.
//
//   #  wall            +  door (opens when you walk up to it)
//   .  floor (space also = floor)
//   P  player start
//   e  imp        c  cultist       M  boss (mini-boss)
//   R  locked door RED    G  locked door GREEN    B  locked door BLUE
//   r  red key    g  green key     b  blue key
//   h  health pickup      a  ammo pickup          w  weapon pickup
//   t  wall torch (light + decoration)            E  exit trigger
//
// Anything not listed is treated as floor.

export const WORLD_SCALE = 3;   // world units per grid cell
export const WALL_HEIGHT = 3;   // world units

export const KEY_COLORS = {
  r: { name: 'red', hex: '#c0392b', light: 0xff5a4a },
  g: { name: 'green', hex: '#27ae60', light: 0x5aff7a },
  b: { name: 'blue', hex: '#2980d9', light: 0x5aa8ff },
};

// Which key each locked-door char requires.
export const LOCKED_DOORS = { R: 'r', G: 'g', B: 'b' };

export const WALL_CHARS = new Set(['#']);
export const DOOR_CHARS = new Set(['+', 'R', 'G', 'B']);

export function isBlockingChar(ch) {
  return WALL_CHARS.has(ch) || DOOR_CHARS.has(ch);
}

export function isFloorLike(ch) {
  // Cells the player can stand on / entities can occupy.
  return !WALL_CHARS.has(ch);
}
