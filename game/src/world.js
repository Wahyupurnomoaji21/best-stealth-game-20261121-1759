// world.js — the archive itself: three hand-built levels, their walls, shelves,
// crates, desks, lanterns, patrol routes, ledger and exit. Coordinates are in tiles
// (one tile = 32px, the world is 40x25 tiles = 1280x800). Every obstacle is a
// rectangle; the solid grid is derived from them, so collision and line of sight
// always agree about what blocks the player and the guards.
import { TILE, COLS, ROWS } from './config.js';

function tileCenter(tx, ty) {
  return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
}

// kind: 'wall' | 'shelf' | 'crate' | 'desk'. All block movement and sight.
function rect(x, y, w, h, kind) { return { x, y, w, h, kind }; }

export const LEVELS = [
  {
    name: 'ARSIP BARAT',
    subtitle: 'Malam pertama — dua penjaga, lorong yang lapang.',
    par: 75,
    playerStart: tileCenter(2, 22),
    ledger: tileCenter(36, 3),
    exit: { x: 36, y: 21, w: 2, h: 2 }, // tile rect: the green door, bottom right
    lanterns: [
      tileCenter(3, 3), tileCenter(20, 12), tileCenter(36, 3),
      tileCenter(36, 21), tileCenter(12, 21), tileCenter(20, 2),
    ],
    obstacles: [
      rect(6, 4, 10, 2, 'shelf'), rect(6, 9, 10, 2, 'shelf'),
      rect(6, 14, 10, 2, 'shelf'), rect(24, 4, 10, 2, 'shelf'),
      rect(24, 14, 6, 2, 'shelf'),
      rect(20, 9, 5, 2, 'desk'),
      rect(30, 19, 4, 2, 'crate'), rect(10, 19, 3, 2, 'crate'),
      rect(22, 19, 2, 2, 'crate'),
    ],
    patrols: [
      { waypoints: [tileCenter(18, 7), tileCenter(18, 12), tileCenter(17, 12), tileCenter(17, 7)] },
      { waypoints: [tileCenter(36, 7), tileCenter(36, 17), tileCenter(31, 17), tileCenter(31, 7)] },
    ],
  },
  {
    name: 'GALERI TENGAH',
    subtitle: 'Tiga penjaga — rak-rak rapat, lorong sempit.',
    par: 95,
    playerStart: tileCenter(2, 22),
    ledger: tileCenter(36, 3),
    exit: { x: 36, y: 21, w: 2, h: 2 },
    lanterns: [
      tileCenter(3, 3), tileCenter(13, 7), tileCenter(26, 7),
      tileCenter(36, 3), tileCenter(13, 19), tileCenter(26, 19), tileCenter(36, 21),
    ],
    obstacles: [
      rect(4, 4, 8, 2, 'shelf'), rect(16, 4, 8, 2, 'shelf'), rect(28, 4, 8, 2, 'shelf'),
      rect(4, 10, 8, 2, 'shelf'), rect(16, 10, 8, 2, 'shelf'), rect(28, 10, 8, 2, 'shelf'),
      rect(10, 16, 8, 2, 'shelf'), rect(22, 16, 8, 2, 'shelf'),
      rect(16, 19, 4, 2, 'desk'),
      rect(33, 18, 3, 2, 'crate'), rect(4, 19, 3, 2, 'crate'),
    ],
    patrols: [
      { waypoints: [tileCenter(14, 7), tileCenter(14, 13), tileCenter(13, 13), tileCenter(13, 7)] },
      { waypoints: [tileCenter(26, 7), tileCenter(26, 13), tileCenter(25, 13), tileCenter(25, 7)] },
      { waypoints: [tileCenter(20, 22), tileCenter(31, 22), tileCenter(31, 19), tileCenter(20, 19)] },
    ],
  },
  {
    name: 'RUANG SEGEL',
    subtitle: 'Empat penjaga — rute bersilangan, tanpa tempat aman.',
    par: 120,
    playerStart: tileCenter(2, 22),
    ledger: tileCenter(36, 2),
    exit: { x: 36, y: 21, w: 2, h: 2 },
    lanterns: [
      tileCenter(3, 3), tileCenter(12, 7), tileCenter(20, 12), tileCenter(28, 7),
      tileCenter(36, 3), tileCenter(12, 21), tileCenter(28, 21), tileCenter(36, 21),
    ],
    obstacles: [
      rect(4, 3, 7, 2, 'shelf'), rect(15, 3, 7, 2, 'shelf'), rect(26, 3, 7, 2, 'shelf'),
      rect(9, 8, 7, 2, 'shelf'), rect(21, 8, 7, 2, 'shelf'),
      rect(4, 13, 7, 2, 'shelf'), rect(15, 13, 7, 2, 'shelf'), rect(26, 13, 7, 2, 'shelf'),
      rect(9, 18, 7, 2, 'shelf'), rect(21, 18, 7, 2, 'shelf'),
      rect(33, 8, 3, 2, 'crate'), rect(33, 18, 3, 2, 'crate'), rect(3, 18, 3, 2, 'crate'),
      rect(18, 21, 4, 2, 'desk'),
    ],
    patrols: [
      { waypoints: [tileCenter(8, 6), tileCenter(8, 11), tileCenter(17, 11), tileCenter(17, 6)] },
      { waypoints: [tileCenter(30, 6), tileCenter(30, 11), tileCenter(36, 11), tileCenter(36, 6)] },
      { waypoints: [tileCenter(8, 16), tileCenter(8, 21), tileCenter(17, 21), tileCenter(17, 16)] },
      { waypoints: [tileCenter(30, 16), tileCenter(30, 21), tileCenter(36, 21), tileCenter(36, 16)] },
    ],
  },
];

