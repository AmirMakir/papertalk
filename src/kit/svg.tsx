/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo } from "react";
import { back, eio, eo, seg } from "../lib";
import { F, type Theme } from "../theme";
import type { Ctx, El } from "./els";

// A hand-drawn SVG picture, animated by cues. The agent draws once on a 1920×1080
// canvas (videos/<slug>/<file>.svg); the storyboard says when each part appears.
//
//   { "t": "svg", "src": "picture.svg", "in": "1",
//     "steps": [ { "id": "inbox", "in": "6:inbox", "how": "draw" } ],   draw | pop | fade | up
//     "focus": [ { "ids": ["inbox", "agent"], "in": "7", "out": "9" } ], everything else dims
//     "flows": [ { "path": "e1", "in": "7:drop", "dur": 1.2, "c": "pen", "text": "webhook" } ],  a dot runs along a path
//     "glow": [ { "id": "inbox", "in": "7", "out": "9", "c": "pen" } ] }                        a halo while it is discussed
//
// In the SVG: $ink $pen $red $mark $muted $faint $card $bg are the theme colours,
// $serif $sans $mono the fonts, and <use href="#i-clock" …/> places a built-in icon
// (see ICON_NAMES). Parts named in steps start hidden; everything else shows with the element.

const SH = "path,line,polyline,polygon,rect,circle,ellipse";

const ICONS: Record<string, string> = {
  clock: `<circle cx="50" cy="50" r="38"/><path d="M50 28 V50 L66 60"/>`,
  mail: `<rect x="14" y="26" width="72" height="50" rx="8"/><path d="M16 30 L50 56 L84 30"/>`,
  chat: `<path d="M16 22 H84 V66 H46 L28 82 V66 H16 Z"/>`,
  bolt: `<path d="M56 10 L24 56 H48 L42 90 L76 42 H52 Z"/>`,
  db: `<ellipse cx="50" cy="24" rx="32" ry="11"/><path d="M18 24 V76 A32 11 0 0 0 82 76 V24"/><path d="M18 50 A32 11 0 0 0 82 50"/>`,
  folder: `<path d="M12 26 H42 L50 34 H88 V78 H12 Z"/>`,
  file: `<path d="M26 12 H60 L76 28 V88 H26 Z"/><path d="M60 12 V28 H76"/><path d="M36 48 H66 M36 62 H66 M36 76 H56"/>`,
  lock: `<rect x="22" y="44" width="56" height="42" rx="8"/><path d="M34 44 V32 A16 16 0 0 1 66 32 V44"/><path d="M50 60 V70"/>`,
  shield: `<path d="M50 10 L84 22 V48 C84 70 68 84 50 92 C32 84 16 70 16 48 V22 Z"/>`,
  user: `<circle cx="50" cy="34" r="16"/><path d="M18 88 C18 66 32 56 50 56 C68 56 82 66 82 88"/>`,
  bell: `<path d="M26 70 V46 A24 24 0 0 1 74 46 V70 L80 78 H20 Z"/><path d="M42 86 A8 8 0 0 0 58 86"/>`,
  cog: `<circle cx="50" cy="50" r="13"/><circle cx="50" cy="50" r="28"/><path d="M50 12 V22 M50 78 V88 M12 50 H22 M78 50 H88 M23 23 L30 30 M70 70 L77 77 M23 77 L30 70 M70 30 L77 23"/>`,
  bot: `<rect x="18" y="28" width="64" height="52" rx="16"/><path d="M50 28 V17"/><circle cx="50" cy="13" r="4"/><circle cx="38" cy="52" r="5" fill="currentColor"/><circle cx="62" cy="52" r="5" fill="currentColor"/><path d="M40 66 H60"/>`,
  "bot-sleep": `<rect x="18" y="28" width="64" height="52" rx="16"/><path d="M50 28 V17"/><circle cx="50" cy="13" r="4"/><path d="M31 53 Q38 58 45 53 M55 53 Q62 58 69 53"/><path d="M42 68 H58"/>`,
  send: `<path d="M12 48 L88 16 L66 86 L48 58 Z"/><path d="M48 58 L88 16"/>`,
  check: `<path d="M20 52 L42 72 L80 30"/>`,
  x: `<path d="M26 26 L74 74 M74 26 L26 74"/>`,
  ask: `<circle cx="50" cy="50" r="38"/><path d="M38 40 A12 12 0 1 1 54 51 C51 53 50 56 50 61"/><circle cx="50" cy="73" r="3.5" fill="currentColor"/>`,
  moon: `<path d="M64 14 A38 38 0 1 0 86 62 A30 30 0 0 1 64 14 Z"/>`,
  key: `<circle cx="32" cy="50" r="16"/><path d="M48 50 H86 M74 50 V62 M84 50 V58"/>`,
  list: `<path d="M34 28 H84 M34 50 H84 M34 72 H84"/><circle cx="18" cy="28" r="4" fill="currentColor"/><circle cx="18" cy="50" r="4" fill="currentColor"/><circle cx="18" cy="72" r="4" fill="currentColor"/>`,
  eye: `<path d="M8 50 C24 24 76 24 92 50 C76 76 24 76 8 50 Z"/><circle cx="50" cy="50" r="12"/>`,
};
export const ICON_NAMES = Object.keys(ICONS);

