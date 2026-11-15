import React from "react";
import { back, eio, eo, lerp, seg } from "../lib";
import { F, HEADS, type Theme } from "../theme";
import { parseTex, roleColor, Tex } from "./tex";
import { Svg } from "./svg";

// The building blocks of a papertalk video. A storyboard lists elements; every time in it is
// already resolved to seconds (scripts/make.mjs turns "9:key" into a number).
// Elements tied to the example row ("row") use word indices; the rest go into areas.

/* eslint-disable @typescript-eslint/no-explicit-any */
export type El = { t: string; in: number; out?: number | null } & Record<string, any>;
export type WordBox = { text: string; x: number; w: number; cx: number };
export type Row = { boxes: WordBox[]; size: number; top: number; bottom: number; arcY: number; dx: number[]; dy: number[] };
export type Paper = { id: string; title: string; link: string; byline: string };
export type Ctx = { t: number; th: Theme; row: Row | null; paper: Paper; dip?: number };
type C = React.FC<{ el: El; ctx: Ctx }>;

export const vis = (t: number, a: number, b?: number | null, fi = 0.3, fo = 0.35) => seg(t, a, fi) * (b == null ? 1 : 1 - seg(t, b, fo));
const SZ: Record<string, number> = { s: 36, m: 46, l: 58, xl: 76, xxl: 112 };
const sz = (s: unknown, d: number) => (typeof s === "number" ? s : (SZ[String(s)] ?? d));
export const arcH = (d: number) => Math.min(300, 56 + 34 * d);
export const lowH = (d: number) => 36 + 20 * d;
export const arcPath = (x1: number, x2: number, y: number, h: number) => `M ${x1} ${y} C ${x1} ${y - h * 1.25}, ${x2} ${y - h * 1.25}, ${x2} ${y}`;
const arcPoint = (x1: number, x2: number, y: number, h: number, u: number) => ({ x: x1 + (x2 - x1) * (3 * u * u - 2 * u * u * u), y: y - 1.25 * h * 3 * u * (1 - u) });
export const laneY = (r: Row, k: unknown) => (k === "above" ? r.arcY - 50 : r.bottom + 56 + (Number(k ?? 1) - 1) * 90);
const cxOf = (r: Row, i: number) => r.boxes[i].cx + r.dx[i];

export const area = (name: string, row: Row | null) => {
  const ub = row ? row.bottom + 40 : 640;
  if (name === "title") return { x: 80, y: 70, w: 1760, h: 120 };
  if (name === "top") return { x: 80, y: 150, w: 1760, h: 300 };
  if (name === "mid") return { x: 80, y: 200, w: 1760, h: 640 };
  if (name === "under") return { x: 80, y: ub, w: 1760, h: Math.max(160, 940 - ub) };
  return { x: 80, y: 150, w: 1760, h: 790 };
};

// Inline markup: {pen:word} colours, *word* highlighter, ~word~ struck out in red.
export const Rich: React.FC<{ text: string; th: Theme }> = ({ text, th }) => (
  <>
    {String(text)
      .split(/(\{[a-z]+[0-9]?:[^}]*\}|\*[^*]+\*|~[^~]+~)/)
      .map((s, i) => {
        if (!s) return null;
        const m = /^\{([a-z]+[0-9]?):([^}]*)\}$/.exec(s);
        if (m)
          return (
            <span key={i} style={{ color: roleColor(th, m[1]) }}>
              {m[2]}
            </span>
          );
        if (/^\*[^*]+\*$/.test(s))
          return (
            <span key={i} style={{ background: th.mark, color: th.markInk, borderRadius: 8, padding: "0 8px" }}>
              {s.slice(1, -1)}
            </span>
          );
        if (/^~[^~]+~$/.test(s))
          return (
            <span key={i} style={{ color: th.red, textDecoration: "line-through", fontWeight: 500 }}>
              {s.slice(1, -1)}
            </span>
          );
        return <React.Fragment key={i}>{s}</React.Fragment>;
      })}
  </>
);

// Puts a free element into its area; "inline" renders in place (inside a card).
const Place: React.FC<{ el: El; ctx: Ctx; def: string; children: React.ReactNode }> = ({ el, ctx, def, children }) => {
  const p = seg(ctx.t, el.in, 0.35);
  const o = vis(ctx.t, el.in, el.out);
  if (o <= 0) return null;
  const inner = <div style={{ opacity: o, transform: `translate(${el.dx ?? 0}px, ${(el.dy ?? 0) + (1 - eo(p)) * 16}px)` }}>{children}</div>;
  if (el.area === "inline") return inner;
  const a = area(el.area ?? def, ctx.row);
  if (typeof el.x === "number")
    return (
      <div style={{ position: "absolute", left: a.x + el.x * a.w, top: a.y, height: a.h, display: "flex", alignItems: el.y === "center" ? "center" : el.y === "bottom" ? "flex-end" : "flex-start", transform: "translateX(-50%)" }}>
        {inner}
      </div>
    );
  return (
    <div
      style={{
        position: "absolute",
        left: a.x,
        top: a.y,
        width: a.w,
        height: a.h,
        display: "flex",
        justifyContent: el.x === "left" ? "flex-start" : el.x === "right" ? "flex-end" : "center",
        alignItems: el.y === "center" ? "center" : el.y === "bottom" ? "flex-end" : "flex-start",
      }}
    >
      {inner}
    </div>
  );
};

// ── row modifiers drawn behind or over the words ──
const Mark: C = ({ el, ctx }) => {
  const r = ctx.row!;
  const b = r.boxes[el.w];
  const p = eo(seg(ctx.t, el.in - 0.05, 0.35));
  const o = el.out == null ? 1 : 1 - seg(ctx.t, el.out, 0.35);
  if (p <= 0 || o <= 0) return null;
  return <div style={{ position: "absolute", left: b.x + r.dx[el.w] - 12, top: r.top + r.size * 0.14 + r.dy[el.w], width: (b.w + 24) * p, height: r.size * 0.84, background: roleColor(ctx.th, el.c ?? "mark"), borderRadius: 8, transform: "rotate(-1.2deg)", opacity: o }} />;
};
const Underline: C = ({ el, ctx }) => {
  const r = ctx.row!;
  const b = r.boxes[el.w];
  const p = eo(seg(ctx.t, el.in, 0.35));
  const o = el.out == null ? 1 : 1 - seg(ctx.t, el.out, 0.35);
  if (p <= 0 || o <= 0) return null;
  return <div style={{ position: "absolute", left: b.x + r.dx[el.w] - 4, top: r.top + r.size * 1.02 + r.dy[el.w], width: (b.w + 8) * p, height: 7, borderRadius: 4, background: roleColor(ctx.th, el.c ?? "pen"), opacity: o }} />;
};
const Strike: C = ({ el, ctx }) => {
  const r = ctx.row!;
  const b = r.boxes[el.w];
  const p = eo(seg(ctx.t, el.in, 0.3));
  const o = el.out == null ? 1 : 1 - seg(ctx.t, el.out, 0.35);
  if (p <= 0 || o <= 0) return null;
  return <div style={{ position: "absolute", left: b.x + r.dx[el.w] - 10, top: r.top + r.size * 0.5 + r.dy[el.w], width: (b.w + 20) * p, height: 8, borderRadius: 4, background: ctx.th.red, transform: "rotate(-4deg)", opacity: o }} />;
};

