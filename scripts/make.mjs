#!/usr/bin/env node
// Storyboard → video.
//   node scripts/make.mjs <slug> check        resolve cues, render key moments small,
//                                                     report overlaps and cut-off text, write contact sheets
//   node scripts/make.mjs <slug> render       the full video → out/<slug>.mp4
//   node scripts/make.mjs <slug> still <sec>  one frame → out/<slug>-<sec>.png
// Cues: "9" line start, "9$" line end, "9:key" first "key" in line 9, "9:key#2" the
// second one, "B4" block 4 start, any of them with an offset: "9:key+0.3", "9$-0.2".
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const [slug, cmd = "check", arg] = process.argv.slice(2);
const DIR = path.join(ROOT, "videos", slug);
const tm = JSON.parse(fs.readFileSync(path.join(DIR, "timing.json"), "utf8"));
const sb0 = JSON.parse(fs.readFileSync(path.join(DIR, "storyboard.json"), "utf8").replace(/^\s*\/\/.*$/gm, ""));
// an svg element may point at a file next to the storyboard; inline it
for (const el of sb0.els ?? []) if (el.t === "svg" && el.src && !el.markup) el.markup = fs.readFileSync(path.join(DIR, el.src), "utf8");
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const errors = [];
const r2 = (v) => Math.round(v * 100) / 100;

