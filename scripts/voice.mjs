#!/usr/bin/env node
// Narration for a papertalk video: takes → one voice track with word timings.
//
//   node scripts/voice.mjs <slug>                   the voice chosen at setup (PAPERTALK_VOICE in .env: local | eleven | files);
//                                                   if none: ElevenLabs when a key is set, else the free local voice
//   node scripts/voice.mjs <slug> --local [voice]   free voice on this machine (Kokoro, Apache-2.0); voices: af_heart,
//                                                   am_michael, am_fenrir, bm_george… (scripts/tts-local.mjs)
//   node scripts/voice.mjs <slug> --eleven          ElevenLabs (ELEVENLABS_API_KEY in .env), exact timings
//   node scripts/voice.mjs <slug> <take> [take …]   your own takes in script order: WAV files from any TTS
//   node scripts/voice.mjs <slug> --chunks          the text to send per take, for any other TTS
//
// Reads videos/<slug>/script.txt, writes videos/<slug>/voice.wav and timing.json.
import fs from "node:fs";
import path from "node:path";
import { align, readWav, writeWav } from "./align.mjs";
import { parseScript } from "./script.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
// videos/, out/ and .env live in the working folder: the repo itself, or ~/papertalk for the plugin
const HOME = process.env.PAPERTALK_HOME || ROOT;

const [slug, ...rest] = process.argv.slice(2);
if (!slug) {
  console.error("usage: voice.mjs <slug> <take…> | --eleven | --chunks");
  process.exit(1);
}
const DIR = path.join(HOME, "videos", slug);
const sc = parseScript(fs.readFileSync(path.join(DIR, "script.txt"), "utf8"));
const MAX_CHARS = 2400;

// Takes are cut at block boundaries, at most MAX_CHARS each.
const chunks = [];
for (const b of sc.blocks) {
  const text = sc.lines.filter((l) => l.block === b.id).map((l) => l.spoken).join("\n\n");
  const last = chunks[chunks.length - 1];
  if (last && last.length + text.length + 2 <= MAX_CHARS) chunks[chunks.length - 1] = `${last}\n\n${text}`;
  else chunks.push(text);
}
if (rest[0] === "--chunks") {
  fs.mkdirSync(path.join(DIR, "vo"), { recursive: true });
  chunks.forEach((c, i) => fs.writeFileSync(path.join(DIR, `vo/chunk-${i + 1}.txt`), c));
  console.log(`${chunks.length} take(s): ${chunks.map((c, i) => `vo/chunk-${i + 1}.txt (${c.length} chars)`).join(", ")}`);
  process.exit(0);
}

