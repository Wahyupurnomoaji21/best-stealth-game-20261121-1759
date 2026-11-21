# The Midnight Stacks

[![make.fun](https://make.fun/badge/bounty/best-stealth-game-20261121-1759)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![make.fun entry](https://make.fun/badge/entry/best-stealth-game-20261121-1759)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![make.fun game](https://make.fun/badge/game/best-stealth-game-20261121-1759)](https://make.fun/bounty/best-stealth-game-20261121-1759)

Entri untuk kompetisi [Make the best stealth game](https://make.fun/bounty/best-stealth-game-20261121-1759) di make.fun.

Top-down stealth di arsip berlentera. Kamu arsiparis malam: ambil ledger
tersegel, capai pintu keluar — tanpa satu pun penjaga melihatmu.

## Cara main

- **WASD / panah** — bergerak
- **Shift** — menyelinap (lebih lambat, jauh lebih sulit terlihat)
- **Klik mouse** — berjalan ke titik yang diklik
- **R** — mulai ulang level
- **Enter / klik** — mulai dari layar judul

## Aturan

- 3 level: penjaga makin banyak, patroli makin rapat.
- Setiap penjaga punya **kerucut penglihatan** (cahaya hangat) — masuk ke dalamnya
  dan meter curiga naik; sembunyi di balik rak/peti dan meter turun lagi.
- Meter penuh → **ALARM**: semua penjaga mengejar posisimu terakhir terlihat.
  Putus pandangan cukup lama dan alarm reda — masih ada kesempatan kabur.
- Ambil **ledger** dulu, baru pintu **KELUAR** terbuka. Bonus skor kalau selesai
  tanpa alarm sama sekali.

## Teknologi

- Game statis murni: `game/index.html` + modul ES, tanpa build step, tanpa
  network request. Semua aset prosedural: tekstur lantai kayu, rak buku,
  cahaya lentera, partikel debu, dan suara (langkah kaki, ambience, alarm)
  dibuat lewat canvas dan WebAudio.
- Struktur source (satu tugas per file): `game/src/config.js`,
  `world.js` (level), `guards.js` (patroli/AI), `vision.js` (cone/line-of-sight),
  `render.js`, `input.js`, `audio.js`, `shots.js` (mode screenshot), `main.js`.

## Menjalankan lokal

```sh
node serve.ts        # lalu buka http://localhost:8080
```

Screenshot deterministik: `?shot=start|play|alert|end&seed=1`.

## Lisensi

MIT — lihat `LICENSE`.
