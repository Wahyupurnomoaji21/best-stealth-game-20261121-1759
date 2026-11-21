// shots.js — the deterministic screenshot mode. ?shot=start|play|alert|end&seed=1
// poses the game in one fixed, readable state per shot, then runs the world on
// a fixed timestep so the guards stand mid-patrol and the scene never depends
// on when the picture was taken. No input is read in shot mode.
import { TILE } from './config.js';

// Where the player stands and what the meter reads in each posed shot.
const POSES = {
  start: { level: 0, mode: 'title', suspicion: 0, alarm: false },
  play: {
    level: 0, mode: 'playing', suspicion: 34, alarm: false,
    // The player crouches at the very edge of the guard's cone — a near miss.
    player: { x: 16 * TILE + 16, y: 12 * TILE + 16 },
    guards: [{ x: 18 * TILE + 16, y: 8 * TILE + 16, angle: Math.PI * 0.5 }],
  },
  alert: {
    level: 0, mode: 'playing', suspicion: 100, alarm: true,
    player: { x: 20 * TILE + 16, y: 12 * TILE + 16 },
    guards: [{ x: 17 * TILE + 16, y: 12 * TILE + 16, angle: 0 }],
  },
  end: { level: 2, mode: 'win', suspicion: 0, alarm: false, score: 4250, time: 187 },
};

export function shotFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot || !POSES[shot]) return null;
  const seed = Number(params.get('seed') || 1) || 1;
  return { name: shot, seed };
}

// Pose the game for a screenshot, then advance the world a fixed number of
// fixed steps so patrols and dust sit in natural mid-motion positions. The
// pose itself is applied AFTER the settle steps, so the picture always shows
// exactly the suspicion, alarm and positions the shot promises — a chasing
// guard must not walk onto the player and end the game before the picture.
export function applyShot(game, shot) {
  const pose = POSES[shot.name];
  game.startLevel(pose.level, { silent: true });
  game.state.mode = 'playing';
  game.state.suspicion = 0;
  game.state.alarm = false;
  // Settle the world: 45 fixed steps of 1/60s with no input.
  for (let i = 0; i < 45; i++) game.tick(1 / 60, true);
  // Now pose it.
  game.state.mode = pose.mode;
  game.state.suspicion = pose.suspicion;
  game.state.alarm = pose.alarm;
  if (pose.score !== undefined) game.state.score = pose.score;
  if (pose.time !== undefined) game.state.playTime = pose.time;
  if (pose.player) {
    game.state.player.x = pose.player.x;
    game.state.player.y = pose.player.y;
    game.state.player.angle = -Math.PI / 2;
  }
  if (pose.guards) {
    pose.guards.forEach((gp, i) => {
      const g = game.state.guards[i];
      if (!g) return;
      g.x = gp.x; g.y = gp.y; g.angle = gp.angle;
      g.mode = pose.alarm ? 'chase' : 'patrol';
      g.lastSeen = pose.alarm ? { x: game.state.player.x, y: game.state.player.y } : null;
    });
  }
  if (pose.mode === 'win') game.state.levelIndex = 2;
}
