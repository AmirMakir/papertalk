#!/usr/bin/env node
// Synthesizes the reel sound effects and background beds into assets/sfx/*.wav.
// Everything is generated here from noise, sines and plucked strings, so there is no
// third-party licence to track.
//   node scripts/sfx.mjs
//
// Each effect comes in a few variants (name.wav, name-1.wav, …) so a reel never
// plays the same sound twice in a row; src/sfx.tsx picks one per cue. Variant 0 is
// the original sound.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", "sfx");
const SR = 44100;

// Deterministic noise so the files only change when this script does.
let seed = 1;
const noise = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 31) - 1;

const buffer = (sec) => new Float32Array(Math.round(sec * SR));
const env = (t, attack, decay) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));
const note = (n) => 440 * 2 ** ((n - 69) / 12); // MIDI note → Hz

// State-variable filter, returns { low, band, high } per sample.
function svf() {
  let low = 0;
  let band = 0;
  return (x, fc, q) => {
    const f = 2 * Math.sin((Math.PI * Math.min(fc, SR / 6)) / SR);
    low += f * band;
    const high = x - low - q * band;
    band += f * high;
    return { low, band, high };
  };
}

// Karplus-Strong plucked string, added into `b` at sample `at` (wrapping round, so a
// loop's last notes ring into its start).
function pluck(b, at, freq, gain, damp = 0.996, bright = 0.5) {
  const n = Math.max(2, Math.round(SR / freq));
  const line = Float32Array.from({ length: n }, () => noise() * gain);
  const len = Math.round(SR * 1.6);
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const k = i % n;
    const cur = line[k];
    const next = line[(k + 1) % n];
    line[k] = damp * (bright * cur + (1 - bright) * 0.5 * (cur + next));
    const out = 0.5 * (cur + prev);
    prev = cur;
    b[(at + i) % b.length] += out;
  }
}

// ---------- effects: [variant 0, variant 1, …] ----------