const defs = (th: Theme) =>
  `<defs>${Object.entries(ICONS)
    .map(([n, b]) => `<symbol id="i-${n}" viewBox="0 0 100 100" overflow="visible" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">${b}</symbol>`)
    .join("")}${(["ink", "pen", "red", "muted"] as const)
    .map((c) => `<marker id="i-arrow${c === "ink" ? "" : `-${c}`}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${th[c]}"/></marker>`)
    .join("")}</defs>`;

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
};

// theme tokens, prefixed ids, draw-on lengths, wrappers so CSS transforms never fight
// an element's own transform, and data-box on text for the overlap check
function prepare(markup: string, th: Theme, pre: string, stepIds: Set<string>) {
  const fonts: Record<string, string> = { serif: F.serif, sans: F.sans, mono: F.mono, body: F.body };
  const src = markup
    .replace(/<\?xml[^>]*\?>/g, "")
    .replace(/\$(markInk|ink|pen|red|mark|muted|faint|card|bg|key|val|dot)\b/g, (_, k) => (th as any)[k])
    .replace(/\$(serif|sans|mono|body)\b/g, (_, k) => fonts[k]);
  const doc = new DOMParser().parseFromString(src, "image/svg+xml");
  const svg = doc.documentElement;
  if (svg.nodeName !== "svg") return { html: `<div data-box="ERROR svg: ${(doc.querySelector("parsererror")?.textContent ?? "not an svg").slice(0, 80).replace(/"/g, "'")}"></div>`, vb: [0, 0, 1920, 1080], paths: {} as Record<string, string>, tops: [] as string[] };
  const vb = (svg.getAttribute("viewBox") ?? "0 0 1920 1080").split(/[\s,]+/).map(Number);
  const paths: Record<string, string> = {};
  for (const e of Array.from(svg.querySelectorAll("[id]"))) {
    const id = e.getAttribute("id")!;
    if (e.nodeName === "path") paths[id] = e.getAttribute("d") ?? "";
    e.setAttribute("id", pre + id);
    if (stepIds.has(id) && e.getAttribute("transform")) {
      const g = doc.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("transform", e.getAttribute("transform")!);
      e.removeAttribute("transform");
      e.parentNode!.insertBefore(g, e);
      g.appendChild(e);
    }
  }
  for (const e of Array.from(svg.querySelectorAll("[href], [*|href]"))) {
    const h = e.getAttribute("href") ?? e.getAttributeNS("http://www.w3.org/1999/xlink", "href") ?? "";
    if (h.startsWith("#") && !h.startsWith("#i-")) e.setAttribute("href", `#${pre}${h.slice(1)}`);
  }
  for (const e of Array.from(svg.querySelectorAll("*"))) {
    for (const a of ["fill", "stroke", "marker-end", "marker-start", "clip-path", "mask", "filter"]) {
      const v = e.getAttribute(a);
      if (v && /url\(#(?!i-)/.test(v)) e.setAttribute(a, v.replace(/url\(#/, `url(#${pre}`));
    }
  }
  for (const e of Array.from(svg.querySelectorAll(SH))) if (!e.hasAttribute("pathLength") && !e.hasAttribute("stroke-dasharray") && !e.closest("defs")) e.setAttribute("pathLength", "1");
  for (const e of Array.from(svg.querySelectorAll("text"))) e.setAttribute("data-box", `svg text “${(e.textContent ?? "").trim().slice(0, 18)}”`);
  // every top-level part gets a wrapper the focus dimming can use
  const tops: string[] = [];
  for (const e of Array.from(svg.children)) {
    if (e.nodeName === "defs" || e.nodeName === "style") continue;
    const g = doc.createElementNS("http://www.w3.org/2000/svg", "g");
    const id = e.getAttribute("id");
    g.setAttribute("data-top", id ? id.slice(pre.length) : "");
    svg.insertBefore(g, e);
    g.appendChild(e);
    if (id) tops.push(id.slice(pre.length));
  }
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("overflow", "visible");
  const html = new XMLSerializer().serializeToString(svg).replace(/(<svg\b[^>]*>)/, `$1${defs(th)}`);
  return { html, vb, paths, tops };
}

export const Svg: React.FC<{ el: El; ctx: Ctx }> = ({ el, ctx }) => {
  const { t, th } = ctx;
  const steps: any[] = el.steps ?? [];
  const pre = useMemo(() => `s${hash(String(el.markup ?? ""))}-`, [el.markup]);
  const prep = useMemo(() => prepare(String(el.markup ?? "<svg/>"), th, pre, new Set(steps.map((s) => s.id))), [el.markup, th, pre]); // eslint-disable-line react-hooks/exhaustive-deps
  const o = seg(t, el.in, 0.4) * (el.out == null ? 1 : 1 - seg(t, el.out, 0.4));
  if (o <= 0) return null;
  const css: string[] = [];
  // an id may appear in several steps (shown, hidden, shown again): the latest one that has started wins
  const cur = new Map<string, any>();
  for (const s of steps) if (!cur.has(s.id) || t >= s.in - 0.01) cur.set(s.id, s);
  for (const s of cur.values()) {
    const id = `#${pre}${s.id}`;
    const how = s.how ?? "draw";
    const dur = s.dur ?? (how === "draw" ? 0.9 : 0.45);
    const p = seg(t, s.in, dur);
    const q = s.out != null ? 1 - seg(t, s.out, 0.35) : 1;
    const base = `${id}{transform-box:fill-box;transform-origin:center;`;
    if (how === "draw") {
      css.push(`${base}opacity:${Math.min(1, p * 4) * q}}`);
      css.push(`${id}:is(${SH}):not([stroke-dasharray]),${id} :is(${SH}):not([stroke-dasharray]){stroke-dasharray:1 1;stroke-dashoffset:${(1 - eio(p)).toFixed(4)}}`);
      css.push(`${id}:is(${SH}),${id} :is(${SH}){fill-opacity:${seg(t, s.in + dur * 0.55, dur * 0.45).toFixed(3)}}`);
      css.push(`${id} text,${id} use{opacity:${seg(t, s.in + dur * 0.45, 0.35).toFixed(3)}}`);
    } else if (how === "pop") css.push(`${base}opacity:${Math.min(1, p * 2) * q};transform:scale(${back(p).toFixed(4)})}`);
    else if (how === "up") css.push(`${base}opacity:${p * q};transform:translateY(${((1 - eo(p)) * 24).toFixed(2)}px)}`);
    else css.push(`${base}opacity:${p * q}}`);
  }
  // focus: everything not named dims
  let dim = 0;
  const keep = new Set<string>();
  for (const f of el.focus ?? []) {
    const v = seg(t, f.in, 0.4) * (f.out == null ? 1 : 1 - seg(t, f.out, 0.4));
    if (v > dim) {
      dim = v;
      keep.clear();
      for (const k of f.ids ?? []) keep.add(k);
    }
  }
  if (dim > 0) css.push(`[data-top]:not(${[...keep].map((k) => `[data-top="${k}"]`).join(",") || "#none"}){opacity:${(1 - 0.75 * dim).toFixed(3)}}`);
  // glow: a highlighter halo on a part while it is being talked about
  for (const g of el.glow ?? []) {
    const v = seg(t, g.in, 0.3) * (g.out == null ? 1 : 1 - seg(t, g.out, 0.3));
    if (v > 0) css.push(`#${pre}${g.id}{filter:drop-shadow(0 0 ${(14 * v).toFixed(1)}px ${(th as any)[g.c ?? "pen"] ?? g.c})}`);
  }
  const k = 1920 / (prep.vb[2] || 1920);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, opacity: o, pointerEvents: "none" }}>
      <style>{css.join("\n")}</style>
      <div style={{ position: "absolute", inset: 0 }} dangerouslySetInnerHTML={{ __html: prep.html }} />
      <div style={{ position: "absolute", left: 0, top: 0, width: prep.vb[2], height: prep.vb[3], transform: `scale(${k}) translate(${-prep.vb[0]}px, ${-prep.vb[1]}px)`, transformOrigin: "0 0" }}>
        {(el.flows ?? []).map((f: any, i: number) => {
          const d = prep.paths[f.path];
          const dur = f.dur ?? 1.2;
          const p = seg(t, f.in, dur);
          if (!d || t < f.in || p >= 1) return null;
          const col = (th as any)[f.c ?? "pen"] ?? f.c;
          const fade = Math.min(1, p * 8, (1 - p) * 8);
          return (
            <div key={i} style={{ position: "absolute", left: 0, top: 0, offsetPath: `path("${d}")`, offsetDistance: `${(eio(p) * 100).toFixed(2)}%`, offsetRotate: "0deg", opacity: fade, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: (f.r ?? 13) * 2, height: (f.r ?? 13) * 2, borderRadius: "50%", background: col, boxShadow: `0 0 0 6px ${th.bg}` }} />
              {f.text ? <div style={{ position: "absolute", left: (f.r ?? 13) * 2 + 10, top: -6, fontFamily: F.sans, fontWeight: 700, fontSize: f.size ?? 28, color: col, whiteSpace: "nowrap", background: th.bg, padding: "0 6px", borderRadius: 6 }}>{f.text}</div> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};
