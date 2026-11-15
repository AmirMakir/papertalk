#!/usr/bin/env node
// MCP server over stdio, no dependencies: lets any MCP client (Claude Code, Claude
// Desktop, Cursor…) drive the same steps as the scripts. The writing (facts, script,
// storyboard) stays with the client's model; papertalk_guide hands it the rules.
//
//   claude mcp add papertalk -- node /path/to/papertalk/mcp/server.mjs
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SLUG = { type: "string", description: "folder name under videos/, kebab-case" };

const run = (script, args) =>
  new Promise((resolve) => {
    const p = spawn(process.execPath, [path.join(ROOT, "scripts", script), ...args], { cwd: ROOT, env: process.env });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => resolve({ code, out: out.trim().slice(-6000) }));
  });
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "");
const safe = (slug) => {
  if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(slug ?? "")) throw new Error("slug: lowercase letters, digits and dashes");
  return slug;
};

const tools = {
  papertalk_guide: {
    description: "The rules and formats for making a papertalk video: read this first, before writing facts, script or storyboard.",
    inputSchema: { type: "object", properties: {} },
    run: async () => [read(path.join(ROOT, ".claude/skills/papertalk/SKILL.md")), read(path.join(ROOT, "docs/storyboard.md")), read(path.join(ROOT, "docs/svg.md")), ...["paper", "essay", "post"].map((k) => read(path.join(ROOT, `docs/formats/${k}.md`)))].join("\n\n---\n\n"),
  },
  papertalk_setup: {
    description: "Remember which voice to use (asked once, on the first run): local = free voice on this machine (Kokoro), eleven = ElevenLabs (the person adds ELEVENLABS_API_KEY to .env themselves), files = their own WAVs. Without arguments, shows the current choice.",
    inputSchema: { type: "object", properties: { voice: { type: "string", enum: ["local", "eleven", "files"] }, local_voice: { type: "string", description: "am_michael (male) or af_heart (female), or another Kokoro voice" } } },
    run: async ({ voice, local_voice }) => (await run("setup.mjs", voice ? ["--voice", voice, ...(local_voice ? [local_voice] : [])] : [])).out,
  },
  papertalk_ingest: {
    description: "Fetch a source (paper, blog post, essay, X post, or a local .md/.html/.pdf file) into videos/<slug>/source.md and print its outline.",
    inputSchema: { type: "object", properties: { slug: SLUG, source: { type: "string", description: "URL or absolute file path" }, kind: { type: "string", enum: ["paper", "essay", "post"] } }, required: ["slug", "source"] },
    run: async ({ slug, source, kind }) => (await run("ingest.mjs", [safe(slug), source, ...(kind ? ["--kind", kind] : [])])).out,
  },
  papertalk_write: {
    description: "Save one of the text files of a video: facts.md, script.txt or storyboard.json.",
    inputSchema: { type: "object", properties: { slug: SLUG, file: { type: "string", enum: ["facts.md", "script.txt", "storyboard.json"] }, content: { type: "string" } }, required: ["slug", "file", "content"] },
    run: async ({ slug, file, content }) => {
      const dir = path.join(ROOT, "videos", safe(slug));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, file), content);
      return `saved videos/${slug}/${file}`;
    },
  },
  papertalk_voice_text: {
    description: "The narration text to synthesize, one chunk per take (block boundaries, ≤2400 chars). Send each chunk to your TTS, save the WAVs, then call papertalk_voice.",
    inputSchema: { type: "object", properties: { slug: SLUG }, required: ["slug"] },
    run: async ({ slug }) => {
      const r = await run("voice.mjs", [safe(slug), "--chunks"]);
      const dir = path.join(ROOT, "videos", slug, "vo");
      const chunks = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^chunk-\d+\.txt$/.test(f)).sort() : [];
      return [r.out, ...chunks.map((f) => `── ${f} ──\n${read(path.join(dir, f))}`)].join("\n\n");
    },
  },
  papertalk_voice: {
    description: "Build voice.wav and word timings: from WAV takes in script order (any TTS), or with eleven=true from ElevenLabs (ELEVENLABS_API_KEY).",
    inputSchema: { type: "object", properties: { slug: SLUG, takes: { type: "array", items: { type: "string" }, description: "absolute paths of WAV files, in script order" }, eleven: { type: "boolean" } }, required: ["slug"] },
    run: async ({ slug, takes = [], eleven }) => (await run("voice.mjs", [safe(slug), ...(eleven ? ["--eleven"] : takes)])).out,
  },
  papertalk_check: {
    description: "Render the key moments small, report overlapping or cut-off text, and write contact sheets (PNG paths) to look at.",
    inputSchema: { type: "object", properties: { slug: SLUG }, required: ["slug"] },
    run: async ({ slug }) => (await run("make.mjs", [safe(slug), "check"])).out.replace(/out\//g, `${ROOT}/out/`),
  },
  papertalk_render: {
    description: "Render the full video to out/<slug>.mp4 (1920×1080, 30 fps).",
    inputSchema: { type: "object", properties: { slug: SLUG }, required: ["slug"] },
    run: async ({ slug }) => (await run("make.mjs", [safe(slug), "render"])).out.replace(/out\//g, `${ROOT}/out/`),
  },
};

const send = (m) => process.stdout.write(`${JSON.stringify(m)}\n`);
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", async (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  const { id, method, params } = msg;
  if (id === undefined) return; // notifications
  const ok = (result) => send({ jsonrpc: "2.0", id, result });
  const fail = (code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });
  if (method === "initialize") return ok({ protocolVersion: params?.protocolVersion ?? "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "papertalk", version: "0.1.0" } });
  if (method === "ping") return ok({});
  if (method === "tools/list") return ok({ tools: Object.entries(tools).map(([name, t]) => ({ name, description: t.description, inputSchema: t.inputSchema })) });
  if (method === "tools/call") {
    const t = tools[params?.name];
    if (!t) return fail(-32602, `unknown tool ${params?.name}`);
    try {
      const text = await t.run(params.arguments ?? {});
      return ok({ content: [{ type: "text", text: String(text) }] });
    } catch (e) {
      return ok({ content: [{ type: "text", text: e.message }], isError: true });
    }
  }
  fail(-32601, `no method ${method}`);
});