const effects = {
  whoosh: [
    // band-passed noise sweeping up then down
    () => sweep(0.36, (p) => 400 + 2600 * Math.sin(Math.PI * Math.min(1, p * 1.1)), (p) => Math.sin(Math.PI * p) ** 1.5, 0.7),
    // short bright swish
    () => sweep(0.22, (p) => 1500 + 4500 * p, (p) => Math.sin(Math.PI * p) ** 2, 0.5),
    // long low air
    () => sweep(0.55, (p) => 200 + 1300 * Math.sin(Math.PI * p), (p) => Math.sin(Math.PI * p) ** 1.2, 0.9),
    // rising swish that stops on the cut
    () => sweep(0.3, (p) => 500 + 4500 * p * p, (p) => p ** 1.5 * Math.min(1, (1 - p) * 12), 0.6),
  ],
  pop: [
    // quick downward sine blip
    () => blip(0.1, (t) => 950 - 6000 * t, 0.003, 0.03),
    // higher, tighter
    () => blip(0.08, (t) => 1500 - 9000 * t, 0.002, 0.022),
    // bubble: a rising blip
    () => blip(0.12, (t) => 380 + 5200 * t, 0.004, 0.035),
    // a plucked string
    () => {
      const b = buffer(0.5);
      pluck(b, 0, note(81), 0.9, 0.993, 0.8);
      return fade(b, 0.4);
    },
  ],
  thud: [
    // sub drop
    () => {
      const b = buffer(0.4);
      let ph = 0;
      for (let i = 0; i < b.length; i++) {
        const t = i / SR;
        ph += (2 * Math.PI * (110 * Math.exp(-t * 6) + 42)) / SR;
        b[i] = Math.tanh(Math.sin(ph) * 2.2) * env(t, 0.003, 0.12) * 0.85;
      }
      return b;
    },
    // boom: sub plus a dark noise tail
    () => {
      const b = buffer(0.7);
      const f = svf();
      let ph = 0;
      for (let i = 0; i < b.length; i++) {
        const t = i / SR;
        ph += (2 * Math.PI * (70 * Math.exp(-t * 4) + 38)) / SR;
        b[i] = Math.tanh(Math.sin(ph) * 2) * env(t, 0.004, 0.2) * 0.8 + f(noise(), 500, 0.6).low * env(t, 0.002, 0.18) * 0.9;
      }
      return b;
    },
    // punch: short mid hit with a click on top
    () => {
      const b = buffer(0.22);
      const f = svf();
      let ph = 0;
      for (let i = 0; i < b.length; i++) {
        const t = i / SR;
        ph += (2 * Math.PI * (220 * Math.exp(-t * 18) + 70)) / SR;
        b[i] = Math.tanh(Math.sin(ph) * 3) * env(t, 0.001, 0.05) * 0.8 + f(noise(), 3000, 0.4).band * env(t, 0.0005, 0.004) * 1.2;
      }
      return b;
    },
  ],
  click: [
    // two tiny mechanical clicks
    () => {
      const b = buffer(0.09);
      const f = svf();
      for (let i = 0; i < b.length; i++) {
        const t = i / SR;
        const c1 = env(t, 0.0005, 0.004);
        const c2 = t > 0.03 ? env(t - 0.03, 0.0005, 0.005) * 0.8 : 0;
        b[i] = f(noise(), 3800, 0.3).band * (c1 + c2) * 2.2;
      }
      return b;
    },
    // one crisp mouse click
    () => {
      const b = buffer(0.05);
      const f = svf();
      for (let i = 0; i < b.length; i++) b[i] = f(noise(), 5200, 0.25).band * env(i / SR, 0.0003, 0.003) * 2.4;
      return b;
    },
    // a soft button: press and release
    () => {
      const b = buffer(0.14);
      const f = svf();
      for (let i = 0; i < b.length; i++) {
        const t = i / SR;
        const e = env(t, 0.0008, 0.008) + (t > 0.08 ? env(t - 0.08, 0.0008, 0.006) * 0.6 : 0);
        b[i] = f(noise(), 1400, 0.4).band * e * 2.6;
      }
      return b;
    },
  ],
  slap: [
    // bright noise snap over a short low thump
    () => {
      const b = buffer(0.16);
      const f = svf();
      for (let i = 0; i < b.length; i++) {
        const t = i / SR;
        const snap = f(noise(), 2500, 0.5).high * env(t, 0.001, 0.012);
        const thump = Math.sin(2 * Math.PI * (140 - 300 * t) * t) * env(t, 0.002, 0.035);
        b[i] = snap * 0.9 + thump * 0.7;
      }
      return b;
    },
    // rubber stamp: a wooden knock and paper
    () => {
      const b = buffer(0.25);
      const f = svf();
      for (let i = 0; i < b.length; i++) {
        const t = i / SR;
        const knock = (Math.sin(2 * Math.PI * 210 * t) + 0.5 * Math.sin(2 * Math.PI * 540 * t)) * env(t, 0.001, 0.03);
        b[i] = knock * 0.7 + f(noise(), 1800, 0.7).band * env(t, 0.001, 0.02) * 1.4;
      }
      return b;
    },
    // heavy slam
    () => {
      const b = buffer(0.35);
      const f = svf();
      let ph = 0;
      for (let i = 0; i < b.length; i++) {
        const t = i / SR;
        ph += (2 * Math.PI * (90 * Math.exp(-t * 10) + 45)) / SR;
        b[i] = Math.tanh(Math.sin(ph) * 2.5) * env(t, 0.002, 0.08) * 0.7 + f(noise(), 2200, 0.5).high * env(t, 0.001, 0.015) * 0.9;
      }
      return b;
    },
  ],
  ding: [
    // two bell partials
    () => bell([1568, 2352, 3136], [0.6, 0.25, 0.1], 0.8, 0.22),
    // success: three quick notes up
    () => {
      const b = buffer(0.9);
      [84, 88, 91].forEach((n, k) => addTone(b, k * 0.07, note(n), 0.5, 0.18, [1, 0.3]));
      return b;
    },
    // marimba
    () => {
      const b = buffer(0.6);
      addTone(b, 0, note(81), 0.9, 0.12, [1, 0, 0, 0.35]);
      return b;
    },
    // shimmer: scattered high partials
    () => {
      const b = buffer(1.0);
      for (let k = 0; k < 9; k++) addTone(b, k * 0.035, 2000 + ((k * 733) % 3200), 0.16, 0.3, [1]);
      return b;
    },
  ],
  tick: [
    () => {
      const b = buffer(0.05);
      const f = svf();
      for (let i = 0; i < b.length; i++) b[i] = f(noise(), 5200, 0.4).band * env(i / SR, 0.0005, 0.006) * 1.4;
      return b;
    },
    () => {
      const b = buffer(0.05);
      const f = svf();
      for (let i = 0; i < b.length; i++) b[i] = f(noise(), 2600, 0.4).band * env(i / SR, 0.0005, 0.008) * 1.6;
      return b;
    },
  ],
  buzz: [
    // low detuned buzz, softly clipped
    () => {
      const b = buffer(0.42);
      const f = svf();
      for (let i = 0; i < b.length; i++) {
        const t = i / SR;
        const raw = Math.sign(Math.sin(2 * Math.PI * 98 * t)) * 0.5 + Math.sign(Math.sin(2 * Math.PI * 147 * t)) * 0.35;
        const shaped = f(raw, 900, 0.8).low;
        const e = Math.min(1, t / 0.01) * Math.min(1, (0.42 - t) / 0.08);
        b[i] = Math.tanh(shaped * 2) * e * 0.55;
      }
      return b;
    },
  ],
  glitch: [
    // digital stutter: short square bursts at random pitches, bit-crushed
    () => {
      const b = buffer(0.32);
      const cuts = [0, 0.05, 0.09, 0.15, 0.18, 0.24];
      cuts.forEach((c, k) => {
        const fq = 180 + ((k * 397) % 900);
        const len = 0.035 + (k % 3) * 0.01;
        for (let i = 0; i < len * SR; i++) {
          const t = i / SR;
          const v = Math.sign(Math.sin(2 * Math.PI * fq * t)) * 0.5 + noise() * 0.25;
          b[Math.round(c * SR) + i] += Math.round(v * 6) / 6 * Math.min(1, (len - t) / 0.004);
        }
      });
      return b;
    },
    // tape stop: a tone dragged down to nothing
    () => {
      const b = buffer(0.38);
      let ph = 0;
      for (let i = 0; i < b.length; i++) {
        const t = i / SR;
        ph += (2 * Math.PI * 520 * (1 - t / 0.38) ** 2) / SR;
        b[i] = (Math.sign(Math.sin(ph)) * 0.35 + Math.sin(ph * 2) * 0.3) * Math.min(1, t / 0.005) * (1 - t / 0.38);
      }
      return b;
    },
    // gated static
    () => {
      const b = buffer(0.3);
      const f = svf();
      for (let i = 0; i < b.length; i++) {
        const t = i / SR;
        const gate = Math.floor(t * 40) % 3 === 1 ? 0 : 1;
        b[i] = f(noise(), 1800, 0.3).band * gate * (1 - t / 0.3) * 1.6;
      }
      return b;
    },
  ],
  riser: [
    // noise and a tone climbing into the next moment
    () => {
      const b = buffer(0.9);
      const f = svf();
      let ph = 0;
      for (let i = 0; i < b.length; i++) {
        const t = i / SR;
        const p = t / 0.9;
        ph += (2 * Math.PI * (200 + 1400 * p * p)) / SR;
        b[i] = (f(noise(), 600 + 6000 * p * p, 0.6).band * 0.9 + Math.sin(ph) * 0.25) * p ** 2.2 * Math.min(1, (1 - p) * 30);
      }
      return b;
    },
  ],
};

