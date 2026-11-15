// Where things are. No dependencies: the MCP server and the launcher use it before
// the engine's packages exist.
//
//   root    this copy of papertalk (a clone, or the plugin's versioned cache folder)
//   engine  the copy that has node_modules: root itself for a clone, else <data>/engine
//   home    videos/, out/ and .env: the clone itself, or ~/papertalk (or the folder the person chose)
//   data    the plugin's persistent folder (${CLAUDE_PLUGIN_DATA}), kept across updates
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const CONFIG = path.join(os.homedir(), ".papertalk", "config.json");

// a value Claude Code didn't fill in arrives empty or as the literal "${…}"
export const given = (v) => (typeof v === "string" && v.trim() && !v.includes("${") ? v.trim() : undefined);
const expand = (p) => (p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p);

// the plugin's settings say free / elevenlabs / own-files; the scripts say local / eleven / files
const VOICE = { free: "local", local: "local", elevenlabs: "eleven", eleven: "eleven", "own-files": "files", files: "files" };

export const isClone = () => fs.existsSync(path.join(ROOT, "node_modules", "remotion"));

export function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG, "utf8"));
  } catch {
    return {};
  }
}
export function writeConfig(c) {
  fs.mkdirSync(path.dirname(CONFIG), { recursive: true });
  fs.writeFileSync(CONFIG, JSON.stringify(c, null, 2));
}

export function resolve(flags = {}) {
  const clone = isClone();
  const cfg = clone ? {} : readConfig();
  const data = given(flags.data) ?? given(process.env.PAPERTALK_DATA) ?? cfg.data ?? path.join(os.homedir(), ".papertalk");
  const homeIn = given(flags.home) ?? given(process.env.PAPERTALK_HOME) ?? cfg.home;
  return {
    clone,
    root: ROOT,
    data,
    engine: clone ? ROOT : path.join(data, "engine"),
    home: homeIn ? path.resolve(expand(homeIn)) : clone ? ROOT : path.join(os.homedir(), "papertalk"),
    voice: VOICE[given(flags.voice) ?? given(process.env.PAPERTALK_VOICE) ?? cfg.voice] ?? undefined,
    localVoice: given(flags.localVoice) ?? given(process.env.PAPERTALK_LOCAL_VOICE) ?? cfg.localVoice,
  };
}
