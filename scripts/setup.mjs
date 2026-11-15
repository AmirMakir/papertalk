#!/usr/bin/env node
// Remembers which voice to use, in .env, so the first run asks once and later runs don't.
//
//   node scripts/setup.mjs                         show the current choice
//   node scripts/setup.mjs --voice local [name]    free voice on this machine (Kokoro): am_michael, af_heart, …
//   node scripts/setup.mjs --voice eleven [id]     ElevenLabs; the key goes into .env by hand as ELEVENLABS_API_KEY=…
//   node scripts/setup.mjs --voice files           your own WAV files from any TTS
//   node scripts/setup.mjs --sample am_michael,af_heart   write a short sample of each local voice to out/ to listen to
//
// API keys are never passed on the command line or through chat: add them to .env yourself.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const ENV = path.join(ROOT, ".env");
const args = process.argv.slice(2);
const read = () => (fs.existsSync(ENV) ? fs.readFileSync(ENV, "utf8") : "");
const get = (k) => new RegExp(`^${k}=(.*)$`, "m").exec(read())?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
const set = (k, v) => {
  let t = read();
  const line = `${k}=${v}`;
  t = new RegExp(`^${k}=.*$`, "m").test(t) ? t.replace(new RegExp(`^${k}=.*$`, "m"), line) : `${t}${t && !t.endsWith("\n") ? "\n" : ""}${line}\n`;
  fs.writeFileSync(ENV, t);
};

const i = args.indexOf("--voice");
const s = args.indexOf("--sample");
if (s >= 0) {
  const names = (args[s + 1] ?? "am_michael,af_heart").split(",");
  const text = "Here is how this voice sounds. Each run is brief, but the cycle keeps going, and that's what makes it feel always on.";
  fs.mkdirSync(path.join(ROOT, "out"), { recursive: true });
  const lines = path.join(ROOT, "out", "voice-sample.json");
  fs.writeFileSync(lines, JSON.stringify([text]));
  for (const n of names) {
    const out = path.join(ROOT, "out", `voice-sample-${n}.wav`);
    fs.rmSync(out, { force: true });
    spawnSync(process.execPath, [path.join(ROOT, "scripts/tts-local.mjs"), out, n, lines], { stdio: "ignore" });
    console.log(fs.existsSync(out) ? `out/voice-sample-${n}.wav` : `✗ ${n}: no sample (unknown voice?)`);
  }
} else if (i >= 0) {
  const mode = args[i + 1];
  const extra = args[i + 2];
  if (!["local", "eleven", "files"].includes(mode)) {
    console.error("--voice local | eleven | files");
    process.exit(1);
  }
  set("PAPERTALK_VOICE", mode);
  if (mode === "local") set("PAPERTALK_LOCAL_VOICE", extra || get("PAPERTALK_LOCAL_VOICE") || "am_michael");
  if (mode === "eleven" && extra) set("ELEVENLABS_VOICE_ID", extra);
  if (mode === "eleven" && !get("ELEVENLABS_API_KEY")) {
    if (!/^ELEVENLABS_API_KEY=/m.test(read())) set("ELEVENLABS_API_KEY", "");
    console.log("Saved. Now open .env and paste your key after ELEVENLABS_API_KEY= (the file stays on this machine; git ignores it).");
  } else console.log("Saved.");
}
const mode = get("PAPERTALK_VOICE");
console.log(
  mode === "local"
    ? `voice: free, on this machine (Kokoro, ${get("PAPERTALK_LOCAL_VOICE") || "am_michael"})`
    : mode === "eleven"
      ? `voice: ElevenLabs${get("ELEVENLABS_API_KEY") ? "" : " (key not in .env yet)"}${get("ELEVENLABS_VOICE_ID") ? `, voice ${get("ELEVENLABS_VOICE_ID")}` : ""}`
      : mode === "files"
        ? "voice: your own WAV files (node scripts/voice.mjs <name> --chunks prints the text)"
        : "voice: not chosen yet",
);
