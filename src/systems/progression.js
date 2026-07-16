// Run progression: XP from kills -> character levels -> skill points, spent on a
// small Warlock-style upgrade tree. Also derives the stat modifiers the player
// and weapons read, and serializes for saves. Decoupled so RPG depth can grow.

export const UPGRADES = [
  { id: 'vitality', name: 'Vitality', desc: '+20 max health', max: 5 },
  { id: 'power', name: 'Power', desc: '+12% weapon damage', max: 5 },
  { id: 'swiftness', name: 'Swiftness', desc: '+8% move speed', max: 4 },
  { id: 'warding', name: 'Warding', desc: '+15 armor each level', max: 4 },
  { id: 'rapidity', name: 'Rapidity', desc: '+10% fire rate', max: 4 },
  { id: 'cataclysm', name: 'Cataclysm', desc: '+20% Chaos Orb blast', max: 3 },
];

const XP_PER_KILL = { imp: 10, cultist: 15, hound: 12, boss: 120 };

export class Progression {
  constructor() { this.reset(); }

  reset() {
    this.xp = 0;
    this.level = 1;
    this.skillPoints = 0;
    this.upgrades = {};
    for (const u of UPGRADES) this.upgrades[u.id] = 0;
    this.totalKills = 0;
    this.secrets = 0;
    this.timeMs = 0;
  }

  // XP needed to advance from `level` to the next.
  xpForLevel(level = this.level) { return 40 + (level - 1) * 30; }

  addKill(kind) {
    this.totalKills++;
    this.xp += XP_PER_KILL[kind] || 10;
    while (this.xp >= this.xpForLevel()) {
      this.xp -= this.xpForLevel();
      this.level++;
      this.skillPoints++;
    }
  }

  levelOf(id) { return this.upgrades[id] || 0; }
  maxedOf(id) { return this.levelOf(id) >= UPGRADES.find((u) => u.id === id).max; }
  canBuy(id) { return this.skillPoints > 0 && !this.maxedOf(id); }
  buy(id) {
    if (!this.canBuy(id)) return false;
    this.upgrades[id]++;
    this.skillPoints--;
    return true;
  }

  // Stat modifiers applied to the player/weapons at the start of each level.
  mods() {
    const u = this.upgrades;
    return {
      maxHealth: 100 + u.vitality * 20,
      damage: 1 + u.power * 0.12,
      speed: 1 + u.swiftness * 0.08,
      armor: u.warding * 15,
      fireRate: 1 + u.rapidity * 0.10,
      orbRadius: 1 + u.cataclysm * 0.20,
    };
  }

  serialize() {
    return {
      xp: this.xp, level: this.level, skillPoints: this.skillPoints,
      upgrades: { ...this.upgrades }, totalKills: this.totalKills,
      secrets: this.secrets, timeMs: this.timeMs,
    };
  }

  load(d) {
    if (!d) return;
    this.reset();
    this.xp = d.xp || 0;
    this.level = d.level || 1;
    this.skillPoints = d.skillPoints || 0;
    for (const u of UPGRADES) this.upgrades[u.id] = d.upgrades?.[u.id] || 0;
    this.totalKills = d.totalKills || 0;
    this.secrets = d.secrets || 0;
    this.timeMs = d.timeMs || 0;
  }
}