// ── arcs between words ──
const Arcs: C = ({ el, ctx }) => {
  const r = ctx.row!;
  const { t, th } = ctx;
  const n = r.boxes.length;
  let pairs: [number, number][] = [];
  if (el.pairs === "all") {
    for (let d = 1; d < n; d++) for (let i = 0; i + d < n; i++) pairs.push([i, i + d]);
  } else {
    const to: number[] = el.to === "all" ? [...Array(n).keys()].filter((j) => j !== el.from) : ([] as number[]).concat(el.to);
    pairs = to.map((j) => [el.from, j]);
  }
  const single = pairs.length === 1;
  const all = el.pairs === "all";
  const low = el.low ?? all;
  const w0 = el.w ?? (single ? 8 : all ? 2.5 : 3.5);
  const o0 = el.o ?? (single ? 1 : all ? 0.3 : 0.5);
  const col = roleColor(th, el.c ?? "pen");
  const stagger = el.stagger ?? (single ? 0 : all ? 0.016 : 0.06);
  const y = el.from_above ? r.arcY - 80 : r.arcY;
  const vo = el.out == null ? 1 : 1 - seg(t, el.out, 0.4);
  if (vo <= 0 || t < el.in) return null;
  const [ci, cj] = pairs[0] ?? [0, 0];
  const ch = (low ? lowH : arcH)(Math.abs(cj - ci));
  const cross = single && el.crossIn != null ? seg(t, el.crossIn, 0.3) * (el.crossOut != null ? 1 - seg(t, el.crossOut, 0.4) : 1) : 0;
  return (
    <g opacity={vo}>
      {pairs.map(([i, j], k) => {
        const h = (low ? lowH : arcH)(Math.abs(j - i));
        const d = arcPath(cxOf(r, i), cxOf(r, j), y, h);
        if (el.heads) {
          const hd = (i * 3 + j * 5) % el.heads;
          const ph = seg(t, el.ins?.[hd] ?? el.in, 0.4);
          return ph > 0 ? <path key={k} d={d} fill="none" stroke={HEADS[hd % HEADS.length]} strokeWidth={el.w ?? 4.5} strokeLinecap="round" opacity={(el.o ?? 0.8) * ph} /> : null;
        }
        const p = eio(seg(t, el.in + k * stagger, el.draw ?? 0.6));
        if (p <= 0) return null;
        let w = w0;
        let o = o0;
        if (el.weights) {
          const q = eio(seg(t, el.wIn ?? el.in, 0.6));
          const wt = el.weights[j] ?? 0;
          w = lerp(w0, 2 + wt * 12, q);
          o = lerp(o0, 0.3 + 0.7 * wt, q);
        }
        const dot = el.dots && p < 1 ? arcPoint(cxOf(r, i), cxOf(r, j), y, h, p) : null;
        return (
          <g key={k}>
            <path d={d} fill="none" stroke={col} strokeWidth={w} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} opacity={o} />
            {dot ? <circle cx={dot.x} cy={dot.y} r={9} fill={col} /> : null}
          </g>
        );
      })}
      {cross > 0 ? (
        <g transform={`translate(${(cxOf(r, ci) + cxOf(r, cj)) / 2} ${y - 0.94 * ch}) scale(${back(seg(t, el.crossIn, 0.3))})`} opacity={Math.min(1, cross * 3)}>
          <circle r={30} fill={th.bg} />
          <path d="M -17 -17 L 17 17 M 17 -17 L -17 17" stroke={th.red} strokeWidth={9} strokeLinecap="round" />
        </g>
      ) : null}
    </g>
  );
};

// ── small boxes and numbers on the words ──
const Tokens: C = ({ el, ctx }) => {
  const r = ctx.row!;
  const { t, th } = ctx;
  const ex = new Set<number>(el.except ?? []);
  const set: number[] = (el.words === "all" || el.words == null ? [...r.boxes.keys()] : el.words).filter((i: number) => !ex.has(i));
  const y = laneY(r, el.lane ?? "above");
  const col = roleColor(th, el.c ?? "pen");
  return (
    <>
      {set.map((i, k) => {
        const at = el.in + k * (el.stagger ?? 0.05);
        const o = vis(t, at, el.out);
        if (o <= 0) return null;
        return (
          <div
            key={i}
            data-box={`tokens ${el.text}@${i}`}
            style={{ position: "absolute", left: cxOf(r, i), top: y, width: 62, height: 54, marginLeft: -31, marginTop: -27, borderRadius: 14, boxSizing: "border-box", border: `4px solid ${col}`, background: el.solid ? col : th.card, color: el.solid ? "#fff" : col, fontFamily: F.serif, fontStyle: "italic", fontWeight: 500, fontSize: 42, lineHeight: "44px", textAlign: "center", opacity: o, transform: `scale(${back(seg(t, at, 0.3))})` }}
          >
            {el.text}
          </div>
        );
      })}
    </>
  );
};

