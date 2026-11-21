// render.js — everything the eye sees: a procedurally textured wooden floor,
// bookshelves drawn with a lit top and a dark face so they read as solid 3D
// furniture, guards and the archivist as shaded figures, and the light itself —
// wall lanterns, the player's lamp, and each guard's vision cone cutting pools
// of warm light out of the dark. No images anywhere: every pixel is drawn.
import {
  VIEW_W, VIEW_H, TILE, PALETTE, DARKNESS_ALPHA,
  PLAYER_LIGHT_RADIUS, LANTERN_LIGHT_RADIUS, GUARD_LIGHT_RADIUS,
  EXIT_LIGHT_RADIUS, makeRng, clamp, lerp,
} from './config.js';
import { conePolygon } from './vision.js';

// ---- procedural floor texture, baked once per level -------------------------
function bakeFloorTexture(level, seed) {
  const rng = makeRng(seed);
  const c = document.createElement('canvas');
  c.width = VIEW_W; c.height = VIEW_H;
  const g = c.getContext('2d');
  // Wooden planks, laid in rows with varied tone and grain.
  const plankH = 64;
  for (let y = 0; y < VIEW_H; y += plankH) {
    const tone = rng();
    g.fillStyle = tone > 0.5 ? PALETTE.floorA : PALETTE.floorB;
    g.fillRect(0, y, VIEW_W, plankH);
    // Grain: long soft strokes along the plank.
    for (let i = 0; i < 46; i++) {
      const gy = y + rng() * plankH;
      g.strokeStyle = `rgba(20, 12, 4, ${0.05 + rng() * 0.10})`;
      g.lineWidth = 1 + rng() * 1.5;
      g.beginPath();
      g.moveTo(0, gy);
      g.bezierCurveTo(VIEW_W * 0.3, gy + (rng() - 0.5) * 7,
        VIEW_W * 0.7, gy + (rng() - 0.5) * 7, VIEW_W, gy + (rng() - 0.5) * 4);
      g.stroke();
    }
    // Plank seams and butt joints.
    g.fillStyle = PALETTE.floorLine;
    g.fillRect(0, y, VIEW_W, 2);
    let bx = Math.floor(rng() * 300);
    while (bx < VIEW_W) { g.fillRect(bx, y, 2, plankH); bx += 260 + Math.floor(rng() * 220); }
    // A knot here and there.
    if (rng() > 0.45) {
      const kx = rng() * VIEW_W;
      const ky = y + plankH * (0.25 + rng() * 0.5);
      const kr = 4 + rng() * 7;
      const grad = g.createRadialGradient(kx, ky, 1, kx, ky, kr);
      grad.addColorStop(0, 'rgba(28, 16, 6, 0.55)');
      grad.addColorStop(1, 'rgba(28, 16, 6, 0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(kx, ky, kr, 0, Math.PI * 2); g.fill();
    }
  }
  // Scattered paper scraps and dust on the floor.
  for (let i = 0; i < 26; i++) {
    const px = rng() * VIEW_W;
    const py = rng() * VIEW_H;
    const s = 10 + rng() * 16;
    g.save();
    g.translate(px, py);
    g.rotate((rng() - 0.5) * 1.2);
    g.fillStyle = `rgba(232, 220, 192, ${0.10 + rng() * 0.16})`;
    g.fillRect(-s / 2, -s / 3, s, s * 0.66);
    g.restore();
  }
  // A worn crimson rug down the middle of the archive.
  const rugX = VIEW_W * 0.42, rugY = VIEW_H * 0.30, rugW = 200, rugH = 340;
  g.fillStyle = PALETTE.rug;
  g.fillRect(rugX, rugY, rugW, rugH);
  g.strokeStyle = PALETTE.rugTrim;
  g.lineWidth = 3;
  g.strokeRect(rugX + 8, rugY + 8, rugW - 16, rugH - 16);
  g.strokeStyle = 'rgba(160, 122, 53, 0.5)';
  g.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.moveTo(rugX + 20, rugY + 30 + i * 62);
    g.lineTo(rugX + rugW - 20, rugY + 30 + i * 62);
    g.stroke();
  }
  // Fine speckle so the floor never looks flat.
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = rng() > 0.5 ? 'rgba(255, 220, 160, 0.03)' : 'rgba(0, 0, 0, 0.05)';
    g.fillRect(rng() * VIEW_W, rng() * VIEW_H, 2, 2);
  }
  return c;
}

