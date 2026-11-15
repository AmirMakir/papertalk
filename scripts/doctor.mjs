#!/usr/bin/env node
// Is everything in place to make a video? Prints a checklist and what to do about each gap.
//   node scripts/doctor.mjs
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
// videos/, out/ and .env live in the working folder: the repo itself, or ~/papertalk for the plugin
const HOME = process.env.PAPERTALK_HOME || ROOT;

const rows = [];
const ok = (name, note = "") => rows.push(["✓", name, note]);
const no = (name, fix) => rows.push(["✗", name, fix]);
const meh = (name, note) => rows.push(["·", name, note]);

const major = Number(process.versions.node.split(".")[0]);
major >= 20 ? ok("Node", process.versions.node) : no("Node", `${process.versions.node} is too old: install Node 20 or newer`);

const has = (p) => fs.existsSync(path.join(ROOT, "node_modules", p));
has("remotion") && has("@remotion/cli") ? ok("Packages") : no("Packages", "run npm install (or pnpm install)");

const rem = path.join(ROOT, "node_modules/.bin/remotion");
if (fs.existsSync(rem)) {
  const r = spawnSync(rem, ["browser", "ensure"], { cwd: ROOT, encoding: "utf8", timeout: 300000 });
  r.status === 0 ? ok("Render browser", "Remotion's headless Chrome is ready") : no("Render browser", "npx remotion browser ensure (downloads Remotion's headless Chrome)");
}

const sfx = path.join(ROOT, "assets/sfx/pop.wav");
if (!fs.existsSync(sfx)) spawnSync(process.execPath, [path.join(ROOT, "scripts/sfx.mjs")], { stdio: "ignore" });
fs.existsSync(sfx) ? ok("Sound effects", "generated in assets/sfx") : no("Sound effects", "node scripts/sfx.mjs");

const env = {};
const ef = path.join(HOME, ".env");
if (fs.existsSync(ef)) for (const m of fs.readFileSync(ef, "utf8").matchAll(/^([A-Z0-9_]+)=(.*)$/gm)) env[m[1]] = m[2].trim();
const eleven = process.env.ELEVENLABS_API_KEY || env.ELEVENLABS_API_KEY;
const mode = process.env.PAPERTALK_VOICE || env.PAPERTALK_VOICE;
if (!mode) meh("Voice", "not chosen yet: ask the person (free local voice, ElevenLabs, or own files), then setup --voice local am_michael (or eleven, files)");
else if (mode === "local") has("kokoro-js") ? ok("Voice", `free, on this machine (Kokoro ${env.PAPERTALK_LOCAL_VOICE || "am_michael"}); the model (~90 MB) downloads on first use`) : no("Voice", "npm install (kokoro-js is missing)");
else if (mode === "eleven") eleven ? ok("Voice", "ElevenLabs, key found") : no("Voice", "ElevenLabs chosen but no key: paste it into .env after ELEVENLABS_API_KEY=");
else ok("Voice", "your own WAV files");

const pdf = spawnSync("pdftotext", ["-v"], { encoding: "utf8" });
pdf.error ? meh("PDF files", "optional: install poppler (brew install poppler) to ingest local PDFs") : ok("PDF files", "pdftotext found");

const w = Math.max(...rows.map((r) => r[1].length));
for (const [m, n, note] of rows) console.log(`${m} ${n.padEnd(w)}  ${note}`);
const bad = rows.filter((r) => r[0] === "✗").length;
console.log(bad ? `\n${bad} thing(s) to fix before making a video.` : "\nReady. In Claude Code: /papertalk:explain <link or file>");
process.exit(bad ? 1 : 0);
