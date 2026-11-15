#!/usr/bin/env node
// Source → videos/<slug>/source.md: the text to explain, as Markdown with its headings,
// plus source.json (title, byline, link, kind, outline). Nothing is downloaded but the
// page text itself: images stay as links.
//
//   node scripts/ingest.mjs <slug> <url | file>
//
// Kinds, picked from the address:
//   paper  arxiv.org (its HTML version), transformer-circuits.pub, openreview, *.pdf
//   essay  blogs and opinion pieces: anthropic.com/news, darioamodei.com, any article page
//   post   x.com / twitter.com: a single post comes through X's public oEmbed;
//          X Articles need a logged-in browser, so save the text and pass the file
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const [slug, src] = process.argv.slice(2);
if (!slug || !src) {
  console.error("usage: ingest.mjs <slug> <url | file>");
  process.exit(1);
}
const DIR = path.join(ROOT, "videos", slug);
fs.mkdirSync(DIR, { recursive: true });
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36 papertalk/0.1";

const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" });
td.remove(["script", "style", "noscript", "iframe", "svg", "button", "form"]);

async function get(url) {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8" }, redirect: "follow", signal: AbortSignal.timeout(45000) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return { text: await res.text(), url: res.url, type: res.headers.get("content-type") ?? "" };
}

// the readable part of a page, as Markdown
function article(html, url) {
  const { document } = parseHTML(html);
  const meta = (n) => document.querySelector(`meta[name="${n}"], meta[property="${n}"]`)?.getAttribute("content") ?? "";
  const r = new Readability(document, { charThreshold: 200, keepClasses: false }).parse();
  if (!r?.content) throw new Error(`${url}: no readable article on the page`);
  const md = td.turndown(r.content).replace(/\n{3,}/g, "\n\n").trim();
  return {
    title: (r.title || meta("og:title") || meta("citation_title")).trim(),
    byline: cleanBy(r.byline) || [...document.querySelectorAll('meta[name="citation_author"]')].map((m) => m.getAttribute("content")).slice(0, 6).join(", ") || meta("author") || r.siteName || "",
    date: meta("citation_publication_date") || meta("article:published_time") || meta("date") || "",
    md,
  };
}

// one line, no labels like "Authors" or e-mail addresses
const cleanBy = (s) => {
  const l = String(s ?? "").split("\n").map((x) => x.trim()).find((x) => x && !/^(authors?|affiliations?)\b:?$/i.test(x) && !/@/.test(x)) ?? "";
  return l.replace(/^(by|affiliation:)\s+/i, "").slice(0, 140);
};

function kindOf(u) {
  const h = u.hostname.replace(/^www\./, "");
  if (/(^|\.)x\.com$|(^|\.)twitter\.com$/.test(h)) return "post";
  if (/arxiv\.org|transformer-circuits\.pub|openreview\.net|aclanthology\.org|biorxiv\.org|proceedings\./.test(h) || /\.pdf$/i.test(u.pathname)) return "paper";
  if (h === "anthropic.com" && u.pathname.startsWith("/research")) return "paper";
  return "essay";
}

