// vision.js — what a guard can see: a vision cone clipped by shelves and walls,
// and a line-of-sight test between any two points. Both walk the world grid in
// small steps, so the cone and the detection test always agree with the renderer.
import { VISION_RANGE, VISION_HALF_ANGLE, VISION_RAYS } from './config.js';
import { isSolidPx } from './world.js';

// Cast one ray from (x, y) along angle; stop at the first solid tile or at range.
// Returns the distance travelled.
export function castRay(level, x, y, angle, range) {
  const step = 5;
  const dx = Math.cos(angle) * step;
  const dy = Math.sin(angle) * step;
  let px = x;
  let py = y;
  let travelled = 0;
  while (travelled < range) {
    px += dx;
    py += dy;
    travelled += step;
    if (isSolidPx(level, px, py)) return travelled;
  }
  return range;
}

// The guard's vision cone as a polygon: the guard's position plus one point per
// ray across the cone. The renderer fills this polygon with warm light and the
// detection test uses the same shape.
export function conePolygon(level, guard) {
  const pts = [{ x: guard.x, y: guard.y }];
  for (let i = 0; i <= VISION_RAYS; i++) {
    const a = guard.angle - VISION_HALF_ANGLE + (2 * VISION_HALF_ANGLE * i) / VISION_RAYS;
    const d = castRay(level, guard.x, guard.y, a, VISION_RANGE);
    pts.push({ x: guard.x + Math.cos(a) * d, y: guard.y + Math.sin(a) * d });
  }
  return pts;
}

// Is there a clear line of sight between two points? Sample every 5px; any
// solid tile in between blocks the view.
export function hasLineOfSight(level, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const d = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(d / 5));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isSolidPx(level, x1 + dx * t, y1 + dy * t)) return false;
  }
  return true;
}

// Can this guard see the player right now? Inside range, inside the cone angle,
// and with a clear line of sight. Returns 0..1: how exposed the player is
// (1 = point blank in the middle of the cone, 0 = unseen).
export function guardSeesPlayer(level, guard, player) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const d = Math.hypot(dx, dy);
  if (d > VISION_RANGE) return 0;
  let da = Math.atan2(dy, dx) - guard.angle;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  if (Math.abs(da) > VISION_HALF_ANGLE) return 0;
  if (!hasLineOfSight(level, guard.x, guard.y, player.x, player.y)) return 0;
  const closeness = 1 - d / VISION_RANGE; // 1 up close, 0 at the edge
  const centrality = 1 - Math.abs(da) / VISION_HALF_ANGLE; // 1 dead centre
  return 0.35 + 0.65 * (closeness * 0.6 + centrality * 0.4);
}
