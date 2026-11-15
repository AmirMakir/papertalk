#!/usr/bin/env node
// One entry point for every step. The plugin's skill and MCP server call this; a clone can too.
//
//   node scripts/papertalk.mjs [--data DIR] [--home DIR] [--voice MODE] [--local-voice NAME] <command> [args…]
//
//   init               remember the folders and voice for this machine, install the engine, check the setup
//   doctor             check the setup
//   where              print where the engine, the videos and the data are
//   ingest <name> <link or file> [--kind paper|essay|post]
//   voice <name> [--local NAME | --eleven | --chunks | take.wav …]
//   setup [--voice local NAME | eleven | files]     sample [am_michael,af_heart]
//   check <name>       render <name>       still <name> <seconds>
//
// Installed as a plugin, the code sits in a versioned cache folder that changes on every
// update, so the engine (this code plus its packages, about 1 GB) is installed once into the
// plugin's data folder and refreshed only when the code changes.
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { resolve, writeConfig, ROOT } from "./paths.mjs";

const argv = process.argv.slice(2);
const flags = {};
while (argv[0]?.startsWith("--")) {
  const k = argv.shift().slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase());
  flags[k] = argv.shift();
}
const [cmd = "doctor", ...args] = argv;
const p = resolve(flags);

if (cmd === "where") {
  console.log(JSON.stringify(p, null, 2));
  process.exit(0);
}
if (cmd === "init" && !p.clone) writeConfig({ data: p.data, home: p.home, voice: p.voice, localVoice: p.localVoice });

// ── the engine ──
const COPY = ["src", "scripts", "mcp", "package.json", "remotion.config.ts", "tsconfig.json"];
function hashOf(base, list) {
  const h = crypto.createHash("sha1");
  const walk = (rel) => {
    const abs = path.join(base, rel);
    if (!fs.existsSync(abs)) return;
    if (fs.statSync(abs).isDirectory()) for (const f of fs.readdirSync(abs).sort()) walk(path.join(rel, f));
    else h.update(rel).update(fs.readFileSync(abs));
  };
  list.forEach(walk);
  return h.digest("hex");
}
const readText = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "");

if (!p.clone) {
  const eng = p.engine;
  fs.mkdirSync(eng, { recursive: true });
  const code = hashOf(ROOT, COPY);
  if (readText(path.join(eng, ".code")) !== code) {
    for (const f of COPY) {
      fs.rmSync(path.join(eng, f), { recursive: true, force: true });
      fs.cpSync(path.join(ROOT, f), path.join(eng, f), { recursive: true });
    }
    fs.copyFileSync(path.join(ROOT, "scripts", "npm-lock.json"), path.join(eng, "package-lock.json"));
  }
  const deps = hashOf(eng, ["package.json", "package-lock.json"]);
  if (readText(path.join(eng, ".deps")) !== deps || !fs.existsSync(path.join(eng, "node_modules", "remotion"))) {
    console.error("Installing the papertalk engine, once: Remotion and the local voice, about 1 GB, 1–3 minutes…");
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    // a dropped connection is common on a 1 GB download: npm retries each fetch, and the whole install runs up to three times
    let r;
    for (let k = 0; k < 3; k++) {
      if (k) console.error(`Retrying the install (${k + 1}/3)…`);
      r = spawnSync(npm, ["ci", "--omit=dev", "--no-audit", "--no-fund", "--loglevel=error", "--fetch-retries=5", "--fetch-retry-mintimeout=5000"], { cwd: eng, stdio: ["ignore", "inherit", "inherit"], shell: process.platform === "win32" });
      if (!r.error && !r.status) break;
    }
    if (r.error || r.status) {
      console.error(`✗ installing the engine failed${r.error ? `: ${r.error.message} (is npm installed?)` : ""}. Run the same command again to retry.`);
      process.exit(1);
    }
    fs.writeFileSync(path.join(eng, ".deps"), deps);
  }
  fs.writeFileSync(path.join(eng, ".code"), code);
}

// ── the step ──
const STEPS = {
  init: ["doctor.mjs"],
  doctor: ["doctor.mjs"],
  ingest: ["ingest.mjs"],
  voice: ["voice.mjs"],
  setup: ["setup.mjs"],
  sample: ["setup.mjs", "--sample"],
  check: ["make.mjs", "@1", "check"],
  render: ["make.mjs", "@1", "render"],
  still: ["make.mjs", "@1", "still", "@2"],
};
const step = STEPS[cmd];
if (!step) {
  console.error(`unknown command "${cmd}". Commands: ${[...Object.keys(STEPS), "where"].join(", ")}`);
  process.exit(1);
}
const [script, ...pre] = step;
const fill = pre.map((a) => (a.startsWith("@") ? args[Number(a.slice(1)) - 1] : a));
const rest = pre.some((a) => a.startsWith("@")) ? args.slice(Math.max(...pre.filter((a) => a.startsWith("@")).map((a) => Number(a.slice(1))))) : args;
const env = { ...process.env, PAPERTALK_HOME: p.home };
if (p.voice) env.PAPERTALK_VOICE = p.voice;
if (p.localVoice) env.PAPERTALK_LOCAL_VOICE = p.localVoice;
fs.mkdirSync(p.home, { recursive: true });
const r = spawnSync(process.execPath, [path.join(p.engine, "scripts", script), ...fill, ...rest], { stdio: "inherit", env, cwd: p.home });
process.exit(r.status ?? 1);
