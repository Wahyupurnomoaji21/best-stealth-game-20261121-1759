// config.js — every tunable number of The Midnight Stacks in one place.
// Canvas is fixed at 1280x800; the world is a 40x25 grid of 32px tiles.
export const VIEW_W = 1280;
export const VIEW_H = 800;
export const TILE = 32;
export const COLS = 40;
export const ROWS = 25;

export const PLAYER_RADIUS = 12;
export const PLAYER_WALK_SPEED = 175; // px per second
export const PLAYER_SNEAK_SPEED = 92; // px per second (Shift)
export const PLAYER_MOUSE_SPEED = 165;

export const GUARD_RADIUS = 13;
export const GUARD_PATROL_SPEED = 62;
export const GUARD_CHASE_SPEED = 132;
export const GUARD_TURN_SPEED = 3.4; // radians per second

// Vision cone: how far and how wide a guard sees.
export const VISION_RANGE = 235;
export const VISION_HALF_ANGLE = 0.61; // ~35 degrees each side
export const VISION_RAYS = 26;

// Detection meter 0..100. Rises while the player is seen, falls while hidden.
export const SUSPICION_GAIN_NEAR = 118; // per second, point blank
export const SUSPICION_GAIN_FAR = 42; // per second, at the edge of the cone
export const SUSPICION_SNEAK_FACTOR = 0.45; // sneaking is much harder to spot
export const SUSPICION_DECAY = 26; // per second while unseen
export const ALARM_LOSE_DELAY = 3.5; // seconds unseen before the alarm drops
export const ALARM_RESET_SUSPICION = 55;
export const CATCH_DISTANCE = 30; // a guard this close during alarm catches you

// Scoring.
export const SCORE_LEDGER = 500;
export const SCORE_LEVEL_CLEAR = 1000;
export const SCORE_GHOST_BONUS = 400; // finish a level without ever raising the alarm
export const SCORE_TIME_BONUS_RATE = 12; // per second under the level par time

// Lighting.
export const DARKNESS_ALPHA = 0.80; // how black the unlit archive is
export const PLAYER_LIGHT_RADIUS = 175;
export const LANTERN_LIGHT_RADIUS = 185;
export const GUARD_LIGHT_RADIUS = 105;
export const EXIT_LIGHT_RADIUS = 120;

// Palette — warm lamplight over old wood and paper.
export const PALETTE = {
  floorA: '#5d4126',
  floorB: '#543a20',
  floorLine: '#3d2a16',
  wallTop: '#7a5a34',
  wallFace: '#3a2716',
  shelfTop: '#6e4a26',
  shelfFace: '#452c15',
  bookRed: '#8a3b2e',
  bookGreen: '#4d5e3a',
  bookBlue: '#33506b',
  bookOchre: '#a07a35',
  bookCream: '#c9b183',
  crateTop: '#8a6a3c',
  crateFace: '#5d4423',
  deskTop: '#7d5a30',
  deskFace: '#4c3517',
  paper: '#e8dcc0',
  rug: '#5e1f1a',
  rugTrim: '#a07a35',
  lanternGlow: '#ffb347',
  coneWarm: 'rgba(255, 190, 90, 0.30)',
  coneHot: 'rgba(255, 120, 40, 0.42)',
  playerCloak: '#2e4a4a',
  playerCloakDark: '#16282a',
  guardCoat: '#6e2a24',
  guardCoatDark: '#3d1512',
  exitGreen: '#7de38b',
  gold: '#f2c14e',
};

// Deterministic random: mulberry32, so screenshot mode is reproducible.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * clamp(t, 0, 1);
}
