// Word timings for a narration take without a speech recogniser. The text is known,
// so we only need to find where each word sits: pauses in the audio are matched to
// punctuation by dynamic programming (keeping the speaking rate steady), the words
// between two pauses are spread by syllables and snapped to dips in loudness.
import fs from "node:fs";

export function readWav(buf) {
  let p = 12;
  let fmt = null;
  let data = null;
  while (p + 8 <= buf.length) {
    const id = buf.toString("ascii", p, p + 4);
    const size = buf.readUInt32LE(p + 4);
    if (id === "fmt ") fmt = { ch: buf.readUInt16LE(p + 10), sr: buf.readUInt32LE(p + 12), bits: buf.readUInt16LE(p + 22) };
    else if (id === "data") data = buf.subarray(p + 8, Math.min(buf.length, p + 8 + size));
    p += 8 + size + (size & 1);
    if (data) break;
  }
  if (!fmt || !data) throw new Error("not a WAV file");
  if (fmt.bits !== 16) throw new Error(`need 16-bit PCM, got ${fmt.bits}-bit`);
  const n = Math.floor(data.length / 2 / fmt.ch);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let c = 0; c < fmt.ch; c++) s += data.readInt16LE((i * fmt.ch + c) * 2);
    x[i] = s / fmt.ch / 32768;
  }
  return { sr: fmt.sr, x };
}

export function writeWav(file, sr, x) {
  const n = x.length;
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(x[i] * 32767))), 44 + i * 2);
  fs.writeFileSync(file, b);
}