// ---- furniture: one function per kind, each with a lit top + dark face ------
function drawShelf(g, o, rng) {
  const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE, h = o.h * TILE;
  const lift = 9; // the top face sits 9px up: the fake-3D bevel
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.beginPath(); g.ellipse(x + w / 2 + 4, y + h + 4, w / 2 + 4, 10, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = PALETTE.shelfFace;
  g.fillRect(x, y, w, h);
  g.fillStyle = PALETTE.shelfTop;
  g.fillRect(x, y - lift, w, h);
  // Book spines along the top face, muted colours, uneven heights.
  const bookCols = [PALETTE.bookRed, PALETTE.bookGreen, PALETTE.bookBlue, PALETTE.bookOchre, PALETTE.bookCream];
  let bx = x + 3;
  while (bx < x + w - 5) {
    const bw = 5 + rng() * 7;
    const bh = 10 + rng() * 9;
    g.fillStyle = bookCols[Math.floor(rng() * bookCols.length)];
    g.fillRect(bx, y - lift + (h - bh) / 2 - 2, bw, bh);
    g.fillStyle = 'rgba(255, 230, 170, 0.25)';
    g.fillRect(bx, y - lift + (h - bh) / 2 - 2, bw, 2);
    bx += bw + 1.5;
  }
  g.strokeStyle = 'rgba(255, 220, 150, 0.28)';
  g.lineWidth = 1.5;
  g.strokeRect(x + 0.5, y - lift + 0.5, w - 1, h - 1);
}

function drawCrate(g, o, rng) {
  const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE, h = o.h * TILE;
  const lift = 5;
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.beginPath(); g.ellipse(x + w / 2 + 3, y + h + 3, w / 2 + 3, 8, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = PALETTE.crateFace;
  g.fillRect(x, y, w, h);
  g.fillStyle = PALETTE.crateTop;
  g.fillRect(x, y - lift, w, h);
  // Plank seams across the lid, then the nailed cross-brace.
  g.strokeStyle = 'rgba(40, 24, 8, 0.45)';
  g.lineWidth = 1.5;
  for (let py = y - lift + h / 3; py < y - lift + h - 2; py += h / 3) {
    g.beginPath(); g.moveTo(x + 2, py); g.lineTo(x + w - 2, py); g.stroke();
  }
  g.strokeStyle = 'rgba(40, 24, 8, 0.6)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x + 3, y - lift + 3); g.lineTo(x + w - 3, y - lift + h - 3);
  g.moveTo(x + w - 3, y - lift + 3); g.lineTo(x + 3, y - lift + h - 3);
  g.stroke();
  g.strokeStyle = 'rgba(255, 225, 160, 0.22)';
  g.lineWidth = 1.5;
  g.strokeRect(x + 0.5, y - lift + 0.5, w - 1, h - 1);
}

function drawDesk(g, o) {
  const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE, h = o.h * TILE;
  const lift = 6;
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.beginPath(); g.ellipse(x + w / 2 + 3, y + h + 3, w / 2 + 3, 8, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = PALETTE.deskFace;
  g.fillRect(x, y, w, h);
  g.fillStyle = PALETTE.deskTop;
  g.fillRect(x, y - lift, w, h);
  // Loose papers and an ink pot on the desk.
  g.save();
  g.translate(x + w * 0.3, y - lift + h * 0.45);
  g.rotate(-0.12);
  g.fillStyle = PALETTE.paper;
  g.fillRect(-14, -9, 28, 18);
  g.restore();
  g.save();
  g.translate(x + w * 0.68, y - lift + h * 0.5);
  g.rotate(0.2);
  g.fillStyle = 'rgba(232, 220, 192, 0.9)';
  g.fillRect(-11, -7, 22, 14);
  g.restore();
  g.fillStyle = '#1c1410';
  g.beginPath(); g.arc(x + w * 0.85, y - lift + h * 0.3, 4, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255, 220, 150, 0.25)';
  g.lineWidth = 1.5;
  g.strokeRect(x + 0.5, y - lift + 0.5, w - 1, h - 1);
}

function drawWalls(g, level) {
  // The outer wall: a dark stone band with a warm lit edge, so the room reads
  // as a place with height instead of a flat border.
  g.fillStyle = '#241407';
  g.fillRect(0, 0, VIEW_W, TILE);
  g.fillRect(0, VIEW_H - TILE, VIEW_W, TILE);
  g.fillRect(0, 0, TILE, VIEW_H);
  g.fillRect(VIEW_W - TILE, 0, TILE, VIEW_H);
  const edge = g.createLinearGradient(0, 0, 0, TILE);
  edge.addColorStop(0, 'rgba(255, 190, 110, 0.20)');
  edge.addColorStop(1, 'rgba(255, 190, 110, 0)');
  g.fillStyle = edge;
  g.fillRect(TILE, TILE, VIEW_W - TILE * 2, 3);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(TILE, TILE + 3, VIEW_W - TILE * 2, 4);
}

// ---- people: shaded figures with a soft ground shadow -----------------------
function drawFigureShadow(g, x, y, r) {
  g.fillStyle = 'rgba(0, 0, 0, 0.5)';
  g.beginPath(); g.ellipse(x + 3, y + r * 0.8, r * 1.05, r * 0.42, 0, 0, Math.PI * 2); g.fill();
}

function drawPlayer(g, p, time) {
  drawFigureShadow(g, p.x, p.y, 13);
  const bob = Math.sin(time * 6) * (p.moving ? 1.2 : 0.3);
  const body = g.createRadialGradient(p.x - 4, p.y - 6 + bob, 2, p.x, p.y + bob, 15);
  body.addColorStop(0, '#4a6a66');
  body.addColorStop(0.55, PALETTE.playerCloak);
  body.addColorStop(1, PALETTE.playerCloakDark);
  g.fillStyle = body;
  g.beginPath(); g.arc(p.x, p.y + bob, 13, 0, Math.PI * 2); g.fill();
  // Hood and face.
  g.fillStyle = '#22403e';
  g.beginPath(); g.arc(p.x, p.y - 3 + bob, 8, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e8c890';
  g.beginPath(); g.arc(p.x + Math.cos(p.angle) * 3, p.y - 3 + bob + Math.sin(p.angle) * 3, 3.4, 0, Math.PI * 2); g.fill();
  // The little lantern in hand: the player's own pool of light.
  const lx = p.x + Math.cos(p.angle) * 15;
  const ly = p.y + Math.sin(p.angle) * 15 + bob;
  const glow = g.createRadialGradient(lx, ly, 1, lx, ly, 12);
  glow.addColorStop(0, 'rgba(255, 205, 110, 0.95)');
  glow.addColorStop(0.4, 'rgba(255, 170, 60, 0.5)');
  glow.addColorStop(1, 'rgba(255, 170, 60, 0)');
  g.fillStyle = glow;
  g.beginPath(); g.arc(lx, ly, 12, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffd98a';
  g.beginPath(); g.arc(lx, ly, 3.2, 0, Math.PI * 2); g.fill();
}

function drawGuard(g, guard, time, alarmed) {
  drawFigureShadow(g, guard.x, guard.y, 14);
  const bob = Math.sin(time * 5 + guard.id * 2) * 0.9;
  const body = g.createRadialGradient(guard.x - 4, guard.y - 6 + bob, 2, guard.x, guard.y + bob, 16);
  body.addColorStop(0, alarmed ? '#8a3226' : '#7a3a30');
  body.addColorStop(0.55, PALETTE.guardCoat);
  body.addColorStop(1, PALETTE.guardCoatDark);
  g.fillStyle = body;
  g.beginPath(); g.arc(guard.x, guard.y + bob, 14, 0, Math.PI * 2); g.fill();
  // Brass helmet with a lit rim, and the direction the guard faces.
  g.fillStyle = '#8a6a2e';
  g.beginPath(); g.arc(guard.x, guard.y - 4 + bob, 7.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c9a24a';
  g.beginPath(); g.arc(guard.x, guard.y - 5 + bob, 3, 0, Math.PI * 2); g.fill();
  // Spear held across the body.
  g.strokeStyle = '#5d4a26';
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(guard.x - Math.cos(guard.angle + 0.9) * 16, guard.y - Math.sin(guard.angle + 0.9) * 16 + bob);
  g.lineTo(guard.x + Math.cos(guard.angle + 0.9) * 16, guard.y + Math.sin(guard.angle + 0.9) * 16 + bob);
  g.stroke();
  // "!" above the head while chasing.
  if (alarmed) {
    g.fillStyle = '#ff5a3c';
    g.font = 'bold 20px Georgia, serif';
    g.textAlign = 'center';
    g.fillText('!', guard.x, guard.y - 24 + bob);
  }
}

function drawLedger(g, ledger, time, taken) {
  if (taken) return;
  const pulse = 0.5 + Math.sin(time * 3) * 0.5;
  const glow = g.createRadialGradient(ledger.x, ledger.y, 2, ledger.x, ledger.y, 46 + pulse * 14);
  glow.addColorStop(0, 'rgba(242, 193, 78, 0.65)');
  glow.addColorStop(1, 'rgba(242, 193, 78, 0)');
  g.fillStyle = glow;
  g.beginPath(); g.arc(ledger.x, ledger.y, 60, 0, Math.PI * 2); g.fill();
  // The sealed ledger: a gold-clasped book on a small stand.
  g.fillStyle = '#3a2410';
  g.fillRect(ledger.x - 13, ledger.y - 2, 26, 6);
  g.fillStyle = '#7a1f1a';
  g.fillRect(ledger.x - 11, ledger.y - 14, 22, 13);
  g.fillStyle = PALETTE.gold;
  g.fillRect(ledger.x - 11, ledger.y - 14, 22, 2);
  g.fillRect(ledger.x - 1.5, ledger.y - 14, 3, 13);
  g.fillStyle = '#f6e27a';
  g.beginPath(); g.arc(ledger.x, ledger.y - 7, 2.5, 0, Math.PI * 2); g.fill();
}

function drawExit(g, exit, time) {
  const cx = exit.x + exit.w / 2;
  const cy = exit.y + exit.h / 2;
  const pulse = 0.5 + Math.sin(time * 2.2) * 0.5;
  const glow = g.createRadialGradient(cx, cy, 4, cx, cy, EXIT_LIGHT_RADIUS * 0.7 + pulse * 14);
  glow.addColorStop(0, 'rgba(125, 227, 139, 0.5)');
  glow.addColorStop(1, 'rgba(125, 227, 139, 0)');
  g.fillStyle = glow;
  g.beginPath(); g.arc(cx, cy, EXIT_LIGHT_RADIUS * 0.7 + pulse * 14, 0, Math.PI * 2); g.fill();
  // The green door, set into the floor as a glowing threshold.
  g.fillStyle = '#0e2e14';
  g.fillRect(exit.x + 4, exit.y + 4, exit.w - 8, exit.h - 8);
  g.strokeStyle = PALETTE.exitGreen;
  g.lineWidth = 3;
  g.strokeRect(exit.x + 4, exit.y + 4, exit.w - 8, exit.h - 8);
  g.fillStyle = PALETTE.exitGreen;
  g.font = 'bold 15px Georgia, serif';
  g.textAlign = 'center';
  g.fillText('KELUAR', cx, cy - 40);
  g.beginPath();
  g.moveTo(cx - 8, cy + 2); g.lineTo(cx + 8, cy + 2); g.lineTo(cx, cy + 12);
  g.closePath();
  g.fill();
}

function drawLantern(g, lamp, time, seed) {
  const flicker = 0.85 + Math.sin(time * 7 + lamp.x * 0.13 + seed) * 0.08
    + Math.sin(time * 13 + lamp.y * 0.07) * 0.07;
  const glow = g.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 26 * flicker);
  glow.addColorStop(0, 'rgba(255, 205, 120, 0.9)');
  glow.addColorStop(0.35, 'rgba(255, 170, 70, 0.35)');
  glow.addColorStop(1, 'rgba(255, 170, 70, 0)');
  g.fillStyle = glow;
  g.beginPath(); g.arc(lamp.x, lamp.y, 26 * flicker, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2a1a08';
  g.fillRect(lamp.x - 5, lamp.y - 8, 10, 16);
  g.fillStyle = '#ffe1a0';
  g.fillRect(lamp.x - 3, lamp.y - 5, 6, 10);
}

// ---- the light pass: darkness with pools of light cut out of it -------------
function drawLighting(g, level, player, guards, time) {
  const light = drawLighting.canvas || (drawLighting.canvas = document.createElement('canvas'));
  light.width = VIEW_W; light.height = VIEW_H;
  const lg = light.getContext('2d');
  lg.clearRect(0, 0, VIEW_W, VIEW_H);
  lg.fillStyle = `rgba(2, 2, 6, ${DARKNESS_ALPHA})`;
  lg.fillRect(0, 0, VIEW_W, VIEW_H);
  lg.globalCompositeOperation = 'destination-out';
  const punch = (x, y, r, strength) => {
    const grad = lg.createRadialGradient(x, y, 4, x, y, r);
    grad.addColorStop(0, `rgba(0,0,0,${strength})`);
    grad.addColorStop(0.55, `rgba(0,0,0,${strength * 0.75})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    lg.fillStyle = grad;
    lg.beginPath(); lg.arc(x, y, r, 0, Math.PI * 2); lg.fill();
  };
  punch(player.x, player.y, PLAYER_LIGHT_RADIUS, 0.96);
  for (const lamp of level.lanterns) {
    const fl = 0.9 + Math.sin(time * 7 + lamp.x * 0.13) * 0.06;
    punch(lamp.x, lamp.y, LANTERN_LIGHT_RADIUS * fl, 0.9);
  }
  const ecx = level.exit.x + level.exit.w / 2;
  const ecy = level.exit.y + level.exit.h / 2;
  punch(ecx, ecy, EXIT_LIGHT_RADIUS, 0.85);
  for (const guard of guards) {
    // The vision cone itself is a pool of light.
    const poly = conePolygon(level, guard);
    const grad = lg.createRadialGradient(guard.x, guard.y, 8, guard.x, guard.y, 235);
    grad.addColorStop(0, 'rgba(0,0,0,0.92)');
    grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    lg.fillStyle = grad;
    lg.beginPath();
    lg.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) lg.lineTo(poly[i].x, poly[i].y);
    lg.closePath();
    lg.fill();
    punch(guard.x, guard.y, GUARD_LIGHT_RADIUS, 0.8);
  }
  lg.globalCompositeOperation = 'source-over';
  g.drawImage(light, 0, 0);
}

// ---- dust motes drifting through the lamplight ------------------------------
function drawDust(g, dust, time) {
  g.save();
  for (const m of dust) {
    const x = (m.x + Math.sin(time * m.drift + m.phase) * 9 + VIEW_W) % VIEW_W;
    const y = (m.y + Math.cos(time * m.drift * 0.7 + m.phase) * 6 + VIEW_H) % VIEW_H;
    g.fillStyle = `rgba(255, 220, 160, ${m.alpha})`;
    g.beginPath(); g.arc(x, y, m.size, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

function drawVignette(g, time) {
  const v = g.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = v;
  g.fillRect(0, 0, VIEW_W, VIEW_H);
}

// ---- HUD --------------------------------------------------------------------
export function suspicionLabel(suspicion, alarm) {
  if (alarm) return 'ALARM!';
  if (suspicion > 66) return 'TERLIHAT!';
  if (suspicion > 25) return 'CURIGA';
  return 'TERSEMBUNYI';
}

function drawHud(g, state) {
  g.save();
  g.fillStyle = 'rgba(8, 5, 2, 0.72)';
  g.fillRect(0, 0, VIEW_W, 46);
  g.fillStyle = 'rgba(255, 200, 120, 0.25)';
  g.fillRect(0, 46, VIEW_W, 1);
  g.fillStyle = '#e8c890';
  g.font = 'bold 17px Georgia, serif';
  g.textAlign = 'left';
  g.fillText(`LEVEL ${state.levelIndex + 1} — ${state.level.name}`, 18, 29);
  g.font = '15px Georgia, serif';
  g.fillStyle = '#c9b183';
  const mins = Math.floor(state.playTime / 60);
  const secs = Math.floor(state.playTime % 60).toString().padStart(2, '0');
  g.fillText(`Waktu ${mins}:${secs}`, 330, 29);
  g.fillText(`Skor ${state.score}`, 470, 29);
  g.fillText(state.ledgerTaken ? '◈ Ledger ✓' : '○ Ledger', 600, 29);
  // Detection meter, centre-right.
  const mx = 800, my = 14, mw = 230, mh = 18;
  const frac = clamp(state.suspicion / 100, 0, 1);
  const col = state.alarm ? '#ff4a2e'
    : frac > 0.66 ? '#ff8a2e' : frac > 0.25 ? '#e8c84a' : '#7de38b';
  g.fillStyle = 'rgba(255,255,255,0.14)';
  g.fillRect(mx, my, mw, mh);
  const grad = g.createLinearGradient(mx, 0, mx + mw, 0);
  grad.addColorStop(0, '#7de38b');
  grad.addColorStop(0.5, '#e8c84a');
  grad.addColorStop(1, '#ff4a2e');
  g.fillStyle = grad;
  g.fillRect(mx, my, mw * frac, mh);
  g.strokeStyle = 'rgba(255, 220, 160, 0.5)';
  g.lineWidth = 1;
  g.strokeRect(mx + 0.5, my + 0.5, mw - 1, mh - 1);
  g.fillStyle = col;
  g.font = 'bold 15px Georgia, serif';
  g.textAlign = 'left';
  g.fillText(suspicionLabel(state.suspicion, state.alarm), mx + mw + 12, 29);
  // Bottom hint.
  g.fillStyle = 'rgba(8, 5, 2, 0.6)';
  g.fillRect(0, VIEW_H - 26, VIEW_W, 26);
  g.fillStyle = '#a08a64';
  g.font = '13px Georgia, serif';
  g.textAlign = 'center';
  g.fillText('WASD / Panah bergerak  •  Shift menyelinap  •  Klik mouse menuju titik  •  R mulai ulang  •  Sembunyi di balik rak — kerucut cahaya penjaga adalah pandangan mereka', VIEW_W / 2, VIEW_H - 9);
  g.restore();
}

// ---- full-screen states ------------------------------------------------------
function overlay(g, alpha) {
  g.fillStyle = `rgba(4, 2, 1, ${alpha})`;
  g.fillRect(0, 0, VIEW_W, VIEW_H);
}

function titleText(g, text, y, size, color, bold) {
  g.font = `${bold ? 'bold ' : ''}${size}px Georgia, serif`;
  g.textAlign = 'center';
  g.fillStyle = color;
  g.fillText(text, VIEW_W / 2, y);
}

function drawTitle(g, state) {
  overlay(g, 0.62);
  titleText(g, 'THE MIDNIGHT STACKS', 210, 64, '#f2c14e', true);
  titleText(g, '— Stealth di Arsip Tengah Malam —', 258, 22, '#c9b183', false);
  titleText(g, 'Kau arsiparis malam. Ambil ledger tersegel, capai pintu keluar —', 330, 21, '#e8dcc0', false);
  titleText(g, 'tanpa satu pun penjaga melihatmu.', 362, 21, '#e8dcc0', false);
  titleText(g, 'WASD / Panah — bergerak      Shift — menyelinap (sulit terlihat)', 430, 19, '#a08a64', false);
  titleText(g, 'Klik mouse — berjalan ke titik itu      R — mulai ulang', 458, 19, '#a08a64', false);
  titleText(g, 'Jangan masuk kerucut cahaya penjaga. Kalau meter curiga penuh, mereka mengejarmu.', 492, 19, '#ff9a6a', false);
  const pulse = 0.65 + Math.sin(state.time * 3) * 0.35;
  g.globalAlpha = pulse;
  titleText(g, 'KLIK ATAU TEKAN ENTER UNTUK MULAI', 580, 26, '#ffe1a0', true);
  g.globalAlpha = 1;
  if (state.best > 0) titleText(g, `Skor terbaik: ${state.best}`, 640, 17, '#c9b183', false);
}

function drawLevelClear(g, state) {
  overlay(g, 0.55);
  titleText(g, 'LEVEL SELESAI', 300, 54, '#7de38b', true);
  titleText(g, state.levelClearText, 360, 20, '#e8dcc0', false);
  titleText(g, `Bonus level +${1000}   •   Bonus waktu +${state.levelTimeBonus}   •   ${state.levelGhost ? 'Tanpa alarm +400' : 'Alarm sempat berbunyi'}`, 410, 19, '#c9b183', false);
  titleText(g, `Skor ${state.score} — level berikutnya segera dimulai…`, 470, 20, '#ffe1a0', false);
}

function drawGameOver(g, state) {
  overlay(g, 0.66);
  titleText(g, 'TERTANGKAP!', 300, 60, '#ff5a3c', true);
  titleText(g, 'Penjaga menemukanmu di bawah cahaya lentera.', 368, 21, '#e8dcc0', false);
  titleText(g, `Level ${state.levelIndex + 1} — Skor ${state.score}`, 410, 19, '#c9b183', false);
  titleText(g, 'Tekan R atau klik untuk mencoba lagi', 480, 20, '#ffe1a0', false);
}

function drawWin(g, state) {
  overlay(g, 0.6);
  titleText(g, 'ARSIP DISELAMATKAN', 270, 56, '#f2c14e', true);
  titleText(g, 'Tiga malam, tiga ledger tersegel — dan tak satu pun penjaga', 340, 21, '#e8dcc0', false);
  titleText(g, 'yang sempat melihat wajahmu.', 372, 21, '#e8dcc0', false);
  titleText(g, `Skor akhir ${state.score}    •    Waktu ${Math.floor(state.playTime / 60)}:${Math.floor(state.playTime % 60).toString().padStart(2, '0')}`, 440, 22, '#ffe1a0', false);
  titleText(g, 'Tekan R atau klik untuk bermain lagi', 500, 19, '#c9b183', false);
}

// ---- the renderer -------------------------------------------------------------
export function createRenderer(level, seed) {
  const floor = bakeFloorTexture(level, seed * 7919 + 13);
  const rng = makeRng(seed * 104729 + 7);
  // One fixed seed per obstacle: the book spines are re-rolled from the same
  // seed every frame, so the shelves never shimmer between frames.
  const bookSeeds = level.obstacles.map((o, i) => seed * 31 + 5 + i * 977 + o.x * 13 + o.y * 7);
  return { floor, rng, bookSeeds };
}

export function render(ctx, renderer, state) {
  const g = ctx;
  const { level, player, guards, time } = state;
  g.clearRect(0, 0, VIEW_W, VIEW_H);
  g.drawImage(renderer.floor, 0, 0);
  drawWalls(g, level);
  drawExit(g, level.exit, time);
  drawLedger(g, level.ledger, time, state.ledgerTaken);
  // Furniture, back to front by tile row so nearer pieces overlap correctly.
  const sorted = [...level.obstacles].sort((a, b) => (a.y + a.h) - (b.y + b.h));
  sorted.forEach((o) => {
    if (o.kind === 'shelf') drawShelf(g, o, makeRng(renderer.bookSeeds[level.obstacles.indexOf(o)]));
    else if (o.kind === 'crate') drawCrate(g, o, renderer.rng);
    else if (o.kind === 'desk') drawDesk(g, o);
  });
  for (const lamp of level.lanterns) drawLantern(g, lamp, time, 0);
  // People, sorted by y so the nearer figure overlaps.
  const people = [
    ...guards.map((gu) => ({ y: gu.y, draw: () => drawGuard(g, gu, time, state.alarm) })),
    { y: player.y, draw: () => drawPlayer(g, player, time) },
  ].sort((a, b) => a.y - b.y);
  for (const p of people) p.draw();
  // A warm wash over each vision cone, so the cone reads even where the
  // lantern light already reaches — the cone is the guard's gaze, made visible.
  for (const guard of guards) {
    const poly = conePolygon(level, guard);
    const wash = g.createRadialGradient(guard.x, guard.y, 10, guard.x, guard.y, 235);
    wash.addColorStop(0, state.alarm ? 'rgba(255, 110, 60, 0.20)' : 'rgba(255, 190, 90, 0.16)');
    wash.addColorStop(1, 'rgba(255, 190, 90, 0.02)');
    g.fillStyle = wash;
    g.beginPath();
    g.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) g.lineTo(poly[i].x, poly[i].y);
    g.closePath();
    g.fill();
  }
  drawLighting(g, level, player, guards, time);
  drawDust(g, state.dust, time);
  drawVignette(g, time);
  if (state.mode === 'playing' || state.mode === 'clear' || state.mode === 'gameover' || state.mode === 'win') {
    drawHud(g, state);
  }
  if (state.mode === 'title') drawTitle(g, state);
  else if (state.mode === 'clear') drawLevelClear(g, state);
  else if (state.mode === 'gameover') drawGameOver(g, state);
  else if (state.mode === 'win') drawWin(g, state);
}
