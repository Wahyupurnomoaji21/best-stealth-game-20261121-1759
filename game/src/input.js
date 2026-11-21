// input.js — keyboard (WASD / arrows, Shift to sneak, R to restart, Enter to
// start) and mouse (click to walk to a point, click to advance menus). The canvas
// is scaled by CSS, so mouse coordinates are mapped back into game space.
import { VIEW_W, VIEW_H } from './config.js';

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sneak', ShiftRight: 'sneak',
  KeyR: 'restart',
  Enter: 'confirm',
  Space: 'confirm',
};

export function createInput(canvas) {
  const input = {
    held: new Set(), // 'up' | 'down' | 'left' | 'right' | 'sneak'
    pressed: new Set(), // one-shot actions, consumed by the game loop
    moveTarget: null, // {x, y} in game coordinates, or null
    clicked: false, // a mouse click happened since the last frame
  };

  window.addEventListener('keydown', (e) => {
    const action = KEYMAP[e.code];
    if (!action) return;
    if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
      e.preventDefault();
    }
    if (action === 'restart' || action === 'confirm') {
      if (!e.repeat) input.pressed.add(action);
    } else {
      input.held.add(action);
    }
  });
  window.addEventListener('keyup', (e) => {
    const action = KEYMAP[e.code];
    if (action) input.held.delete(action);
  });
  window.addEventListener('blur', () => input.held.clear());

  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const y = ((e.clientY - rect.top) / rect.height) * VIEW_H;
    input.moveTarget = { x, y };
    input.clicked = true;
  });

  return input;
}

// The movement direction from held keys, normalised, or null when idle.
export function keyDirection(input) {
  let x = 0;
  let y = 0;
  if (input.held.has('left')) x -= 1;
  if (input.held.has('right')) x += 1;
  if (input.held.has('up')) y -= 1;
  if (input.held.has('down')) y += 1;
  if (x === 0 && y === 0) return null;
  const len = Math.hypot(x, y);
  return { x: x / len, y: y / len };
}

export function consumePressed(input, action) {
  if (input.pressed.has(action)) {
    input.pressed.delete(action);
    return true;
  }
  return false;
}

export function consumeClick(input) {
  if (input.clicked) {
    input.clicked = false;
    return true;
  }
  return false;
}