const num = (s: string) => {
  const m = /^([^\d.-]*)(-?\d*\.?\d+)(.*)$/.exec(s);
  return m ? { pre: m[1], v: parseFloat(m[2]), dec: (m[2].split(".")[1] ?? "").length, suf: m[3] } : null;
};
const morph = (a: string | null, b: string, q: number) => {
  if (a == null || q >= 1) return b;
  const pa = num(a);
  const pb = num(b);
  if (!pa || !pb) return q < 0.5 ? a : b;
  return pb.pre + lerp(pa.v, pb.v, q).toFixed(pb.dec) + pb.suf;
};
const Values: C = ({ el, ctx }) => {
  const r = ctx.row!;
  const { t, th } = ctx;
  const steps: { in: number; v: (string | null)[] }[] = el.steps;
  let k = -1;
  for (let s = 0; s < steps.length; s++) if (t >= steps[s].in) k = s;
  const o = el.out == null ? 1 : 1 - seg(t, el.out, 0.35);
  if (k < 0 || o <= 0) return null;
  const pm = eio(seg(t, steps[k].in, 0.7));
  const warn = el.warn ? seg(t, el.warn.in, 0.25) - (el.warn.out != null ? seg(t, el.warn.out, 0.3) : 0) : 0;
  const y = laneY(r, el.lane ?? 1);
  return (
    <>
      {r.boxes.map((_, i) => {
        const cur = steps[k].v[i];
        if (cur == null || cur === "") return null;
        const prev = k > 0 ? (steps[k - 1].v[i] ?? null) : null;
        const p0 = seg(t, steps[0].in + i * 0.04, 0.25);
        const emph = el.emph ? 1 + 0.45 * (el.emph[i] ?? 0) * seg(t, el.emphIn ?? steps[steps.length - 1].in, 0.5) : 1;
        return (
          <div key={i} data-box={`values@${i}`} style={{ position: "absolute", left: cxOf(r, i), top: y, transform: `translate(-50%, -50%) scale(${back(p0) * emph * (1 + 0.4 * warn)})`, fontFamily: F.sans, fontWeight: 700, fontSize: el.size ?? 44, lineHeight: 1, color: warn > 0.5 ? th.red : roleColor(th, el.c), opacity: o, whiteSpace: "nowrap" }}>
            {morph(prev, String(cur), pm)}
          </div>
        );
      })}
    </>
  );
};

// ── text ──
const Label: C = ({ el, ctx }) => {
  const { t, th, row } = ctx;
  const o = vis(t, el.in, el.out);
  if (o <= 0) return null;
  const p = seg(t, el.in, 0.3);
  const fs = sz(el.size, 46);
  const style: React.CSSProperties = {
    fontFamily: el.serif ? F.serif : el.mono ? F.mono : F.sans,
    fontWeight: el.weight ?? (el.serif ? 600 : 700),
    fontSize: fs,
    lineHeight: 1.15,
    color: roleColor(th, el.c),
    whiteSpace: el.wrap ? "pre-line" : "pre",
    maxWidth: el.wrap ? (el.maxw ?? 1400) : undefined,
    textAlign: el.align ?? "center",
    background: el.plate ? th.bg : el.box ? th.card : undefined,
    border: el.box ? `4px solid ${roleColor(th, el.bc ?? el.c)}` : undefined,
    borderRadius: el.box ? 18 : 10,
    padding: el.box ? "14px 24px" : el.plate ? "2px 14px" : 0,
  };
  const name = `label "${String(el.text).slice(0, 28)}"`;
  if (row && (el.over != null || el.under != null || el.lane != null)) {
    let x = 960;
    let y = 0;
    let ax = "-50%";
    if (Array.isArray(el.over)) {
      const [a, b] = el.over;
      x = (cxOf(row, a) + cxOf(row, b)) / 2;
      y = row.arcY - 0.94 * (el.low ? lowH : arcH)(Math.abs(b - a)) - (el.lift ?? 78);
    } else if (el.over != null) {
      x = cxOf(row, el.over);
      y = row.top - (el.lift ?? 84);
    } else {
      if (el.under != null) x = cxOf(row, el.under);
      else if (el.x === "left") {
        x = row.boxes[0].x;
        ax = "0";
      } else if (el.x === "right") {
        const lb = row.boxes[row.boxes.length - 1];
        x = lb.x + lb.w;
        ax = "-100%";
      } else if (typeof el.x === "number") x = 80 + el.x * 1760;
      y = laneY(row, el.lane ?? 1) - fs * 0.6;
    }
    return (
      <div data-box={name} style={{ ...style, width: "max-content", position: "absolute", left: x, top: y + (el.dy ?? 0), transform: `translate(${ax}, 0) scale(${0.7 + 0.3 * back(p)})`, transformOrigin: ax === "0" ? "0 50%" : ax === "-100%" ? "100% 50%" : "50% 50%", opacity: Math.min(1, p * 2) * (el.out == null ? 1 : 1 - seg(t, el.out, 0.35)) }}>
        <Rich text={el.text} th={th} />
      </div>
    );
  }
  return (
    <Place el={el} ctx={ctx} def="under">
      <div data-box={name} style={style}>
        <Rich text={el.text} th={th} />
      </div>
    </Place>
  );
};