export const syllables = (w) => {
  let s = w.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9']/g, "");
  let extra = 0;
  if (/n't$/.test(s)) {
    s = s.slice(0, -3);
    if (/[^aeiouy]$/.test(s)) extra = 1;
  } else s = s.replace(/'(s|re|ll|ve|d|m)$/, "");
  s = s.replace(/'/g, "");
  if (!s) return 0;
  if (/^\d+$/.test(s)) return Math.max(1, s.length * 1.5);
  let n = (s.match(/[aeiouy]+/g) || []).length;
  if (n > 1 && /[^aeiouy]e$/.test(s) && !/[^aeiouy]le$/.test(s)) n--;
  if (n > 1 && /[^aeiouytd]ed$/.test(s)) n--;
  return Math.max(1, n) + extra;
};

// Loudness per 10 ms frame and the silent stretches: head and tail silence, and the
// pauses in between that are at least `minPause` long.
export function silences(x, sr, minPause = 0.1) {
  const hop = Math.round(sr / 100);
  const win = hop * 2;
  const nf = Math.max(1, Math.floor((x.length - win) / hop) + 1);
  const db = new Float32Array(nf);
  for (let f = 0; f < nf; f++) {
    let e = 0;
    for (let i = f * hop, j = Math.min(x.length, i + win); i < j; i++) e += x[i] * x[i];
    db[f] = 10 * Math.log10(e / win + 1e-12);
  }
  const sorted = Array.from(db).sort((a, b) => a - b);
  const hi = sorted[Math.floor(nf * 0.9)];
  const lo = sorted[Math.floor(nf * 0.1)];
  const thr = Math.max(hi - 30, lo + 6);
  const ft = (f) => (f * hop + win / 2) / sr;
  const dur = x.length / sr;
  const runs = [];
  for (let f = 0; f < nf; ) {
    if (db[f] >= thr) {
      f++;
      continue;
    }
    let g = f;
    while (g < nf && db[g] < thr) g++;
    runs.push({ a: f === 0 ? 0 : ft(f), b: g >= nf ? dur : ft(g - 1) + 0.01, head: f === 0, tail: g >= nf });
    f = g;
  }
  // A breath between two silences, or right before speech, is quiet but not silent:
  // merge silences across it and stretch a pause over it.
  const loud = Array.from(db).filter((v) => v >= thr).sort((p, q) => p - q);
  const soft = (loud[Math.floor(loud.length / 2)] ?? hi) - 15;
  const quiet = (t0, t1) => {
    for (let f = Math.floor(t0 * 100); f < Math.ceil(t1 * 100) && f < nf; f++) if (db[Math.max(0, f)] >= soft) return false;
    return true;
  };
  for (let i = 0; i + 1 < runs.length; ) {
    if (runs[i + 1].a - runs[i].b <= 0.35 && quiet(runs[i].b, runs[i + 1].a)) {
      runs[i] = { a: runs[i].a, b: runs[i + 1].b, head: runs[i].head, tail: runs[i + 1].tail };
      runs.splice(i + 1, 1);
    } else i++;
  }
  for (const r of runs) {
    if (r.tail || r.b - r.a < 0.15) continue;
    let f = Math.round(r.b * 100);
    const lim = f + 30;
    while (f < nf && f < lim && db[f] < soft) f++;
    r.b = Math.max(r.b, f / 100);
  }
  const head = runs.length && runs[0].head ? runs[0].b : 0;
  const last = runs[runs.length - 1];
  const tail = last && last.tail && !last.head ? last.a : dur;
  const cands = runs.filter((r) => !r.head && !r.tail && r.b - r.a >= minPause).map((r) => ({ a: r.a, b: r.b, d: r.b - r.a }));
  return { head, tail, cands, db, ft, hop, sr, thr };
}

// words: [{ syl, brk }] where brk is the break after the word: 0 none, 2 comma or
// colon, 3 end of sentence, 4 end of line, 5 end of block.
export function align(x, sr, words, opt = {}) {
  const S = silences(x, sr, opt.minPause ?? 0.1);
  const { head, tail, cands, db } = S;
  const n = words.length;
  const P = cands.length;
  const G = n - 1;
  const w = words.map((v) => 0.3 + v.syl);
  const Wp = [0];
  for (const v of w) Wp.push(Wp[Wp.length - 1] + v);
  const GAMMA = [0, 0.3, 1.5, 2.5, 3.5, 4.5];
  const Gp = [0];
  for (let g = 0; g < G; g++) Gp.push(Gp[g] + GAMMA[words[g].brk || 0]);
  const unassigned = (g1, g2) => (g2 >= g1 ? Gp[g2 + 1] - Gp[g1] : 0);
  const Sp = [0];
  const Dp = [0];
  for (const c of cands) {
    Sp.push(Sp[Sp.length - 1] + Math.max(0, c.d - 0.07) * 10);
    Dp.push(Dp[Dp.length - 1] + Math.max(0, c.d - 0.08));
  }
  const skipCost = (c1, c2) => (c2 >= c1 ? Sp[c2 + 1] - Sp[c1] : 0);
  const skipDur = (c1, c2) => (c2 >= c1 ? Dp[c2 + 1] - Dp[c1] : 0);
  const assign = (c, g) => {
    const b = words[g].brk || 0;
    const d = cands[c].d;
    return b === 0 ? 20 * Math.max(0, d - 0.05) : b === 2 ? -2.5 * Math.min(d, 0.5) : -3 * Math.min(d, 0.7);
  };
  const MAXS = 8;
  const MAXJ = 45;
  let R = (tail - head - cands.reduce((a, c) => a + (c.d > 0.25 ? c.d : 0), 0)) / Wp[n];
  const segCost = (w1, w2, D) => {
    const W = Wp[w2 + 1] - Wp[w1];
    if (W <= 0 || D <= 0.04) return 1e9;
    const r = Math.log(D / (R * W));
    return 2 * r * r * Math.min(W, 8);
  };
  const pathCost = (pp) => {
    let v = 0;
    let pc = -1;
    let pg = -1;
    let pt = head;
    for (const q of [...pp, { c: P, g: n - 1 }]) {
      const end = q.c < P ? cands[q.c].a : tail;
      v += segCost(pg + 1, q.g, end - pt - skipDur(pc + 1, q.c - 1)) + skipCost(pc + 1, q.c - 1) + unassigned(pg + 1, q.g - 1) + (q.c < P ? assign(q.c, q.g) : 0);
      pc = q.c;
      pg = q.g;
      pt = q.c < P ? cands[q.c].b : tail;
    }
    return v;
  };
  let pairs = [];
  for (let iter = 0; iter < 2; iter++) {
    const INF = 1e18;
    const dp = new Float64Array(Math.max(1, P * G)).fill(INF);
    const from = new Int32Array(Math.max(1, P * G)).fill(-2);
    for (let c = 0; c < P; c++) {
      for (let g = 0; g < G; g++) {
        let bv = INF;
        let bf = -2;
        if (c <= MAXS && g < MAXJ) {
          const v = segCost(0, g, cands[c].a - head - skipDur(0, c - 1)) + skipCost(0, c - 1) + unassigned(0, g - 1) + assign(c, g);
          if (v < bv) {
            bv = v;
            bf = -1;
          }
        }
        for (let c2 = Math.max(0, c - 1 - MAXS); c2 < c; c2++) {
          const base = skipCost(c2 + 1, c - 1) + assign(c, g);
          const D0 = cands[c].a - cands[c2].b - skipDur(c2 + 1, c - 1);
          for (let g2 = Math.max(0, g - MAXJ); g2 < g; g2++) {
            const prev = dp[c2 * G + g2];
            if (prev >= INF) continue;
            const v = prev + base + segCost(g2 + 1, g, D0) + unassigned(g2 + 1, g - 1);
            if (v < bv) {
              bv = v;
              bf = c2 * G + g2;
            }
          }
        }
        dp[c * G + g] = bv;
        from[c * G + g] = bf;
      }
    }
    let ev = INF;
    let es = -1;
    if (P <= MAXS) ev = segCost(0, n - 1, tail - head - skipDur(0, P - 1)) + skipCost(0, P - 1) + unassigned(0, G - 1);
    for (let c = Math.max(0, P - 1 - MAXS); c < P; c++)
      for (let g = Math.max(0, G - MAXJ); g < G; g++) {
        const prev = dp[c * G + g];
        if (prev >= INF) continue;
        const v = prev + segCost(g + 1, n - 1, tail - cands[c].b - skipDur(c + 1, P - 1)) + skipCost(c + 1, P - 1) + unassigned(g + 1, G - 1);
        if (v < ev) {
          ev = v;
          es = c * G + g;
        }
      }
    pairs = [];
    for (let s = es; s >= 0; s = from[s]) pairs.unshift({ c: Math.floor(s / G), g: s % G });
    // refit the speaking rate on the chosen segmentation and run again
    let sd = 0;
    let sw = 0;
    let pc = -1;
    let pg = -1;
    let pt = head;
    for (const q of [...pairs, { c: P, g: n - 1 }]) {
      const end = q.c < P ? cands[q.c].a : tail;
      sd += end - pt - skipDur(pc + 1, q.c - 1);
      sw += Wp[q.g + 1] - Wp[pg + 1];
      pc = q.c;
      pg = q.g;
      pt = q.c < P ? cands[q.c].b : tail;
    }
    if (sw > 0) R = sd / sw;
  }

  // Place the words of each segment. Within a phrase, loudness peaks are syllables
  // and dips are word boundaries; a second DP picks the boundaries so that each word
  // holds about as many peaks as it has syllables and keeps a plausible length.
  const nf = db.length;
  const sm = new Float32Array(nf);
  for (let f = 0; f < nf; f++) {
    let e = 0;
    let k = 0;
    for (let g = Math.max(0, f - 2); g <= Math.min(nf - 1, f + 2); g++, k++) e += Math.pow(10, db[g] / 10);
    sm[f] = 10 * Math.log10(e / k + 1e-12);
  }
  const loudSorted = Array.from(sm).filter((v) => v > -60).sort((p, q) => p - q);
  const med = loudSorted[Math.floor(loudSorted.length / 2)] ?? -20;
  const PK = new Int32Array(nf + 1);
  const SL = new Int32Array(nf + 1);
  for (let f = 0; f < nf; f++) {
    let peak = sm[f] > med - 14;
    for (let g = Math.max(0, f - 6); g <= Math.min(nf - 1, f + 6) && peak; g++) if (g !== f && (sm[g] > sm[f] || (sm[g] === sm[f] && g < f))) peak = false;
    if (peak) {
      let lmin = sm[f];
      let rmin = sm[f];
      for (let g = f; g >= Math.max(0, f - 25); g--) lmin = Math.min(lmin, sm[g]);
      for (let g = f; g <= Math.min(nf - 1, f + 25); g++) rmin = Math.min(rmin, sm[g]);
      peak = sm[f] - Math.max(lmin, rmin) >= 3;
    }
    PK[f + 1] = PK[f] + (peak ? 1 : 0);
    SL[f + 1] = SL[f] + (db[f] < S.thr ? 1 : 0);
  }
  const out = words.map(() => ({ start: 0, end: 0 }));
  let pg = -1;
  let pt = head;
  for (const q of [...pairs, { c: P, g: n - 1 }]) {
    const w1 = pg + 1;
    const w2 = q.g;
    const t1 = q.c < P ? cands[q.c].a : tail;
    const f0 = Math.round(pt * 100);
    const f1 = Math.max(f0 + 1, Math.round(t1 * 100));
    const m = w2 - w1 + 1;
    const bnd = [f0];
    if (m > 1) {
      const W = Wp[w2 + 1] - Wp[w1];
      const rate = Math.max(1, f1 - f0 - (SL[f1] - SL[f0])) / W;
      const bc = (f) => (db[f] < S.thr ? -3 : Math.max(-1.5, Math.min(1, (sm[f] - med) / 10)));
      const wc = (i, a, b) => {
        const e = rate * w[i];
        const ds = Math.max(1, b - a - (SL[b] - SL[a]));
        const r = Math.log(ds / e);
        const pk = PK[b] - PK[a] - words[i].syl;
        return r * r + 0.35 * Math.min(2, pk * pk);
      };
      const INF = 1e18;
      const L = f1 - f0 + 1;
      const dp = Array.from({ length: m - 1 }, () => new Float64Array(L).fill(INF));
      const bk = Array.from({ length: m - 1 }, () => new Int32Array(L).fill(-1));
      for (let i = 0; i < m - 1; i++) {
        const e = rate * w[w1 + i];
        const lo = Math.max(2, Math.floor(e * 0.3));
        const hi = Math.ceil(e * 3) + 40;
        for (let f = f0 + 1; f < f1; f++) {
          let best = INF;
          let arg = -1;
          if (i === 0) {
            if (f - f0 >= lo && f - f0 <= hi) best = wc(w1, f0, f);
          } else {
            for (let a = Math.max(f0 + 1, f - hi); a <= f - lo; a++) {
              const pv = dp[i - 1][a - f0];
              if (pv >= INF) continue;
              const v = pv + wc(w1 + i, a, f);
              if (v < best) {
                best = v;
                arg = a;
              }
            }
          }
          if (best < INF) {
            dp[i][f - f0] = best + bc(f);
            bk[i][f - f0] = arg;
          }
        }
      }
      let best = INF;
      let arg = -1;
      for (let f = f0 + 1; f < f1; f++) {
        const pv = dp[m - 2][f - f0];
        if (pv >= INF) continue;
        const v = pv + wc(w2, f, f1);
        if (v < best) {
          best = v;
          arg = f;
        }
      }
      const inner = [];
      for (let i = m - 2, f = arg; i >= 0 && f >= 0; i--) {
        inner.unshift(f);
        f = bk[i][f - f0];
      }
      if (inner.length === m - 1) bnd.push(...inner);
      else for (let i = 1; i < m; i++) bnd.push(Math.round(f0 + ((Wp[w1 + i] - Wp[w1]) / W) * (f1 - f0)));
    }
    bnd.push(f1);
    for (let i = 0; i < m; i++) {
      out[w1 + i].start = bnd[i] / 100;
      out[w1 + i].end = bnd[i + 1] / 100;
    }
    // a boundary inside a silent stretch: the word ends where the silence starts
    for (let i = 1; i < m; i++) {
      let a = bnd[i];
      let b = bnd[i];
      while (a > bnd[i - 1] + 1 && db[a - 1] < S.thr) a--;
      while (b < bnd[i + 1] - 1 && db[b] < S.thr) b++;
      if (b - a >= 4) {
        out[w1 + i - 1].end = a / 100;
        out[w1 + i].start = b / 100;
      }
    }
    pg = q.g;
    pt = q.c < P ? cands[q.c].b : tail;
  }
  if (opt.debug) opt.debug({ pathCost, pairs, cands, R, PK, sm, med });
  return { words: out, pauses: pairs.map((q) => ({ g: q.g, a: cands[q.c].a, b: cands[q.c].b })), head, tail, rate: R };
}