function cue(v, where) {
  if (v == null || typeof v === "number") return v;
  let s = String(v).trim();
  let off = 0;
  const mo = /([+-](?:\d+\.?\d*|\.\d+))$/.exec(s);
  if (mo && mo.index > 0) {
    off = parseFloat(mo[1]);
    s = s.slice(0, mo.index);
  }
  const fail = (m) => (errors.push(`${where}: ${m}`), 0);
  let t;
  const mb = /^[Bb](\d+)$/.exec(s);
  if (mb) {
    const b = tm.blocks.find((x) => x.id === +mb[1]);
    if (!b) return fail(`no block ${mb[1]}`);
    t = b.start;
  } else {
    const end = s.endsWith("$");
    if (end) s = s.slice(0, -1);
    const i = s.indexOf(":");
    const ln = i < 0 ? s : s.slice(0, i);
    const wspec = i < 0 ? "" : s.slice(i + 1);
    const L = tm.lines.find((l) => l.line === +ln);
    if (!L) return fail(`no line "${ln}"`);
    if (!wspec) t = end ? L.end : L.start;
    else {
      const [w, occ] = wspec.split("#");
      const hits = tm.words.filter((x) => x.line === L.line && norm(x.text) === norm(w));
      const h = hits[(+occ || 1) - 1];
      if (!h) return fail(`no "${w}"${occ ? `#${occ}` : ""} in line ${ln}: ${L.text}`);
      t = end ? h.end : h.start;
    }
  }
  return r2(t + off);
}

// word indices may be given as the word itself: "w": "it"
const rowToks = sb0.row ? sb0.row.text.split(" ") : [];
const widx = (v, where) => {
  if (typeof v !== "string" || v === "all") return v;
  const [w, occ] = v.split("#");
  const hits = rowToks.map((x, i) => [norm(x), i]).filter(([x]) => x === norm(w));
  if (!hits[(+occ || 1) - 1]) {
    errors.push(`${where}: no word "${v}" in the row`);
    return 0;
  }
  return hits[(+occ || 1) - 1][1];
};
const WKEYS = new Set(["w", "a", "b", "from", "under"]);
const WARR = new Set(["to", "words", "except", "keep"]);
const isCue = (k) => k === "in" || k === "out" || /(In|Out|At)$/.test(k) || ["gin", "nin", "lin"].includes(k);
function walk(o, where, plain = false) {
  if (Array.isArray(o)) return o.map((x, i) => walk(x, `${where}[${i}]`, plain));
  if (!o || typeof o !== "object") return o;
  const r = {};
  for (const [k, v] of Object.entries(o)) {
    const at = `${where}.${k}`;
    if (isCue(k)) r[k] = Array.isArray(v) ? v.map((x, i) => cue(x, `${at}[${i}]`)) : cue(v, at);
    else if (k === "ins") r[k] = v.map((x, i) => cue(x, `${at}[${i}]`));
    else if (k === "show") r[k] = v.map(([a, b], i) => [cue(a, `${at}[${i}]`), b == null ? null : cue(b, `${at}[${i}]`)]);
    else if (WKEYS.has(k) && !plain) r[k] = widx(v, at);
    else if (k === "over") r[k] = Array.isArray(v) ? v.map((x) => widx(x, at)) : widx(v, at);
    else if (WARR.has(k) && Array.isArray(v)) r[k] = v.map((x) => widx(x, at));
    else r[k] = walk(v, at, plain || k === "edges" || k === "nodes");
  }
  return r;
}

const sb = { paper: sb0.paper, row: null, tags: [], els: [], nocaps: [] };
sb.tags = (sb0.tags ?? []).map(([c, text], i) => [cue(c, `tags[${i}]`), text]);
sb.nocaps = (sb0.nocaps ?? []).map(([a, b], i) => [cue(a, `nocaps[${i}]`), b == null ? null : cue(b, `nocaps[${i}]`)]);
if (sb0.row) {
  sb.row = walk(sb0.row, "row");
  if (sb0.row.line != null) {
    const ws = tm.words.filter((w) => w.line === sb0.row.line);
    let j = 0;
    sb.row.words = rowToks.map((tok) => {
      const k = ws.findIndex((w, i) => i >= j && norm(w.text) === norm(tok));
      if (k < 0) return sb.row.in ?? ws[0]?.start ?? 0;
      j = k + 1;
      return ws[k].start;
    });
    sb.row.in ??= sb.row.words[0];
  }
}
sb.els = (sb0.els ?? []).map((e, i) => {
  const el = walk(e, `els[${i}] ${e.t}`);
  if (el.in == null) {
    const subs = [...(el.items ?? []), ...(el.parts ?? []), ...(el.steps ?? []), ...(el.nodes ?? [])].map((x) => x.in).filter((x) => x != null);
    el.in = subs.length ? Math.min(...subs) : el.ins?.[0];
    if (el.in == null) errors.push(`els[${i}] ${e.t}: no "in"`);
  }
  return el;
});
if (errors.length) {
  console.log(`✗ ${errors.length} cue problem(s):\n  ${errors.join("\n  ")}`);
  process.exit(1);
}

// sounds, from the element types
const SND = { mark: "pop", arcs: "whoosh", tokens: "pop", label: "pop", title: "whoosh", bars: "whoosh", table: "pop", cards: "whoosh", end: "pop", boxes: "tick", swap: "whoosh", replace: "whoosh", strike: "slap" };
const VOL = { pop: 0.12, whoosh: 0.12, tick: 0.1, ding: 0.12, buzz: 0.06, slap: 0.12, click: 0.16, thud: 0.3 };
const snd = [];
const add = (name, at) => name && at != null && snd.push([name, r2(at), VOL[name] ?? 0.1]);
for (const el of sb.els) {
  if (el.sfx === false) continue;
  add(typeof el.sfx === "string" ? el.sfx : SND[el.t], el.in);
  for (const it of el.items ?? []) if (it.in != null && it.in !== el.in) add(el.t === "grid" || el.t === "stack" || el.t === "bars" ? "tick" : "pop", it.in);
  for (const it of el.items ?? []) if (it.hlIn != null) add("ding", it.hlIn);
  for (const pt of el.parts ?? []) if (pt.in !== el.in) add("tick", pt.in);
  for (const st of (el.steps ?? []).slice(1)) add("tick", st.in);
  for (const n of el.nodes ?? []) if (n.in != null && n.in !== el.in) add("pop", n.in);
  for (const e of el.edges ?? []) add("whoosh", e.in);
  if (el.warn) add("buzz", el.warn.in);
  if (el.crossIn != null) add("buzz", el.crossIn);
  if (el.t === "title" && el.hl) add("ding", el.hlIn ?? (el.ins ? el.ins[el.ins.length - 1] + 0.1 : null));
  if (el.t === "svg") {
    for (const s of el.steps ?? []) add(s.how === "draw" || !s.how ? "whoosh" : "pop", s.in);
    for (const f of el.flows ?? []) add("tick", f.in);
  }
  if (el.t === "tower") {
    for (const a of el.ins ?? []) add("whoosh", a);
    for (const w of el.reflows ?? []) add("whoosh", w.in);
    (el.answer ?? []).forEach((s, i) => s.text && add(i ? "ding" : "pop", s.in));
    if (el.band) add("pop", el.band.in);
    if (el.off) add("buzz", el.off.in);
    if (el.growIn != null) add("whoosh", el.growIn);
    for (const b of el.bubbles ?? []) add("pop", b.in);
    (el.lens?.stops ?? []).forEach((s, i, arr) => {
      const p = arr[i - 1];
      if (s.hide) return;
      if (!p || p.hide) add("pop", s.in);
      else if (p.layer !== s.layer) add("whoosh", s.in);
      else if (p.text !== s.text) add(s.text ? "pop" : "slap", s.in);
    });
  }
}
snd.sort((a, b) => a[1] - b[1]);
const sfx = [];
for (const s of snd) if (!sfx.length || s[1] - sfx[sfx.length - 1][1] >= 0.12) sfx.push(s);

const props = { sb, caps: tm.caps, duration: tm.duration, audio: "voice.wav", sfx, theme: sb0.theme ?? "paper", captions: sb0.captions ?? true };
const shared = path.join(DIR, "_shared/sfx");
// sound effects are generated, not downloaded: scripts/sfx.mjs → assets/sfx, copied next to the voice
if (!fs.existsSync(shared)) {
  if (!fs.existsSync(path.join(ROOT, "assets/sfx/pop.wav"))) spawnSync(process.execPath, [path.join(ROOT, "scripts/sfx.mjs")], { stdio: "ignore" });
  fs.cpSync(path.join(ROOT, "assets/sfx"), shared, { recursive: true });
}
const env = { ...process.env };
const REM = path.join(ROOT, "node_modules/.bin/remotion");
const run = (args) => spawnSync(REM, args, { cwd: ROOT, env, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const t0 = Date.now();

if (cmd === "render") {
  fs.writeFileSync(path.join(DIR, "props.json"), JSON.stringify(props));
  const out = path.join(ROOT, "out", `${slug}.mp4`);
  const r = run(["render", "src/index.ts", "PaperTalk", out, `--props=${path.join(DIR, "props.json")}`, `--public-dir=${DIR}`, "--log=error"]);
  if (r.status) {
    console.log((r.stdout + r.stderr).slice(-2000));
    process.exit(1);
  }
  console.log(`out/${slug}.mp4 · ${Math.round((Date.now() - t0) / 1000)} s`);
} else if (cmd === "still") {
  fs.writeFileSync(path.join(DIR, "props.json"), JSON.stringify(props));
  const out = path.join(ROOT, "out", `${slug}-${arg}.png`);
  const r = run(["still", "src/index.ts", "PaperTalk", out, `--props=${path.join(DIR, "props.json")}`, `--public-dir=${DIR}`, `--frame=${Math.round(+arg * 30)}`, "--scale=0.5", "--log=error"]);
  console.log(r.status ? (r.stdout + r.stderr).slice(-1500) : out);
} else {
  // check: the moments right after each thing appears
  const ts = [];
  const push = (v) => v != null && ts.push(v + 0.65);
  // every time anything starts, wherever it sits in the element
  const collect = (o) => {
    if (Array.isArray(o)) return o.forEach(collect);
    if (!o || typeof o !== "object") return;
    for (const [k, v] of Object.entries(o)) {
      if (k === "in" && typeof v === "number") push(v);
      else if (k === "ins" && Array.isArray(v)) v.forEach((x) => typeof x === "number" && push(x));
      else collect(v);
    }
  };
  sb.els.forEach(collect);
  const times = [];
  for (const v of ts.filter((v) => v < tm.duration - 0.05).sort((a, b) => a - b)) {
    if (times.length && v - times[times.length - 1] < 0.45) times[times.length - 1] = r2(v);
    else times.push(r2(v));
  }
  fs.writeFileSync(path.join(DIR, "props-check.json"), JSON.stringify({ ...props, check: times }));
  const dir = path.join(ROOT, "out", `${slug}-check`);
  fs.rmSync(dir, { recursive: true, force: true });
  const r = run(["render", "src/index.ts", "PaperTalk", dir, "--sequence", "--image-format=jpeg", "--scale=0.25", `--props=${path.join(DIR, "props-check.json")}`, `--public-dir=${DIR}`, "--log=verbose"]);
  const logs = (r.stdout + r.stderr).split("\n").filter((l) => l.includes("PRIMERCHECK "));
  if (r.status) {
    console.log((r.stdout + r.stderr).split("\n").filter((l) => /error/i.test(l)).slice(-15).join("\n"));
    process.exit(1);
  }
  const issues = new Map();
  for (const l of logs) {
    try {
      const j = JSON.parse(l.slice(l.indexOf("PRIMERCHECK ") + 12).trim());
      for (const s of j.issues) issues.set(s, [...(issues.get(s) ?? []), j.t]);
    } catch {
      /* a log line split by the logger */
    }
  }
  // contact sheets, 16 frames to a sheet, drawn by Remotion itself (no other tools needed)
  const frames = fs.readdirSync(dir).filter((f) => /^element-\d+\.jpe?g$/.test(f)).sort();
  for (const f of fs.readdirSync(path.join(ROOT, "out")).filter((f) => f.startsWith(`${slug}-check-`) && f.endsWith(".png"))) fs.rmSync(path.join(ROOT, "out", f));
  const sheets = [];
  for (let s = 0; s * 16 < frames.length; s++) {
    const pf = path.join(dir, `sheet-${s + 1}.json`);
    fs.writeFileSync(pf, JSON.stringify({ frames: frames.slice(s * 16, s * 16 + 16) }));
    const png = path.join(ROOT, "out", `${slug}-check-${s + 1}.png`);
    const r2 = run(["still", "src/index.ts", "Sheet", png, `--props=${pf}`, `--public-dir=${dir}`, "--log=error"]);
    if (r2.status) console.log(`! sheet ${s + 1}: ${(r2.stdout + r2.stderr).trim().slice(-300)}`);
    else sheets.push(path.relative(ROOT, png));
  }
  console.log(`check: ${times.length} moments · ${logs.length} probed · ${Math.round((Date.now() - t0) / 1000)} s`);
  if (!logs.length) console.log("! no probe output: the logger did not pass browser logs");
  console.log(issues.size ? `${issues.size} issue(s):\n  ${[...issues].map(([s, at]) => `${s}  @ ${at.slice(0, 4).join(", ")}${at.length > 4 ? " …" : ""}`).join("\n  ")}` : "no overlaps, nothing cut off");
  console.log(`sheets: ${sheets.join(", ")}`);
}