const Title: C = ({ el, ctx }) => {
  const { t, th } = ctx;
  const o = el.out == null ? 1 : 1 - seg(t, el.out, 0.35);
  if (o <= 0 || t < el.in - 0.1) return null;
  const words: string[] = String(el.text ?? ctx.paper.title).split(" ");
  const ins: number[] = el.ins ?? words.map((_, i) => el.in + i * 0.12);
  const hl: string[] = el.hl ? String(el.hl).split(" ") : [];
  let hs = -1;
  for (let i = 0; hl.length && i + hl.length <= words.length; i++) if (words.slice(i, i + hl.length).join(" ") === hl.join(" ")) hs = i;
  const hlIn = el.hlIn ?? (hs >= 0 ? ins[hs + hl.length - 1] + 0.1 : 0);
  const pulse = el.pulseIn != null ? Math.sin(Math.PI * seg(t, el.pulseIn, 0.5)) : 0;
  const a = area(el.area ?? "title", ctx.row);
  return (
    <div style={{ position: "absolute", left: a.x, top: a.y + (el.dy ?? 14), width: a.w, display: "flex", justifyContent: "center", opacity: o, transform: `scale(${1 + 0.05 * pulse})` }}>
      <div data-box="title" style={{ display: "flex", flexWrap: el.wrap ? "wrap" : "nowrap", justifyContent: "center", maxWidth: el.wrap ? (el.maxw ?? 1500) : undefined, columnGap: "0.26em", rowGap: 6, fontFamily: F.serif, fontWeight: 600, fontSize: sz(el.size, 92), lineHeight: 1.05, color: th.ink, whiteSpace: "nowrap" }}>
        {words.map((w, i) => {
          const p = seg(t, ins[i] - 0.05, 0.3);
          const inHl = hs >= 0 && i >= hs && i < hs + hl.length;
          return (
            <span key={i} style={{ position: "relative", opacity: p, transform: `translateY(${(1 - eo(p)) * 18}px)` }}>
              {inHl ? <span style={{ position: "absolute", left: i === hs ? -10 : -16, right: i === hs + hl.length - 1 ? -10 : -16, top: "18%", bottom: "4%", background: th.mark, transform: `scaleX(${eo(seg(t, hlIn + (i - hs) * 0.08, 0.3))})`, transformOrigin: "0 50%" }} /> : null}
              <span style={{ position: "relative", color: inHl && th.dark ? th.markInk : th.ink }}>{w}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};

const Chips: C = ({ el, ctx }) => {
  const { t, th } = ctx;
  return (
    <Place el={el} ctx={ctx} def="top">
      <div style={{ display: "flex", gap: el.gap ?? 44, alignItems: "flex-start" }}>
        {el.items.map((it: any, i: number) => {
          const p = seg(t, it.in, 0.3);
          const gp = seg(t, it.gin ?? it.in + 0.3, 0.3);
          return (
            <div key={i} data-box={p > 0 ? `chip "${it.term}"` : undefined} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: Math.min(1, p * 2) }}>
              <span style={{ fontFamily: F.sans, fontWeight: 700, fontSize: sz(el.size, 48), lineHeight: 1.1, color: roleColor(th, it.c), transform: `scale(${0.7 + 0.3 * back(p)})`, whiteSpace: "nowrap" }}>
                <Rich text={it.term} th={th} />
              </span>
              {it.gloss ? (
                <span style={{ fontFamily: F.sans, fontWeight: 500, fontSize: el.gsize ?? 36, lineHeight: 1.15, color: th.muted, whiteSpace: "pre", textAlign: "center", opacity: gp }}>
                  <Rich text={it.gloss} th={th} />
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </Place>
  );
};

const Formula: C = ({ el, ctx }) => {
  const { t, th } = ctx;
  const parts = el.parts ?? [{ tex: el.tex, in: el.in }];
  return (
    <Place el={el} ctx={ctx} def="top">
      <div data-box="formula" style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: F.serif, fontWeight: 500, fontSize: sz(el.size, 66), lineHeight: 1.1, color: th.ink, whiteSpace: "nowrap" }}>
        {parts.map((pt: any, i: number) => {
          const p = seg(t, pt.in, 0.3);
          return (
            <span key={i} style={{ opacity: p, transform: `translateY(${(1 - eo(p)) * 14}px)`, display: "inline-flex", alignItems: "center" }}>
              <Tex n={parseTex(pt.tex)} th={th} />
            </span>
          );
        })}
      </div>
    </Place>
  );
};

const Stats: C = ({ el, ctx }) => {
  const { t, th } = ctx;
  return (
    <Place el={el} ctx={ctx} def="top">
      <div style={{ display: "flex", gap: el.gap ?? 70, alignItems: "flex-start" }}>
        {el.items.map((it: any, k: number) => {
          const p = seg(t, it.in, 0.3);
          return (
            <div key={k} data-box={p > 0 ? `stat "${it.big}"` : undefined} style={{ textAlign: "center", opacity: Math.min(1, p * 2), transform: `scale(${0.8 + 0.2 * back(p)})` }}>
              <div style={{ fontFamily: F.serif, fontWeight: 600, fontSize: sz(el.size, 112), lineHeight: 1.1, color: roleColor(th, it.c), whiteSpace: "nowrap" }}>
                <span style={{ position: "relative", padding: "0 10px" }}>
                  {it.hlIn != null ? <span style={{ position: "absolute", left: 0, right: 0, top: "20%", bottom: "8%", background: th.mark, borderRadius: 12, transform: `scaleX(${eo(seg(t, it.hlIn, 0.45))})`, transformOrigin: "0 50%" }} /> : null}
                  <span style={{ position: "relative" }}>{it.big}</span>
                </span>
              </div>
              {it.sub ? <div style={{ fontFamily: F.sans, fontWeight: 500, fontSize: 36, lineHeight: 1.3, color: th.muted, whiteSpace: "pre-line" }}>{it.sub}</div> : null}
            </div>
          );
        })}
      </div>
    </Place>
  );
};

const Bars: C = ({ el, ctx }) => {
  const { t, th } = ctx;
  const h = el.h ?? 300;
  const bw = el.bw ?? 120;
  const max = el.max ?? Math.max(...el.items.map((i: any) => i.v));
  return (
    <Place el={el} ctx={ctx} def="under">
      <div style={{ display: "flex", gap: el.gap ?? 56, alignItems: "flex-start" }}>
        {el.items.map((it: any, k: number) => {
          const at = it.in ?? el.in + k * 0.25;
          const p = eo(seg(t, at, 0.6));
          const col = roleColor(th, it.c ?? "pen");
          return (
            <div key={k} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: bw + 60 }}>
              <div style={{ height: h + 56, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" }}>
                <div data-box={seg(t, at + 0.3, 0.3) > 0.4 ? `bar value "${it.label}"` : undefined} style={{ fontFamily: F.sans, fontWeight: 700, fontSize: el.vsize ?? 40, color: it.c ? col : th.ink, opacity: seg(t, at + 0.3, 0.3), marginBottom: 8, whiteSpace: "nowrap" }}>
                  {it.text ?? `${it.v}${el.unit ?? ""}`}
                </div>
                <div style={{ width: bw, height: h * ((it.to ? lerp(it.v, it.to.v, eio(seg(t, it.to.in, 0.9))) : it.v) / max) * p, background: it.to && t > it.to.in && it.to.c ? roleColor(th, it.to.c) : col, borderRadius: "10px 10px 0 0", opacity: it.dim ? 0.35 : 1 }} />
              </div>
              <div style={{ height: 4, width: bw + 40, background: th.ink }} />
              <div data-box={`bar label "${it.label}"`} style={{ marginTop: 10, fontFamily: F.sans, fontWeight: 500, fontSize: el.lsize ?? 32, lineHeight: 1.2, color: th.muted, whiteSpace: "pre-line", textAlign: "center", opacity: seg(t, at, 0.3) }}>
                {it.label}
              </div>
            </div>
          );
        })}
      </div>
    </Place>
  );
};

const Table: C = ({ el, ctx }) => {
  const { t, th } = ctx;
  return (
    <Place el={el} ctx={ctx} def="under">
      <div data-box="table" style={{ display: "grid", gridTemplateColumns: `repeat(${el.cols.length}, auto)`, columnGap: 40, rowGap: 10, fontFamily: F.mono, fontSize: sz(el.size, 34), color: th.ink, alignItems: "baseline" }}>
        {el.cols.map((c: string, i: number) => (
          <span key={`h${i}`} style={{ color: th.muted, fontWeight: 500 }}>
            {c}
          </span>
        ))}
        {el.rows.map((r: unknown[], ri: number) =>
          r.map((cell, ci) => (
            <span key={`${ri}-${ci}`} style={{ fontWeight: el.hl?.includes(ri) ? 700 : 400, color: el.hl?.includes(ri) ? th.pen : th.ink, opacity: seg(t, el.rowIns?.[ri] ?? el.in, 0.3), whiteSpace: "nowrap" }}>
              <Rich text={String(cell)} th={th} />
            </span>
          )),
        )}
      </div>
    </Place>
  );
};

const Grid: C = ({ el, ctx }) => {
  const { t, th } = ctx;
  const cell = el.cell ?? 12;
  const step = cell + 2;
  return (
    <Place el={el} ctx={ctx} def="under">
      <div style={{ display: "flex", gap: 70, alignItems: "flex-end" }}>
        {el.items.map((it: any, k: number) => {
          const rows = Math.floor(it.n * seg(t, it.in, it.dur ?? 0.6));
          const col = roleColor(th, it.c ?? "red");
          return (
            <div key={k} style={{ display: "flex", alignItems: "flex-end", gap: 18, opacity: seg(t, it.in, 0.2) }}>
              <svg width={it.n * step} height={it.n * step}>
                {Array.from({ length: rows * it.n }, (_, q) => (
                  <rect key={q} x={(q % it.n) * step} y={Math.floor(q / it.n) * step} width={cell} height={cell} rx={2} fill={col} opacity={0.8} />
                ))}
              </svg>
              {it.label ? (
                <div data-box={`grid label "${it.label}"`} style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 40, lineHeight: 1.25, color: col, whiteSpace: "pre-line", opacity: seg(t, it.lin ?? it.in + 0.5, 0.3) }}>
                  <Rich text={it.label} th={th} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Place>
  );
};

const Stack: C = ({ el, ctx }) => {
  const { t, th } = ctx;
  const bo = el.box ? seg(t, el.box.in, 0.4) : 0;
  const items: React.ReactNode[] = [];
  el.items.forEach((it: any, k: number) => {
    const col = roleColor(th, it.c ?? "pen");
    if (k > 0 && el.arrow !== false)
      items.push(
        <svg key={`a${k}`} width={90} height={40} style={{ alignSelf: "center", opacity: seg(t, it.in - 0.2, 0.4) }}>
          <path d="M 4 20 H 80 M 66 8 L 82 20 L 66 32" fill="none" stroke={th.muted} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>,
      );
    items.push(
      <div key={k} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div data-box={seg(t, it.in, 0.3) > 0.4 ? `stack "${it.label}"` : undefined} style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 50, lineHeight: 1.1, color: col, opacity: seg(t, it.in, 0.3), whiteSpace: "nowrap" }}>
          <Rich text={it.label} th={th} />
        </div>
        <div style={{ display: "flex", flexDirection: "column-reverse", gap: 9 }}>
          {Array.from({ length: it.n }, (_, q) => (
            <div key={q} style={{ width: el.w ?? 400, height: 30, borderRadius: 9, boxSizing: "border-box", border: `3.5px solid ${col}`, background: `${col}29`, opacity: seg(t, it.in + 0.15 + q * 0.1, 0.25) }} />
          ))}
        </div>
      </div>,
    );
  });
  return (
    <Place el={el} ctx={ctx} def="top">
      <div style={{ position: "relative", display: "flex", gap: 30, alignItems: "flex-end", padding: el.box ? "84px 44px 28px" : 0 }}>
        {el.box ? <div style={{ position: "absolute", inset: 0, border: `4px dashed ${th.ink}`, borderRadius: 26, opacity: bo }} /> : null}
        {el.box ? (
          <div data-box={bo > 0.4 ? "stack box" : undefined} style={{ position: "absolute", left: 30, top: 14, fontFamily: F.serif, fontWeight: 600, fontSize: 56, lineHeight: 1.1, color: th.ink, opacity: bo, background: th.mark, borderRadius: 10, padding: "0 14px" }}>
            {el.box.label}
          </div>
        ) : null}
        {items}
      </div>
    </Place>
  );
};

const est = (s: string, fs: number) => Math.max(...String(s).split("\n").map((l) => l.replace(/[{}*~]|[a-z]+[0-9]?:/g, "").length)) * fs * 0.56;
const Diagram: C = ({ el, ctx }) => {
  const { t, th } = ctx;
  const a = area(el.area ?? "full", ctx.row);
  const fs = sz(el.size, 48);
  const vo = el.out == null ? 1 : 1 - seg(t, el.out, 0.4);
  if (vo <= 0 || t < el.in - 0.1) return null;
  const pos: Record<string, { x: number; y: number; hw: number; hh: number }> = {};
  for (const n of el.nodes) {
    const lines = String(n.text).split("\n").length;
    pos[n.id] = { x: a.x + n.x * a.w, y: a.y + n.y * a.h, hw: est(n.text, n.size ?? fs) / 2 + 26, hh: ((n.size ?? fs) * 1.2 * lines) / 2 + 14 };
  }
  const clip = (A: { x: number; y: number; hw: number; hh: number }, tx: number, ty: number) => {
    const dx = tx - A.x;
    const dy = ty - A.y;
    const s = Math.min(Math.abs(dx) > 1e-6 ? A.hw / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-6 ? A.hh / Math.abs(dy) : Infinity, 1);
    return [A.x + dx * s, A.y + dy * s];
  };
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, opacity: vo }}>
      <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
        {(el.edges ?? []).map((e: any, k: number) => {
          const A = pos[e.a];
          const B = pos[e.b];
          if (!A || !B) return null;
          const at = e.in ?? el.in;
          const p = eio(seg(t, at, 0.5));
          const o = e.out != null ? 1 - seg(t, e.out, 0.35) : 1;
          if (p <= 0 || o <= 0) return null;
          const [x1, y1] = clip(A, B.x, B.y);
          const [x2, y2] = clip(B, A.x, A.y);
          const bend = e.bend ?? 0;
          const mx = (x1 + x2) / 2 - bend * (y2 - y1) * 0.3;
          const my = (y1 + y2) / 2 + bend * (x2 - x1) * 0.3;
          const ang = Math.atan2(y2 - my, x2 - mx);
          const col = roleColor(th, e.c ?? "muted");
          const L = 18;
          return (
            <g key={k} opacity={o}>
              <path d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`} fill="none" stroke={col} strokeWidth={e.w ?? 5} strokeLinecap="round" pathLength={1} strokeDasharray={e.dash ? undefined : 1} strokeDashoffset={e.dash ? undefined : 1 - p} style={e.dash ? { strokeDasharray: "4 14", opacity: p } : undefined} />
              {e.head !== false && p > 0.9 ? <path d={`M ${x2 - L * Math.cos(ang - 0.45)} ${y2 - L * Math.sin(ang - 0.45)} L ${x2} ${y2} L ${x2 - L * Math.cos(ang + 0.45)} ${y2 - L * Math.sin(ang + 0.45)}`} fill="none" stroke={col} strokeWidth={e.w ?? 5} strokeLinecap="round" strokeLinejoin="round" /> : null}
            </g>
          );
        })}
      </svg>
      {(el.edges ?? []).map((e: any, k: number) => {
        if (!e.label) return null;
        const A = pos[e.a];
        const B = pos[e.b];
        if (!A || !B) return null;
        const o = seg(t, (e.in ?? el.in) + 0.3, 0.3) * (e.out != null ? 1 - seg(t, e.out, 0.35) : 1);
        if (o <= 0) return null;
        const bend = e.bend ?? 0;
        const lx = (A.x + B.x) / 2 - bend * (B.y - A.y) * 0.15;
        const ly = (A.y + B.y) / 2 + bend * (B.x - A.x) * 0.15;
        return (
          <div key={`l${k}`} data-box={`edge "${e.label}"`} style={{ position: "absolute", left: lx, top: ly + (e.ldy ?? -40), transform: "translate(-50%, -50%)", fontFamily: F.sans, fontWeight: 600, fontSize: e.lsize ?? 32, color: roleColor(th, e.lc ?? e.c ?? "muted"), background: th.bg, padding: "0 10px", borderRadius: 8, whiteSpace: "nowrap", opacity: o }}>
            <Rich text={e.label} th={th} />
          </div>
        );
      })}
      {el.nodes.map((n: any) => {
        const P = pos[n.id];
        const at = n.in ?? el.in;
        const o = vis(t, at, n.out);
        if (o <= 0) return null;
        const col = roleColor(th, n.c ?? "ink");
        const kind = n.kind ?? "box";
        return (
          <div
            key={n.id}
            data-box={`node ${n.id}`}
            style={{
              position: "absolute",
              left: P.x,
              top: P.y,
              transform: `translate(-50%, -50%) scale(${0.75 + 0.25 * back(seg(t, at, 0.3))})`,
              opacity: o,
              fontFamily: n.serif ? F.serif : F.sans,
              fontWeight: n.serif ? 600 : 700,
              fontSize: n.size ?? fs,
              lineHeight: 1.2,
              textAlign: "center",
              whiteSpace: "pre-line",
              color: kind === "pill" ? "#fff" : kind === "mark" ? th.markInk : col,
              background: kind === "pill" ? col : kind === "mark" ? th.mark : kind === "text" ? "transparent" : th.card,
              border: kind === "box" ? `4px solid ${col}` : "none",
              borderRadius: kind === "pill" ? 999 : 16,
              padding: kind === "text" ? 0 : "10px 22px",
            }}
          >
            <Rich text={n.text} th={th} />
          </div>
        );
      })}
    </div>
  );
};

const Boxes: C = ({ el, ctx }) => {
  const { t, th } = ctx;
  return (
    <Place el={el} ctx={ctx} def="under">
      <div data-box="boxes" style={{ display: "flex", gap: el.gap ?? 12, flexWrap: "nowrap" }}>
        {el.items.map((s: string, i: number) => {
          const at = el.ins?.[i] ?? el.in + i * (el.stagger ?? 0.05);
          const p = seg(t, at, 0.25);
          const hl = el.hl?.includes(i) && t >= (el.hlIn ?? at);
          return (
            <div key={i} style={{ fontFamily: el.serif ? F.serif : F.mono, fontSize: sz(el.size, 40), fontWeight: 600, padding: "6px 14px", borderRadius: 12, border: `3px solid ${roleColor(th, hl ? (el.hc ?? "pen") : (el.c ?? "faint"))}`, background: hl ? th.mark : th.card, color: th.ink, opacity: p, transform: `scale(${0.8 + 0.2 * back(p)})`, whiteSpace: "nowrap" }}>
              <Rich text={s} th={th} />
            </div>
          );
        })}
      </div>
    </Place>
  );
};

const End: C = ({ el, ctx }) => {
  const { th } = ctx;
  return (
    <Place el={el} ctx={ctx} def="under">
      <div data-box="end" style={{ textAlign: "center" }}>
        <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: el.size ?? 56, lineHeight: 1.2, color: th.ink, whiteSpace: "nowrap" }}>
          <span style={{ borderBottom: `6px solid ${th.pen}`, paddingBottom: 4 }}>{el.link ?? ctx.paper.link}</span>
        </div>
        <div style={{ marginTop: 22, fontFamily: F.sans, fontWeight: 500, fontSize: 38, color: th.muted }}>{el.byline ?? ctx.paper.byline}</div>
      </div>
    </Place>
  );
};

// Cards: where each thing lives in the paper. A card may hold a small copy of any
// free element ("pic"), scaled down.
const Cards: C = ({ el, ctx }) => {
  const { t, th } = ctx;
  const a = area(el.area ?? "full", ctx.row);
  const cols = el.cols ?? 3;
  const rows = Math.ceil(el.items.length / cols);
  const gap = 40;
  const cw = (a.w - (cols - 1) * gap) / cols;
  const ch = Math.min(el.ch ?? 330, (a.h - (el.dy ?? 60) - (rows - 1) * gap) / rows);
  const top = a.y + (el.dy ?? 60);
  const o = el.out == null ? 1 : 1 - seg(t, el.out, 0.4);
  if (o <= 0 || t < el.in - 0.2) return null;
  return (
    <>
      {el.items.map((it: any, k: number) => {
        const x = a.x + (k % cols) * (cw + gap);
        const y = top + Math.floor(k / cols) * (ch + gap);
        const ghost = seg(t, el.in + k * 0.07, 0.3);
        const p = seg(t, it.in - 0.05, 0.35);
        return (
          <div key={k} data-box={p > 0 ? `card "${it.tag}"` : undefined} style={{ position: "absolute", left: x, top: y + (1 - eo(p)) * 14, width: cw, height: ch, boxSizing: "border-box", borderRadius: 26, border: p > 0 ? `4px solid ${th.ink}` : `4px dashed ${th.faint}`, background: p > 0 ? th.card : "transparent", opacity: (p > 0 ? 1 : ghost) * o, padding: "22px 26px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {p > 0 ? (
              <>
                <div style={{ alignSelf: "flex-start", position: "relative", fontFamily: F.mono, fontWeight: 700, fontSize: 34, lineHeight: 1.2, color: th.ink, padding: "0 10px", whiteSpace: "nowrap" }}>
                  <span style={{ position: "absolute", left: 0, right: 0, top: 4, bottom: 0, background: th.mark, borderRadius: 8, transform: `scaleX(${eo(seg(t, it.in, 0.4))})`, transformOrigin: "0 50%" }} />
                  <span style={{ position: "relative" }}>{it.tag}</span>
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
                  {it.pic ? <div style={{ transform: `scale(${it.pic.scale ?? 0.5})` }}>{renderEl({ ...it.pic, in: it.in + 0.15, out: null, area: "inline" }, ctx)}</div> : null}
                </div>
                <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 34, lineHeight: 1.15, color: th.pen, opacity: seg(t, it.nin ?? it.in + 0.3, 0.25) }}>
                  <Rich text={it.note} th={th} />
                </div>
              </>
            ) : null}
          </div>
        );
      })}
    </>
  );
};


// The model as a tower of layers over the question: one column per word, layer 0 at
// the bottom. Waves of signal run upward ("ins"; "reflows" in red from a given layer),
// a band marks a stretch of layers, a lens rides one column and shows what it reads.
const pulse = (x: number) => (x < 0 ? 0 : x < 0.15 ? x / 0.15 : Math.max(0, 1 - (x - 0.15) / 0.6));
const Tower: C = ({ el, ctx }) => {
  const r = ctx.row!;
  const { t, th } = ctx;
  const vo = vis(t, el.in, el.out, 0.3, 0.4) * (ctx.dip ?? 1);
  if (vo <= 0) return null;
  const L: number = el.layers ?? 9;
  const yB = r.top - 44;
  const yT: number = el.topY ?? 290;
  const step = (yB - yT) / (L - 1);
  const ly = (l: number) => yB - l * step;
  const n = r.boxes.length;
  const cx = r.boxes.map((_, i) => cxOf(r, i));
  const gaps = cx.slice(1).map((x, i) => x - cx[i]);
  const cw = Math.max(30, Math.min(110, (gaps.length ? Math.min(...gaps) : 140) * 0.78));
  const chh = Math.min(42, step * 0.62);
  const build: number = el.build ?? 1.2;
  const per = build / L;
  const g0: number = el.growIn ?? el.in; // the layers can grow later than the answer shows
  const waves = [...(el.ins ?? []).map((a: number) => ({ at: a, from: 0, c: th.pen })), ...(el.reflows ?? []).map((w: any) => ({ at: w.in, from: w.from ?? 0, c: th.red }))];
  const band = el.band;
  const bo = band ? vis(t, band.in, band.out) : 0;
  const off = el.off ? vis(t, el.off.in, el.off.out) : 0;
  const last = n - 1;
  const ac = el.answerCol == null || el.answerCol === "last" ? last : el.answerCol;
  const lc = el.lens?.col == null || el.lens.col === "last" ? last : el.lens.col;
  const left = r.boxes[0].x - 34;
  const yAns = yT - step * 0.5 - 52;
  const cells: React.ReactNode[] = [];
  for (let l = 0; l < L; l++)
    for (let c = 0; c < n; c++) {
      const p = seg(t, g0 + l * per, per * 2);
      if (p <= 0) continue;
      let g = 0;
      let gc = th.pen;
      for (const w of waves)
        if (l >= w.from) {
          const v = pulse(t - (w.at + (l - w.from) * per * 0.8));
          if (v > g) {
            g = v;
            gc = w.c;
          }
        }
      const dead = off > 0 && band && l >= band.from && l <= band.to;
      cells.push(
        <g key={`${l}-${c}`} opacity={p}>
          <rect x={cx[c] - cw / 2} y={ly(l) - chh / 2} width={cw} height={chh} rx={7} fill={th.card} stroke={dead ? th.muted : th.faint} strokeWidth={2.5} />
          <rect x={cx[c] - cw / 2} y={ly(l) - chh / 2} width={cw} height={chh} rx={7} fill={dead ? th.muted : gc} opacity={dead ? 0.45 * off : 0.08 + 0.6 * g} />
        </g>,
      );
    }
  // answer on top
  const steps: any[] = el.answer ?? [];
  let ak = -1;
  for (let s = 0; s < steps.length; s++) if (t >= steps[s].in) ak = s;
  const aCur = ak >= 0 ? steps[ak] : null;
  const aFlip = ak > 0 ? Math.abs(Math.cos(Math.PI * Math.min(1, seg(t, steps[ak].in - 0.15, 0.3)))) : 1;
  // lens
  const stops: any[] = el.lens?.stops ?? [];
  let k = -1;
  for (let s = 0; s < stops.length; s++) if (t >= stops[s].in) k = s;
  const R: number = el.lens?.r ?? 70;
  let lens: React.ReactNode = null;
  if (k >= 0 && !(el.lens.out != null && t > el.lens.out + 0.4)) {
    // a stop with hide: true puts the lens away; the next stop brings it back where it says
    const raw = stops[k];
    const prev0 = k > 0 ? stops[k - 1] : null;
    const cur = raw.hide ? { ...(prev0 ?? raw), in: raw.in, note: "" } : raw;
    const prev = raw.hide || prev0?.hide ? null : prev0;
    const mv = eio(seg(t, cur.in, 0.6));
    const layer = prev ? lerp(prev.layer, cur.layer, mv) : cur.layer;
    const x = cx[lc];
    const y = ly(layer);
    const shown = prev0?.hide ? raw.in : stops[0].in;
    const lo = seg(t, shown, 0.35) * (raw.hide ? 1 - seg(t, raw.in, 0.35) : 1) * (el.lens.out != null ? 1 - seg(t, el.lens.out, 0.4) : 1);
    const moved = !raw.hide && prev && prev.layer !== cur.layer;
    const swapped = !raw.hide && prev && !moved && prev.text !== cur.text;
    const tp = seg(t, cur.in, 0.45);
    const fs = (s: string) => Math.min(44, 250 / Math.max(1, String(s).replace(/[*~{}]|[a-z]+:/g, "").length));
    const word = (s: string, c: string | undefined, o: number, tf = "none", strike = false) =>
      s ? (
        <span style={{ position: "absolute", fontFamily: F.serif, fontWeight: 600, fontSize: fs(s), lineHeight: 1, color: strike ? th.red : roleColor(th, c ?? "pen"), opacity: o, transform: tf, textDecoration: strike ? "line-through" : "none", whiteSpace: "nowrap" }}>
          <Rich text={s} th={th} />
        </span>
      ) : null;
    lens = (
      <>
        <div style={{ position: "absolute", left: x + R * 0.62, top: y + R * 0.62, width: 16, height: 62, borderRadius: 8, background: th.ink, transform: "rotate(-45deg)", transformOrigin: "50% 0", opacity: lo }} />
        <div data-box="lens" style={{ position: "absolute", left: x - R, top: y - R, width: 2 * R, height: 2 * R, boxSizing: "border-box", borderRadius: "50%", border: `7px solid ${th.ink}`, background: th.card, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", opacity: lo, transform: `scale(${back(seg(t, shown, 0.35))})` }}>
          {moved ? (
            <>
              {word(prev.text, prev.c, Math.max(0, 1 - 2 * mv))}
              {word(cur.text, cur.c, Math.max(0, 2 * mv - 1))}
            </>
          ) : swapped ? (
            <>
              {tp < 1 ? word(prev.text, prev.c, 1 - tp, `translate(${tp * 70}px, ${-tp * 60}px) rotate(${tp * 20}deg)`, true) : null}
              {word(cur.text, cur.c, seg(t, cur.in + 0.25, 0.3), `translateY(${(1 - eo(seg(t, cur.in + 0.25, 0.35))) * -40}px)`)}
            </>
          ) : (
            word(cur.text, cur.c, 1)
          )}
        </div>
        {cur.note ? (
          <div data-box={`lens note "${String(cur.note).slice(0, 20)}"`} style={{ position: "absolute", left: x + R + 46, top: y - 40, fontFamily: F.sans, fontWeight: 700, fontSize: el.lens.nsize ?? 34, lineHeight: 1.15, color: roleColor(th, cur.nc ?? "ink"), whiteSpace: "pre", opacity: seg(t, cur.in + (moved ? 0.4 : 0.1), 0.3) * lo }}>
            <Rich text={cur.note} th={th} />
          </div>
        ) : null}
      </>
    );
  }
  const labels: [string, number][] = el.labels === false ? [] : [["answer", yAns + 30], ["top", ly(L - 1)], ["bottom", ly(0)], ["question", r.top + r.size / 2]];
  // bubbles: a thought floating where a layer will be, before or over the tower
  const bubbles = (el.bubbles ?? []).map((b: any, i: number) => {
    const o = vis(t, b.in, b.out, 0.35, 0.4);
    if (o <= 0) return null;
    const bc = roleColor(th, b.c ?? "pen");
    return (
      <div key={`bb${i}`} data-box={`bubble "${b.text}"`} style={{ position: "absolute", left: b.col != null ? cx[b.col] : (cx[0] + cx[last]) / 2, top: ly(b.layer ?? 4), transform: `translate(-50%, -50%) scale(${back(seg(t, b.in, 0.35))})`, opacity: o, fontFamily: F.serif, fontWeight: 600, fontSize: b.size ?? 64, lineHeight: 1.1, color: bc, border: `5px dashed ${bc}`, borderRadius: 999, padding: "10px 44px", background: th.card, whiteSpace: "nowrap" }}>
        <Rich text={b.text} th={th} />
        {b.note ? (
          <div style={{ position: "absolute", left: "50%", top: "100%", marginTop: 20, transform: "translateX(-50%)", fontFamily: F.sans, fontWeight: 700, fontSize: 38, lineHeight: 1.15, textAlign: "center", color: roleColor(th, b.nc ?? "red"), opacity: seg(t, b.nin ?? b.in, 0.3), whiteSpace: "pre" }}>
            <Rich text={b.note} th={th} />
          </div>
        ) : null}
      </div>
    );
  });
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, opacity: vo }}>
      <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
        {band && bo > 0 ? <rect x={cx[0] - cw / 2 - 18} y={ly(band.to) - step / 2} width={cx[last] - cx[0] + cw + 36} height={(band.to - band.from + 1) * step} rx={18} fill={off > 0 ? th.faint : th.mark} opacity={0.6 * bo} /> : null}
        {cx.map((x, c) => (
          <line key={`v${c}`} x1={x} y1={r.top - 8} x2={x} y2={ly(L - 1)} stroke={th.faint} strokeWidth={2} opacity={seg(t, g0, build)} />
        ))}
        {cells}
      </svg>
      {labels.map(([s, y], i) => (
        <div key={s} data-box={`tower label ${s}`} style={{ position: "absolute", right: 1920 - left, top: y, transform: "translateY(-50%)", fontFamily: F.sans, fontWeight: 600, fontSize: 30, color: th.muted, opacity: seg(t, g0 + build * (i === 0 ? 1 : i === 3 ? 0 : 0.5), 0.4), whiteSpace: "nowrap" }}>
          {s}
        </div>
      ))}
      {band && bo > 0 && band.label ? (
        <div data-box="band label" style={{ position: "absolute", right: 1920 - left, top: (ly(band.from) + ly(band.to)) / 2, transform: "translateY(-50%)", textAlign: "right", fontFamily: F.sans, fontWeight: 700, fontSize: 40, lineHeight: 1.15, color: th.ink, opacity: bo, whiteSpace: "pre", background: th.bg, padding: "4px 0 4px 10px" }}>
          <Rich text={band.label} th={th} />
        </div>
      ) : null}
      {aCur && aCur.text ? (
        <div data-box="tower answer" style={{ position: "absolute", left: cx[ac], top: yAns, transform: `translateX(-50%) scaleY(${aFlip})`, fontFamily: F.serif, fontWeight: 600, fontSize: 52, lineHeight: 1.1, color: roleColor(th, aCur.c ?? "ink"), border: `4px solid ${roleColor(th, aCur.c ?? "ink")}`, borderRadius: 16, background: th.card, padding: "2px 22px", whiteSpace: "nowrap", opacity: seg(t, steps[0].in, 0.3) }}>
          <Rich text={aCur.text} th={th} />
        </div>
      ) : null}
      {bubbles}
      {lens}
    </div>
  );
};

const Missing: C = ({ el, ctx }) => (
  <div data-box={`ERROR ${el.t}`} style={{ position: "absolute", left: 80, top: 100, fontFamily: F.mono, fontSize: 30, color: ctx.th.red }}>
    unknown element “{el.t}” or it needs the row
  </div>
);

export const BACK: Record<string, C> = { mark: Mark, underline: Underline };
export const SVG: Record<string, C> = { arcs: Arcs };
const FRONT: Record<string, C> = { svg: Svg, tower: Tower, strike: Strike, tokens: Tokens, values: Values, label: Label, title: Title, chips: Chips, formula: Formula, stats: Stats, bars: Bars, table: Table, grid: Grid, stack: Stack, diagram: Diagram, cards: Cards, end: End, boxes: Boxes };
export const ROW_ONLY = new Set(["tower", "mark", "underline", "strike", "arcs", "tokens", "values", "dim", "swap", "replace"]);
export const MODIFIERS = new Set(["dim", "swap", "replace"]);

export function renderEl(el: El, ctx: Ctx): React.ReactNode {
  if (MODIFIERS.has(el.t) || BACK[el.t] || SVG[el.t]) return null;
  const Comp = (ROW_ONLY.has(el.t) && !ctx.row) || !FRONT[el.t] ? Missing : FRONT[el.t];
  return <Comp el={el} ctx={ctx} />;
}