const env = {};
for (const f of [path.join(HOME, ".env")])
  if (fs.existsSync(f)) for (const m of fs.readFileSync(f, "utf8").matchAll(/^([A-Z0-9_]+)=(.*)$/gm)) env[m[1]] ??= m[2].trim().replace(/^["']|["']$/g, "");

let sr = 24000;
let audio;
let times;
if (!rest.length) {
  const mode = process.env.PAPERTALK_VOICE || env.PAPERTALK_VOICE || (process.env.ELEVENLABS_API_KEY || env.ELEVENLABS_API_KEY ? "eleven" : "local");
  if (mode === "files") throw new Error("voice is set to your own files: run with --chunks for the text, then pass the WAV files in order");
  rest.push(mode === "eleven" ? "--eleven" : "--local");
}
if (rest[0] === "--local") {
  // one line at a time, joined with short silences; the aligner then times every word
  const voice = rest[1] || process.env.PAPERTALK_LOCAL_VOICE || env.PAPERTALK_LOCAL_VOICE || "am_michael";
  const t0 = Date.now();
  console.log(`local voice ${voice}: ${sc.lines.length} lines (the first run downloads the model, ~90 MB)…`);
  fs.mkdirSync(path.join(DIR, "vo"), { recursive: true });
  const file = path.join(DIR, "vo", `local-${voice}.wav`);
  const linesFile = path.join(DIR, "vo", "local-lines.json");
  fs.writeFileSync(linesFile, JSON.stringify(sc.lines.map((l) => l.spoken)));
  fs.rmSync(file, { force: true });
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts/tts-local.mjs"), file, voice, linesFile], { stdio: ["ignore", "ignore", "pipe"], encoding: "utf8" });
  if (!fs.existsSync(file)) throw new Error(`local voice failed: ${(r.stderr ?? "").split("\n").filter((l) => /error/i.test(l)).slice(-3).join(" ") || "no output"}`);
  console.log(`${path.relative(HOME, file)} · ${Math.round((Date.now() - t0) / 1000)} s`);
  rest.splice(0, rest.length, file);
}
if (rest[0] === "--eleven") {
  const key = process.env.ELEVENLABS_API_KEY || env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set: add it to .env, or run node scripts/setup.mjs --voice local for the free voice");
  const voice = process.env.ELEVENLABS_VOICE_ID || env.ELEVENLABS_VOICE_ID || "1SM7GgM6IMuvQlz2BwM3";
  const model = process.env.PAPERTALK_MODEL || env.PAPERTALK_MODEL || "eleven_v3";
  const parts = [];
  times = [];
  let wi = 0;
  let offset = 0;
  for (const text of chunks) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=pcm_24000`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({ text, model_id: model }),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const j = await res.json();
    const pcm = Buffer.from(j.audio_base64, "base64");
    const x = new Float32Array(pcm.length / 2);
    for (let i = 0; i < x.length; i++) x[i] = pcm.readInt16LE(i * 2) / 32768;
    const al = j.normalized_alignment || j.alignment;
    // map each spoken word of this chunk to its characters
    let pos = 0;
    while (wi < sc.words.length && pos < text.length) {
      const tok = sc.words[wi].tok;
      const at = text.indexOf(tok, pos);
      if (at < 0) break;
      const a = al.character_start_times_seconds[at];
      const b = al.character_end_times_seconds[Math.min(at + tok.length - 1, al.character_end_times_seconds.length - 1)];
      times.push({ start: offset + a, end: offset + b });
      pos = at + tok.length;
      wi++;
    }
    parts.push(x, new Float32Array(sr));
    offset += x.length / sr + 1;
  }
  audio = concat(parts);
  if (times.length !== sc.words.length) throw new Error(`aligned ${times.length} of ${sc.words.length} words`);
} else {
  if (!rest.length) throw new Error("give the takes in script order");
  const parts = [];
  for (const f of rest) {
    const buf = fs.readFileSync(f);
    let wav = buf;
    if (buf.toString("ascii", 0, 4) !== "RIFF") {
      const arr = JSON.parse(buf.toString("utf8"));
      const el = (Array.isArray(arr) ? arr : [arr]).map((e) => (typeof e.text === "string" ? safeJson(e.text) : e)).find((e) => e && e.audio_base64);
      if (!el) throw new Error(`${f}: no audio_base64 inside`);
      wav = Buffer.from(el.audio_base64, "base64");
    }
    const w = readWav(wav);
    sr = w.sr;
    parts.push(w.x, new Float32Array(sr));
  }
  audio = concat(parts);
  const a = align(audio, sr, sc.words);
  times = a.words;
}

// Rebuild the track: keep the speech, set the pauses by punctuation.
const LIMITS = { 0: [0, 0.35], 2: [0.12, 0.45], 3: [0.28, 0.6], 4: [0.35, 0.7], 5: [0.6, 1.0] };
const pieces = [];
const map = [];
let out = 0.15;
let from = Math.max(0, times[0].start - 0.03);
for (let i = 0; i < sc.words.length; i++) {
  const w = sc.words[i];
  const last = i === sc.words.length - 1;
  const gap = last ? 0 : times[i + 1].start - times[i].end;
  const [lo, hi] = LIMITS[w.brk] ?? LIMITS[0];
  const adjust = last || (gap >= 0.06 && (gap < lo || gap > hi));
  if (!adjust) continue;
  const to = Math.min(audio.length / sr, times[i].end + 0.03);
  map.push({ a: from, b: to, o: out });
  pieces.push(fade(audio.subarray(Math.round(from * sr), Math.round(to * sr)), sr));
  out += to - from;
  const target = last ? 1.6 : Math.min(hi, Math.max(lo, gap)) - 0.06;
  pieces.push(new Float32Array(Math.max(0, Math.round(target * sr))));
  out += Math.max(0, target);
  if (!last) from = Math.max(to, times[i + 1].start - 0.03);
}
let track = concat([new Float32Array(Math.round(0.15 * sr)), ...pieces]);
const remap = (t) => {
  const m = map.find((s) => t >= s.a - 1e-6 && t <= s.b + 1e-6) ?? map.reduce((best, s) => (Math.abs(s.a - t) < Math.abs(best.a - t) ? s : best));
  return m.o + (t - m.a);
};

// Loudness: speech at about −16 dBFS, soft-knee limiter above 0.7.
{
  const win = Math.round(sr * 0.4);
  let acc = 0;
  let cnt = 0;
  for (let i = 0; i + win <= track.length; i += win) {
    let e = 0;
    for (let k = i; k < i + win; k++) e += track[k] * track[k];
    const r = Math.sqrt(e / win);
    if (r > 0.01) {
      acc += r * r;
      cnt++;
    }
  }
  const g = Math.pow(10, -16 / 20) / Math.sqrt(acc / Math.max(1, cnt));
  const knee = 0.7;
  for (let i = 0; i < track.length; i++) {
    let y = track[i] * g;
    const m = Math.abs(y);
    if (m > knee) y = Math.sign(y) * (knee + (1 - knee) * Math.tanh((m - knee) / (1 - knee)));
    track[i] = y * 0.95;
  }
}
writeWav(path.join(DIR, "voice.wav"), sr, track);

// Timings in the new track, by display word.
const words = [];
let wi = 0;
for (const l of sc.lines)
  for (const g of l.groups) {
    const a = remap(times[wi].start);
    const b = remap(times[wi + g.spk.length - 1].end);
    g.disp.forEach((d, k) => words.push({ text: d, start: r2(a + ((b - a) * k) / g.disp.length), end: r2(a + ((b - a) * (k + 1)) / g.disp.length), line: l.n }));
    wi += g.spk.length;
  }
const lines = sc.lines.map((l) => {
  const ws = words.filter((w) => w.line === l.n);
  return { line: l.n, block: l.block, start: ws[0].start, end: ws[ws.length - 1].end, text: l.display };
});
const blocks = sc.blocks.map((b) => ({ id: b.id, title: b.title, start: lines[b.first - 1].start }));
const duration = r2(track.length / sr);
fs.writeFileSync(path.join(DIR, "timing.json"), JSON.stringify({ words, lines, blocks, caps: captions(words, lines), duration }));

// Lines spoken much faster or slower than the rest: the voice may have skipped or
// repeated words there, worth a listen.
const rates = lines.map((l) => {
  const syl = sc.words.filter((w) => w.line === l.line).reduce((a, w) => a + w.syl, 0);
  return syl / Math.max(0.2, l.end - l.start);
});
const med = [...rates].sort((a, b) => a - b)[Math.floor(rates.length / 2)];
const odd = lines.filter((l, i) => rates[i] > med * 1.45 || rates[i] < med / 1.45).map((l) => l.line);
const mm = Math.floor(duration / 60);
console.log(`voice.wav ${mm}:${String(Math.round(duration - mm * 60)).padStart(2, "0")} · ${lines.length} lines · ${blocks.length} blocks · timings ${rest[0] === "--eleven" ? "exact (ElevenLabs)" : "local aligner"}${odd.length ? ` · listen to lines ${odd.join(", ")} (odd pace)` : ""}`);

function concat(arrs) {
  const n = arrs.reduce((a, x) => a + x.length, 0);
  const o = new Float32Array(n);
  let p = 0;
  for (const x of arrs) {
    o.set(x, p);
    p += x.length;
  }
  return o;
}
function fade(x, rate) {
  const y = Float32Array.from(x);
  const k = Math.min(Math.round(rate * 0.008), Math.floor(y.length / 2));
  for (let i = 0; i < k; i++) {
    y[i] *= i / k;
    y[y.length - 1 - i] *= i / k;
  }
  return y;
}
function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
function r2(v) {
  return Math.round(v * 100) / 100;
}

// One calm caption line at a time: clauses end at punctuation, short clauses join the
// next one, long ones split into near-equal parts that don't end on a small word.
function captions(ws, ls) {
  const SHORT = new Set(["a", "an", "the", "in", "of", "to", "and", "at", "with", "by", "for", "on", "its", "their", "that", "is", "as", "so", "but", "or", "from"]);
  const LIMIT = 56;
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const txt = (a) => a.map((x) => x.text).join(" ");
  const split = (seq) => {
    if (txt(seq).length <= LIMIT) return [seq];
    const n = Math.ceil(txt(seq).length / LIMIT);
    const outp = [];
    let restSeq = seq;
    for (let part = n; part > 1; part--) {
      const target = txt(restSeq).length / part;
      let best = null;
      for (let k = 1; k < restSeq.length; k++) {
        const s = Math.abs(txt(restSeq.slice(0, k)).length - target) + (SHORT.has(norm(restSeq[k - 1].text)) ? 14 : 0);
        if (!best || s < best[0]) best = [s, k];
      }
      outp.push(restSeq.slice(0, best[1]));
      restSeq = restSeq.slice(best[1]);
    }
    return [...outp, restSeq];
  };
  const caps = [];
  for (const l of ls) {
    const clauses = [];
    let cur = [];
    for (const w of ws.filter((x) => x.line === l.line)) {
      cur.push(w);
      if (/[.,:?!]["”]?$/.test(w.text)) {
        clauses.push(cur);
        cur = [];
      }
    }
    if (cur.length) clauses.push(cur);
    const merged = [];
    for (const c of clauses) {
      const prev = merged[merged.length - 1];
      if (prev && /[,:]["”]?$/.test(prev[prev.length - 1].text) && txt([...prev, ...c]).length <= LIMIT) merged[merged.length - 1] = [...prev, ...c];
      else merged.push(c);
    }
    for (const c of merged) for (const p of split(c)) caps.push({ text: txt(p), start: p[0].start, end: p[p.length - 1].end, line: l.line });
  }
  for (let k = 0; k + 1 < caps.length; ) {
    const x = caps[k];
    const y = caps[k + 1];
    if (x.line === y.line && x.text.length < 12 && x.text.endsWith(",") && (x.text + " " + y.text).length <= LIMIT) caps.splice(k, 2, { text: `${x.text} ${y.text}`, start: x.start, end: y.end, line: x.line });
    else k++;
  }
  return caps;
}