async function fromUrl(raw) {
  const u = new URL(raw);
  const kind = kindOf(u);
  const h = u.hostname.replace(/^www\./, "");
  if (kind === "post") {
    if (/\/(i\/)?article\//.test(u.pathname) || /\/articles?\//.test(u.pathname))
      throw new Error("X Articles only open in a logged-in browser. Open it, copy the text into a .md file (or let your agent read the page), then: ingest <slug> that-file.md --kind post");
    const m = /\/status\/(\d+)/.exec(u.pathname);
    if (!m) throw new Error("give the link to one post: https://x.com/<user>/status/<id>");
    const { text } = await get(`https://publish.twitter.com/oembed?omit_script=1&dnt=true&url=${encodeURIComponent(raw)}`);
    const j = JSON.parse(text);
    const { document } = parseHTML(`<body>${j.html}</body>`);
    const p = document.querySelector("blockquote p");
    const body = p ? td.turndown(p.innerHTML) : td.turndown(j.html);
    return { kind, title: `Post by ${j.author_name}`, byline: `${j.author_name} · ${(j.author_url ?? "").replace(/^https:\/\/(twitter|x)\.com\//, "@")}`, date: "", link: raw, md: `${body}\n\n_Only this one post. For a thread or a long post, paste the full text into a file and ingest that._` };
  }
  if (h === "arxiv.org") {
    const id = /\/(?:abs|pdf|html)\/([^/?#]+?)(?:\.pdf)?$/.exec(u.pathname)?.[1];
    if (!id) throw new Error("arXiv: give the abs, pdf or html link");
    try {
      const { text, url } = await get(`https://arxiv.org/html/${id}`);
      return { kind, link: `https://arxiv.org/abs/${id}`, ...article(text, url) };
    } catch (e) {
      throw new Error(`arXiv ${id} has no HTML version (${e.message}). Download the PDF yourself and pass the file.`);
    }
  }
  const { text, url, type } = await get(raw);
  if (/pdf/.test(type)) throw new Error("that link is a PDF: download it and pass the file");
  return { kind, link: url, ...article(text, url) };
}

function fromFile(file, kindArg) {
  const ext = path.extname(file).toLowerCase();
  const name = path.basename(file, ext);
  if (ext === ".md" || ext === ".txt") {
    const md = fs.readFileSync(file, "utf8").trim();
    return { kind: kindArg ?? "essay", title: /^#\s+(.+)$/m.exec(md)?.[1] ?? name, byline: "", date: "", link: "", md };
  }
  if (ext === ".html" || ext === ".htm") return { kind: kindArg ?? "essay", link: "", ...article(fs.readFileSync(file, "utf8"), file) };
  if (ext === ".pdf") {
    const r = spawnSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (r.error || r.status) throw new Error("PDF needs pdftotext (poppler): brew install poppler / apt install poppler-utils");
    return { kind: kindArg ?? "paper", title: name, byline: "", date: "", link: "", md: r.stdout.replace(/\f/g, "\n\n").trim() };
  }
  throw new Error(`can't read ${ext} files: give .md, .txt, .html or .pdf`);
}

const kindArg = (() => {
  const i = process.argv.indexOf("--kind");
  return i > 0 ? process.argv[i + 1] : undefined;
})();
let s;
try {
  s = /^https?:\/\//.test(src) ? await fromUrl(src) : fromFile(path.resolve(src), kindArg);
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
if (kindArg) s.kind = kindArg;

// the outline: every heading with how many words sit under it
const lines = s.md.split("\n");
const outline = [];
let cur = { level: 0, heading: "(before the first heading)", words: 0 };
for (const l of lines) {
  const m = /^(#{1,4})\s+(.+?)\s*#*$/.exec(l);
  if (m) {
    if (cur.words || cur.level) outline.push(cur);
    cur = { level: m[1].length, heading: m[2].replace(/\[(.*?)\]\(.*?\)/g, "$1"), words: 0 };
  } else cur.words += l.split(/\s+/).filter(Boolean).length;
}
outline.push(cur);
const words = outline.reduce((a, o) => a + o.words, 0);

const head = [`# ${s.title}`, s.byline && `by ${s.byline}`, s.date && `date: ${s.date}`, s.link && `source: ${s.link}`, `kind: ${s.kind} · ${words} words`].filter(Boolean).join("\n");
fs.writeFileSync(path.join(DIR, "source.md"), `${head}\n\n---\n\n${s.md}\n`);
fs.writeFileSync(path.join(DIR, "source.json"), JSON.stringify({ title: s.title, byline: s.byline, date: s.date, link: s.link, kind: s.kind, words, outline, ingested: new Date().toISOString().slice(0, 10) }, null, 2));
console.log(`${s.kind}: ${s.title}${s.byline ? ` — ${s.byline}` : ""}`);
console.log(`videos/${slug}/source.md · ${words} words · ${outline.length} sections`);
for (const o of outline.filter((o) => o.level && o.level <= 3).slice(0, 60)) console.log(`${"  ".repeat(o.level - 1)}${o.heading}  (${o.words})`);
process.exit(0); // an idle socket from fetch can otherwise keep node alive
