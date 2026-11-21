// audio.js — every sound is synthesized with WebAudio: no audio files, no
// network. Footsteps are short filtered noise bursts, the ambience is a low
// drone with a slow swell and the occasional rustle of paper, the alarm is a
// two-tone call, and pickups and captures are small melodic stings.
export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    ambientOn: false,
    rustleTimer: 5,
    alarmOsc: null,
  };

  function ensure() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return true;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function noiseBuffer(duration) {
    const len = Math.floor(audio.ctx.sampleRate * duration);
    const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function playNoise({ duration, freq, q, gain, type = 'bandpass' }) {
    if (!ensure()) return;
    const t = audio.ctx.currentTime;
    const src = audio.ctx.createBufferSource();
    src.buffer = noiseBuffer(duration);
    const filter = audio.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = audio.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(audio.master);
    src.start(t);
    src.stop(t + duration);
  }

  function playTone({ freq, duration, gain, type = 'sine', when = 0, slideTo = null }) {
    if (!ensure()) return;
    const t = audio.ctx.currentTime + when;
    const osc = audio.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    const g = audio.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(g);
    g.connect(audio.master);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  return {
    // Call on the first user gesture; browsers block audio before that.
    unlock() { ensure(); this.startAmbient(); },

    // A soft step. volume 0..1 by distance; sneaking steps are near silent.
    footstep(volume, sneaking) {
      playNoise({ duration: 0.09, freq: sneaking ? 320 : 480, q: 1.1, gain: 0.22 * volume });
    },

    // The guard's heavier boot, heard through the dark.
    guardStep(distance) {
      const volume = Math.max(0, 1 - distance / 520);
      if (volume <= 0.02) return;
      playNoise({ duration: 0.11, freq: 220, q: 1.0, gain: 0.3 * volume });
    },

    startAmbient() {
      if (!ensure() || audio.ambientOn) return;
      audio.ambientOn = true;
      const ctx = audio.ctx;
      const droneGain = ctx.createGain();
      droneGain.gain.value = 0.05;
      droneGain.connect(audio.master);
      for (const freq of [55, 82.5, 110.3]) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        osc.detune.value = (Math.random() - 0.5) * 6;
        osc.connect(droneGain);
        osc.start();
      }
      // A slow swell, like wind under the archive door.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.025;
      lfo.connect(lfoGain);
      lfoGain.connect(droneGain.gain);
      lfo.start();
    },

    // A page turning somewhere in the dark, every few seconds.
    updateAmbient(dt) {
      if (!audio.ambientOn) return;
      audio.rustleTimer -= dt;
      if (audio.rustleTimer <= 0) {
        audio.rustleTimer = 6 + Math.random() * 7;
        playNoise({ duration: 0.5, freq: 2400, q: 0.8, gain: 0.05, type: 'highpass' });
      }
    },

    alarm() {
      if (!ensure()) return;
      playTone({ freq: 660, duration: 0.28, gain: 0.16, type: 'square' });
      playTone({ freq: 440, duration: 0.28, gain: 0.16, type: 'square', when: 0.3 });
      playTone({ freq: 660, duration: 0.28, gain: 0.16, type: 'square', when: 0.6 });
    },

    pickup() {
      playTone({ freq: 880, duration: 0.22, gain: 0.14 });
      playTone({ freq: 1174, duration: 0.3, gain: 0.14, when: 0.09 });
      playTone({ freq: 1568, duration: 0.4, gain: 0.12, when: 0.18 });
    },

    levelClear() {
      [523, 659, 784, 1046].forEach((f, i) => playTone({ freq: f, duration: 0.35, gain: 0.12, when: i * 0.11 }));
    },

    caught() {
      playTone({ freq: 220, duration: 0.7, gain: 0.2, type: 'sawtooth', slideTo: 55 });
      playNoise({ duration: 0.5, freq: 300, q: 0.7, gain: 0.2, type: 'lowpass' });
    },

    win() {
      [523, 659, 784, 1046, 1318].forEach((f, i) => playTone({ freq: f, duration: 0.5, gain: 0.12, when: i * 0.13 }));
    },
  };
}
