// main.js — The Midnight Stacks: the game loop, the state machine (title,
// playing, level clear, game over, win), player movement, pickups, scoring,
// and the wiring between input, guards, vision, audio and the renderer.
import {
  VIEW_W, VIEW_H, TILE, PLAYER_RADIUS, PLAYER_WALK_SPEED, PLAYER_SNEAK_SPEED,
  PLAYER_MOUSE_SPEED, SCORE_LEDGER, SCORE_LEVEL_CLEAR, SCORE_GHOST_BONUS,
  SCORE_TIME_BONUS_RATE, makeRng, clamp, dist,
} from './config.js';
import { LEVELS, buildLevel, moveCircle } from './world.js';
import { makeGuard, updateGuard, updateSuspicion, guardCaughtPlayer } from './guards.js';
import { createRenderer, render } from './render.js';
import { createInput, keyDirection, consumePressed, consumeClick } from './input.js';
import { createAudio } from './audio.js';
import { shotFromUrl, applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

class Game {
  constructor() {
    this.input = createInput(canvas);
    this.audio = createAudio();
    this.shot = shotFromUrl();
    this.state = {
      mode: 'title', // title | playing | clear | gameover | win
      levelIndex: 0,
      level: null,
      player: null,
      guards: [],
      suspicion: 0,
      alarm: false,
      alarmRaised: false,
      unseenTimer: 0,
      ledgerTaken: false,
      score: 0,
      time: 0, // animation clock: always advances, drives flicker and dust
      playTime: 0, // gameplay clock: the HUD timer and the win screen total
      levelTime: 0,
      best: 0,
      dust: [],
      renderer: null,
      levelClearText: '',
      levelTimeBonus: 0,
      levelGhost: false,
      clearTimer: 0,
      stepTimer: 0,
    };
    this.startLevel(0, { silent: true });
    this.state.mode = 'title';
    if (this.shot) applyShot(this, this.shot);
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  startLevel(index, { silent = false } = {}) {
    const s = this.state;
    s.levelIndex = index;
    s.level = buildLevel(index);
    s.renderer = createRenderer(s.level, index + 1);
    s.guards = s.level.patrols.map((p, i) => makeGuard(p, i));
    s.player = {
      x: s.level.playerStart.x, y: s.level.playerStart.y,
      angle: -Math.PI / 2, moving: false,
    };
    s.suspicion = 0;
    s.alarm = false;
    s.alarmRaised = false;
    s.unseenTimer = 0;
    s.ledgerTaken = false;
    s.levelTime = 0;
    s.clearTimer = 0;
    s.stepTimer = 0;
    s.dust = makeDust(index + 1);
    if (!silent) s.mode = 'playing';
  }

  startGame() {
    const s = this.state;
    s.score = 0;
    s.playTime = 0;
    this.startLevel(0);
  }

  // One fixed step of the world. frozen = screenshot settle: no input, no
  // audio, no mode changes — guards patrol and dust drifts, nothing else.
  tick(dt, frozen = false) {
    const s = this.state;
    s.time += dt;
    if (s.mode === 'playing') {
      s.playTime += dt;
      s.levelTime += dt;
      this.updatePlayer(dt, frozen);
      this.updateGuards(dt, frozen);
      this.updatePickups(frozen);
      if (!frozen && guardCaughtPlayer(s, s.guards, s.player)) {
        s.mode = 'gameover';
        s.best = Math.max(s.best, s.score);
        this.audio.caught();
      }
    } else if (s.mode === 'clear') {
      s.clearTimer -= dt;
      if (s.clearTimer <= 0 && !frozen) this.nextLevel();
    }
    if (!frozen) this.audio.updateAmbient(dt);
  }

  updatePlayer(dt, frozen) {
    const s = this.state;
    const p = s.player;
    if (frozen) { p.moving = false; return; }
    const sneaking = this.input.held.has('sneak');
    let dir = keyDirection(this.input);
    if (dir) {
      this.input.moveTarget = null;
    } else if (this.input.moveTarget) {
      const d = dist(p.x, p.y, this.input.moveTarget.x, this.input.moveTarget.y);
      if (d < 7) {
        this.input.moveTarget = null;
      } else {
        dir = {
          x: (this.input.moveTarget.x - p.x) / d,
          y: (this.input.moveTarget.y - p.y) / d,
        };
      }
    }
    p.moving = dir !== null;
    if (!dir) return;
    const speed = dir && this.input.moveTarget ? PLAYER_MOUSE_SPEED
      : sneaking ? PLAYER_SNEAK_SPEED : PLAYER_WALK_SPEED;
    const moved = moveCircle(s.level, p.x, p.y, PLAYER_RADIUS,
      dir.x * speed * dt, dir.y * speed * dt);
    p.x = moved.x;
    p.y = moved.y;
    p.angle = Math.atan2(dir.y, dir.x);
    // Footsteps: soft and slow while sneaking, audible while walking.
    s.stepTimer -= dt;
    if (s.stepTimer <= 0) {
      s.stepTimer = sneaking ? 0.55 : 0.38;
      this.audio.footstep(sneaking ? 0.25 : 0.6, sneaking);
    }
  }

  updateGuards(dt, frozen) {
    const s = this.state;
    const sneaking = this.input.held.has('sneak');
    for (const g of s.guards) {
      const events = updateGuard(s.level, g, s.player, dt, s.suspicion, sneaking);
      if (!frozen && events.stepped) {
        this.audio.guardStep(dist(g.x, g.y, s.player.x, s.player.y));
      }
    }
    const hadAlarm = s.alarm;
    updateSuspicion(s, s.guards, s.player, s.level, dt, sneaking);
    if (!frozen && s.alarm && !hadAlarm) this.audio.alarm();
  }

  updatePickups(frozen) {
    const s = this.state;
    const p = s.player;
    if (!s.ledgerTaken && dist(p.x, p.y, s.level.ledger.x, s.level.ledger.y) < 28) {
      s.ledgerTaken = true;
      s.score += SCORE_LEDGER;
      if (!frozen) this.audio.pickup();
    }
    if (s.ledgerTaken) {
      const e = s.level.exit;
      if (p.x > e.x && p.x < e.x + e.w && p.y > e.y && p.y < e.y + e.h) {
        const timeBonus = Math.max(0, Math.round((s.level.par - s.levelTime) * SCORE_TIME_BONUS_RATE));
        const ghost = !s.alarmRaised;
        s.score += SCORE_LEVEL_CLEAR + timeBonus + (ghost ? SCORE_GHOST_BONUS : 0);
        s.levelTimeBonus = timeBonus;
        s.levelGhost = ghost;
        s.levelClearText = ghost
          ? `${s.level.name} — tak satu pun penjaga sempat curiga.`
          : `${s.level.name} — ledger diamankan, tapi alarm sempat berbunyi.`;
        s.mode = 'clear';
        s.clearTimer = 2.8;
        if (!frozen) this.audio.levelClear();
      }
    }
  }

  nextLevel() {
    const s = this.state;
    if (s.levelIndex + 1 >= LEVELS.length) {
      s.mode = 'win';
      s.best = Math.max(s.best, s.score);
      this.audio.win();
    } else {
      this.startLevel(s.levelIndex + 1);
    }
  }

  handleMenus() {
    const s = this.state;
    const restart = consumePressed(this.input, 'restart');
    const confirm = consumePressed(this.input, 'confirm');
    const clicked = consumeClick(this.input);
    if (restart) {
      if (s.mode === 'title') this.startGame();
      else if (s.mode === 'gameover' || s.mode === 'win') this.startGame();
      else this.startLevel(s.levelIndex);
      return;
    }
    if (s.mode === 'title' && (confirm || clicked)) {
      this.audio.unlock();
      this.startGame();
    } else if ((s.mode === 'gameover' || s.mode === 'win') && (confirm || clicked)) {
      this.startGame();
    }
  }

  frame(now) {
    const dt = clamp((now - this.last) / 1000, 0, 0.05);
    this.last = now;
    if (this.shot) {
      // Screenshot mode: the pose is frozen; only the animation clock moves,
      // so lanterns flicker and dust drifts while nothing else changes.
      this.state.time += dt;
    } else {
      this.handleMenus();
      if (this.state.mode !== 'title') this.tick(dt);
      else this.state.time += dt;
    }
    render(ctx, this.state.renderer, this.state);
    requestAnimationFrame((t) => this.frame(t));
  }
}

function makeDust(seed) {
  const rng = makeRng(seed * 331 + 17);
  const dust = [];
  for (let i = 0; i < 90; i++) {
    dust.push({
      x: rng() * VIEW_W,
      y: rng() * VIEW_H,
      size: 0.8 + rng() * 1.6,
      alpha: 0.10 + rng() * 0.25,
      drift: 0.1 + rng() * 0.35,
      phase: rng() * Math.PI * 2,
    });
  }
  return dust;
}

new Game();