function sweep(sec, fc, amp, q) {
  const b = buffer(sec);
  const f = svf();
  for (let i = 0; i < b.length; i++) {
    const p = i / b.length;
    b[i] = f(noise(), fc(p), q).band * amp(p) * 1.6;
  }
  return b;
}

function blip(sec, freq, attack, decay) {
  const b = buffer(sec);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * Math.max(60, freq(t))) / SR;
    b[i] = Math.sin(ph) * env(t, attack, decay) * 0.8;
  }
  return b;
}

// A tone with harmonics weights [fundamental, 2×, 3×, 4×].
function addTone(b, at, freq, gain, decay, harmonics) {
  const start = Math.round(at * SR);
  for (let i = 0; start + i < b.length; i++) {
    const t = i / SR;
    let v = 0;
    harmonics.forEach((w, h) => (v += w * Math.sin(2 * Math.PI * freq * (h + 1) * t)));
    b[start + i] += v * env(t, 0.002, decay) * gain;
  }
}

function bell(freqs, weights, sec, decay) {
  const b = buffer(sec);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    let v = 0;
    freqs.forEach((fq, k) => (v += Math.sin(2 * Math.PI * fq * t) * weights[k]));
    b[i] = v * env(t, 0.002, decay) * 0.7;
  }
  return b;
}