// Build the runtime form of a level: a solid-tile grid plus pixel-space data.
export function buildLevel(index) {
  const def = LEVELS[index];
  const solid = new Uint8Array(COLS * ROWS);
  const setSolid = (tx, ty) => {
    if (tx >= 0 && tx < COLS && ty >= 0 && ty < ROWS) solid[ty * COLS + tx] = 1;
  };
  // Outer walls.
  for (let x = 0; x < COLS; x++) { setSolid(x, 0); setSolid(x, ROWS - 1); }
  for (let y = 0; y < ROWS; y++) { setSolid(0, y); setSolid(COLS - 1, y); }
  for (const o of def.obstacles) {
    for (let y = o.y; y < o.y + o.h; y++) {
      for (let x = o.x; x < o.x + o.w; x++) setSolid(x, y);
    }
  }
  return {
    index,
    name: def.name,
    subtitle: def.subtitle,
    par: def.par,
    solid,
    obstacles: def.obstacles,
    lanterns: def.lanterns,
    ledger: { ...def.ledger },
    exit: { x: def.exit.x * TILE, y: def.exit.y * TILE, w: def.exit.w * TILE, h: def.exit.h * TILE },
    playerStart: { ...def.playerStart },
    patrols: def.patrols.map((p) => ({ waypoints: p.waypoints.map((w) => ({ ...w })) })),
  };
}

export function isSolidTile(level, tx, ty) {
  if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return true;
  return level.solid[ty * COLS + tx] === 1;
}

export function isSolidPx(level, x, y) {
  return isSolidTile(level, Math.floor(x / TILE), Math.floor(y / TILE));
}

// Move a circle (x, y, radius) by (dx, dy), sliding along walls axis by axis.
// Returns the new position; never lets the circle overlap a solid tile.
export function moveCircle(level, x, y, radius, dx, dy) {
  let nx = x + dx;
  if (dx !== 0) {
    const top = Math.floor((y - radius + 1) / TILE);
    const bottom = Math.floor((y + radius - 1) / TILE);
    if (dx > 0) {
      const edge = Math.floor((nx + radius) / TILE);
      for (let ty = top; ty <= bottom; ty++) {
        if (isSolidTile(level, edge, ty)) { nx = edge * TILE - radius - 0.01; break; }
      }
    } else {
      const edge = Math.floor((nx - radius) / TILE);
      for (let ty = top; ty <= bottom; ty++) {
        if (isSolidTile(level, edge, ty)) { nx = (edge + 1) * TILE + radius + 0.01; break; }
      }
    }
  }
  let ny = y + dy;
  if (dy !== 0) {
    const left = Math.floor((nx - radius + 1) / TILE);
    const right = Math.floor((nx + radius - 1) / TILE);
    if (dy > 0) {
      const edge = Math.floor((ny + radius) / TILE);
      for (let tx = left; tx <= right; tx++) {
        if (isSolidTile(level, tx, edge)) { ny = edge * TILE - radius - 0.01; break; }
      }
    } else {
      const edge = Math.floor((ny - radius) / TILE);
      for (let tx = left; tx <= right; tx++) {
        if (isSolidTile(level, tx, edge)) { ny = (edge + 1) * TILE + radius + 0.01; break; }
      }
    }
  }
  return { x: nx, y: ny };
}
