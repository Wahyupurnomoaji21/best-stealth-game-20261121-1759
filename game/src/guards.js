// guards.js — the night watch: patrol waypoints you can learn, a detection meter
// that gives you a chance to recover, and an alarm that sends every guard after
// your last seen position. Guards never cheat: they only know what they saw.
import {
  GUARD_PATROL_SPEED, GUARD_CHASE_SPEED, GUARD_TURN_SPEED, GUARD_RADIUS,
  SUSPICION_GAIN_NEAR, SUSPICION_GAIN_FAR, SUSPICION_SNEAK_FACTOR,
  SUSPICION_DECAY, ALARM_LOSE_DELAY, ALARM_RESET_SUSPICION, CATCH_DISTANCE,
} from './config.js';
import { clamp, angleLerp, dist } from './config.js';
import { moveCircle } from './world.js';
import { guardSeesPlayer } from './vision.js';

export function makeGuard(patrol, index) {
  const start = patrol.waypoints[0];
  return {
    id: index,
    x: start.x,
    y: start.y,
    angle: Math.PI / 2, // facing down the archive at first
    waypointIndex: 1,
    waypoints: patrol.waypoints,
    mode: 'patrol', // patrol | chase | return
    lastSeen: null, // {x, y} of the player, when last spotted
    stepTimer: 0, // footstep pacing
    paused: 0, // brief pause at each waypoint, like a guard looking around
    stuckTimer: 0,
  };
}

// One guard, one tick. Returns events for the sound engine:
// { stepped: boolean, spotted: boolean }.
export function updateGuard(level, guard, player, dt, suspicion, sneaking) {
  const events = { stepped: false, spotted: false };
  const seen = guardSeesPlayer(level, guard, player);
  if (seen > 0) {
    guard.lastSeen = { x: player.x, y: player.y };
    events.spotted = true;
  }

  let speed = 0;
  let targetAngle = guard.angle;
  if (guard.mode === 'chase' && guard.lastSeen) {
    // Chase the last seen spot; keep going while the alarm holds.
    const d = dist(guard.x, guard.y, guard.lastSeen.x, guard.lastSeen.y);
    if (d > 10) {
      targetAngle = Math.atan2(guard.lastSeen.y - guard.y, guard.lastSeen.x - guard.x);
      speed = GUARD_CHASE_SPEED;
    }
  } else if (guard.mode === 'return') {
    // Walk back to the nearest waypoint, then resume the patrol.
    let best = 0;
    let bestD = Infinity;
    guard.waypoints.forEach((w, i) => {
      const d = dist(guard.x, guard.y, w.x, w.y);
      if (d < bestD) { bestD = d; best = i; }
    });
    guard.waypointIndex = best;
    guard.mode = 'patrol';
  } else {
    // Patrol: walk the waypoints, pausing briefly at each one to look around.
    if (guard.paused > 0) {
      guard.paused -= dt;
      targetAngle = guard.angle + Math.sin(performance.now() / 900 + guard.id) * 0.001;
    } else {
      const wp = guard.waypoints[guard.waypointIndex];
      const d = dist(guard.x, guard.y, wp.x, wp.y);
      if (d < 8) {
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
        guard.paused = 0.9;
      } else {
        targetAngle = Math.atan2(wp.y - guard.y, wp.x - guard.x);
        speed = GUARD_PATROL_SPEED;
      }
    }
  }

  guard.angle = angleLerp(guard.angle, targetAngle, GUARD_TURN_SPEED * dt);
  if (speed > 0) {
    const before = { x: guard.x, y: guard.y };
    const moved = moveCircle(level, guard.x, guard.y, GUARD_RADIUS,
      Math.cos(guard.angle) * speed * dt, Math.sin(guard.angle) * speed * dt);
    guard.x = moved.x;
    guard.y = moved.y;
    if (dist(before.x, before.y, guard.x, guard.y) < speed * dt * 0.25) {
      // Pushed against something: skip to the next waypoint instead of grinding.
      guard.stuckTimer += dt;
      if (guard.stuckTimer > 1.2) {
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
        guard.stuckTimer = 0;
      }
    } else {
      guard.stuckTimer = 0;
    }
    guard.stepTimer -= dt;
    if (guard.stepTimer <= 0) {
      guard.stepTimer = speed > 100 ? 0.42 : 0.62;
      events.stepped = true;
    }
  }
  return events;
}

// The shared detection meter, 0..100. Every guard that sees the player pushes it
// up (faster up close, slower while the player sneaks); hiding lets it fall.
// Crossing 100 raises the alarm; the alarm drops once the player stays unseen.
export function updateSuspicion(state, guards, player, level, dt, sneaking) {
  let exposure = 0;
  for (const g of guards) exposure = Math.max(exposure, guardSeesPlayer(level, g, player));
  if (exposure > 0) {
    const gain = (SUSPICION_GAIN_FAR + (SUSPICION_GAIN_NEAR - SUSPICION_GAIN_FAR) * exposure)
      * (sneaking ? SUSPICION_SNEAK_FACTOR : 1);
    state.suspicion = clamp(state.suspicion + gain * dt, 0, 100);
    state.unseenTimer = 0;
  } else {
    state.suspicion = clamp(state.suspicion - SUSPICION_DECAY * dt, 0, 100);
    state.unseenTimer += dt;
  }
  if (state.suspicion >= 100 && !state.alarm) {
    state.alarm = true;
    state.alarmRaised = true; // the ghost bonus is lost for this level
    state.unseenTimer = 0;
    for (const g of guards) g.mode = 'chase';
  }
  if (state.alarm && state.unseenTimer > ALARM_LOSE_DELAY) {
    state.alarm = false;
    state.suspicion = ALARM_RESET_SUSPICION;
    for (const g of guards) g.mode = 'return';
  }
  return exposure;
}

// A guard standing on top of the player while the alarm is up catches them.
export function guardCaughtPlayer(state, guards, player) {
  if (!state.alarm) return false;
  return guards.some((g) => dist(g.x, g.y, player.x, player.y) < CATCH_DISTANCE);
}
