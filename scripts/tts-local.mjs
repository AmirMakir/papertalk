#!/usr/bin/env node
// Free voice on your own machine: Kokoro-82M (Apache-2.0) through kokoro-js.
// The first run downloads the model once (~90 MB, q8) from Hugging Face into the
// transformers.js cache; after that it works offline.
//
//   node scripts/tts-local.mjs <out.wav> <voice> <lines.json>
//
// Runs as its own process: onnxruntime can abort while node shuts down, so this
// process ends itself the hard way once the WAV is written, and the caller only
// checks that the file is there.
import fs from "node:fs";
import { KokoroTTS } from "kokoro-js";
import { writeWav } from "./align.mjs";

export const LOCAL_VOICES = ["af_heart", "af_bella", "am_michael", "am_fenrir", "am_puck", "bm_george", "bf_emma"];

const [out, voice = "af_heart", linesFile] = process.argv.slice(2);
if (!out || !linesFile) {
  console.error("usage: tts-local.mjs <out.wav> <voice> <lines.json>");
  process.exit(1);
}
const lines = JSON.parse(fs.readFileSync(linesFile, "utf8"));
const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "cpu" });
const sr = 24000;
const gap = new Float32Array(Math.round(0.6 * sr));
const parts = [];
for (const text of lines) {
  const a = await tts.generate(text, { voice });
  parts.push(a.audio, gap);
}
const all = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
let o = 0;
for (const p of parts) {
  all.set(p, o);
  o += p.length;
}
writeWav(out, sr, all);
process.kill(process.pid, "SIGKILL");