function fade(b, sec) {
  const n = Math.round(sec * SR);
  for (let i = 0; i < Math.min(n, b.length); i++) b[b.length - 1 - i] *= i / n;
  return b;
}

// ---------- beds: 9.6 s loops (16 beats at 100 bpm) that join seamlessly ----------

const BEAT = 0.6;
const LOOP = 16 * BEAT;

const beds = {
  // threat: a low drone that breathes and swells every two beats
  tense() {
    const b = buffer(LOOP);
    const f = svf();
    let p1 = 0;
    let p2 = 0;
    let p3 = 0;
    // two passes: the first only settles the filter, so the loop's start matches its end
    for (let i = 0; i < 2 * b.length; i++) {
      const t = (i % b.length) / SR;
      p1 = (p1 + 55 / SR) % 1;
      p2 = (p2 + 55.3125 / SR) % 1;
      p3 = (p3 + 82.5 / SR) % 1;
      const saw = 2 * p1 - 1 + (2 * p2 - 1) + 0.6 * (2 * p3 - 1);
      const cut = 220 + 160 * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / LOOP));
      const swell = 0.75 - 0.25 * Math.cos((2 * Math.PI * t) / (2 * BEAT));
      const v = f(saw, cut, 0.9).low * 0.5 * swell;
      if (i >= b.length) b[i - b.length] = v;
    }
    return b;
  },
  // explaining: a plucked minor arpeggio in eighths, soft hats on the offbeats
  calm() {
    return groove([
      [57, 60, 64],
      [53, 57, 60],
      [60, 64, 67],
      [55, 59, 62],
    ]);
  },
  // the payoff: the same groove in major, with a soft pad under it
  bright() {
    const chords = [
      [60, 64, 67],
      [55, 59, 62],
      [57, 60, 64],
      [53, 57, 60],
    ];
    const b = groove(chords);
    chords.forEach((c, bar) => {
      const start = bar * 4 * BEAT;
      for (let i = 0; i < 4 * BEAT * SR; i++) {
        const t = i / SR;
        const shape = Math.sin((Math.PI * t) / (4 * BEAT));
        let v = 0;
        c.forEach((n) => (v += Math.sin(2 * Math.PI * note(n) * (start + t))));
        b[Math.round(start * SR) + i] += v * shape * 0.05;
      }
    });
    return b;
  },
};

function groove(chords) {
  const b = buffer(LOOP);
  const hat = svf();
  chords.forEach((c, bar) => {
    const order = [0, 1, 2, 1, 0, 1, 2, 1];
    order.forEach((k, e) => {
      const at = Math.round((bar * 4 * BEAT + e * (BEAT / 2)) * SR);
      pluck(b, at, note(c[k] + 12), e % 2 ? 0.28 : 0.4, 0.995, 0.5);
    });
    pluck(b, Math.round(bar * 4 * BEAT * SR), note(c[0] - 12), 0.5, 0.997, 0.3);
  });
  for (let e = 0; e < 32; e++) {
    if (e % 2 === 0) continue;
    const at = Math.round(e * (BEAT / 2) * SR);
    for (let i = 0; i < 0.04 * SR; i++) b[(at + i) % b.length] += hat(noise(), 8000, 0.3).high * env(i / SR, 0.0005, 0.008) * 0.12;
  }
  return b;
}

function writeWav(file, data) {
  const pcm = Buffer.alloc(data.length * 2);
  let peak = 1e-9;
  for (const v of data) peak = Math.max(peak, Math.abs(v));
  const gain = Math.min(1, 0.89 / peak);
  data.forEach((v, i) => pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * gain)) * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, pcm]));
}

fs.mkdirSync(OUT, { recursive: true });
for (const [name, variants] of Object.entries(effects))
  variants.forEach((make, k) => {
    seed = 1 + k * 7919;
    const file = k ? `${name}-${k}.wav` : `${name}.wav`;
    writeWav(path.join(OUT, file), Array.from(make()));
    console.log(`✓ assets/sfx/${file}`);
  });
for (const [name, make] of Object.entries(beds)) {
  seed = 4242;
  writeWav(path.join(OUT, `bed-${name}.wav`), Array.from(make()));
  console.log(`✓ assets/sfx/bed-${name}.wav`);
}
