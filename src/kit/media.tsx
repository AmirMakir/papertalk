/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Freeze, OffthreadVideo, Sequence, staticFile } from "remotion";
import { back, eo, seg } from "../lib";
import { F, FPS } from "../theme";
import type { Ctx, El } from "./els";

// A piece of a finished video, playing in a framed window.
//   { "t": "clip", "src": "clips/jspace.mp4", "from": 31, "in": "3", "out": "4",
//     "x": 960, "y": 470, "w": 1280, "crop": 0.86, "label": "Anthropic's J-space paper" }
// x, y: centre of the window; w: its width (16:9). "from": seconds into the source.
// "sound": 1 plays the clip's own audio at that volume (leave a pause in the narration for it);
// "cut": true skips the zoom-in, for a clip that replaces another one in the same window.
// "mask": 0.86 covers the source below 86% of its height, e.g. its own captions, keeping the window size.
// In a check, the frame shows the source at the matching moment.
export const Clip: React.FC<{ el: El; ctx: Ctx }> = ({ el, ctx }) => {
  const { t, th } = ctx;
  const o = seg(t, el.in, 0.35) * (el.out == null ? 1 : 1 - seg(t, el.out, 0.35));
  if (o <= 0 || t < el.in - 0.4) return null;
  const w: number = el.w ?? 1280;
  const full = (w * 9) / 16;
  // crop: keep only the top part of the source, e.g. 0.86 hides its own caption line
  const h = full * (el.crop ?? 1);
  const x: number = el.x ?? 960;
  const y: number = el.y ?? 470;
  const src = staticFile(el.src);
  const at = Math.max(0, t - el.in);
  const startFrame = Math.round((el.from ?? 0) * FPS);
  const vol: number = el.sound ?? 0;
  const len = el.out == null ? 1e9 : (el.out - el.in) * FPS;
  const ramp = 0.25 * FPS;
  // the clip's own sound fades in and out with the window, so a cut never clicks
  const volume = (f: number) => Math.max(0, Math.min(1, f / ramp, (len - f) / ramp)) * vol;
  const video = <OffthreadVideo src={src} muted={!vol} volume={vol ? volume : undefined} trimBefore={startFrame} style={{ width: w, height: full, display: "block" }} />;
  return (
    <div style={{ position: "absolute", left: x - w / 2, top: y - h / 2, width: w, height: h, opacity: o, transform: el.cut ? undefined : `scale(${0.94 + 0.06 * eo(seg(t, el.in, 0.5))})` }}>
      <div data-box={`clip ${el.src}`} style={{ position: "absolute", inset: 0, borderRadius: 18, overflow: "hidden", border: `4px solid ${th.ink}`, boxShadow: "0 24px 60px rgba(0,0,0,0.18)", background: th.card }}>
        {ctx.check ? (
          <Freeze frame={Math.round(at * FPS)}>{video}</Freeze>
        ) : (
          <Sequence from={Math.round(el.in * FPS)} layout="none">
            {video}
          </Sequence>
        )}
        {el.mask ? <div style={{ position: "absolute", left: 0, right: 0, top: full * el.mask, bottom: 0, background: th.bg }} /> : null}
      </div>
      {el.label ? (
        <div data-box={`clip label`} style={{ position: "absolute", left: 0, top: h + 18, fontFamily: F.sans, fontWeight: 700, fontSize: el.lsize ?? 32, color: th.muted, whiteSpace: "nowrap", opacity: seg(t, el.in + 0.3, 0.3) }}>
          {el.label}
        </div>
      ) : null}
    </div>
  );
};

// A terminal window whose lines appear on cue. Commands type themselves out.
//   { "t": "terminal", "in": "2", "title": "claude", "x": 960, "y": 470, "w": 1300,
//     "lines": [ { "in": "2:link", "text": "/papertalk:explain https://…", "kind": "cmd" },
//                { "in": "4", "text": "✓ no overlaps, nothing cut off", "kind": "ok" } ] }
// kind: cmd (typed, with a prompt), out, ok (green), dim, pen (blue), warn (amber), head (bold).
// keep: how many lines stay before it scrolls; the window's height fits them, or set "rows".
export const Terminal: React.FC<{ el: El; ctx: Ctx }> = ({ el, ctx }) => {
  const { t, th } = ctx;
  const o = seg(t, el.in, 0.35) * (el.out == null ? 1 : 1 - seg(t, el.out, 0.35));
  if (o <= 0) return null;
  const w: number = el.w ?? 1300;
  const x: number = el.x ?? 960;
  const y: number = el.y ?? 470;
  const size: number = el.size ?? 30;
  const all: any[] = el.lines ?? [];
  const lines = all.filter((l: any) => t >= l.in - 0.05);
  const keep: number = el.keep ?? 11; // the window scrolls: only the last lines stay
  const shown = lines.slice(-keep);
  const col = (k?: string) => (k === "ok" ? th.val : k === "dim" ? "#8b8f98" : k === "pen" ? "#7C9CFF" : k === "warn" ? "#FFB454" : "#E9E7E1");
  // the window is as tall as its finished content: long lines wrap, as in a real terminal
  const inner = w - 56;
  const rowsOf = (l: any) => Math.max(1, Math.ceil(((l.kind === "cmd" ? 2 : 0) + String(l.text).length) * size * 0.6 / inner));
  const rows: number = el.rows ?? all.slice(-keep).reduce((n: number, l: any) => n + rowsOf(l), 0);
  const h = 74 + rows * size * 1.45 + 30;
  return (
    <div style={{ position: "absolute", left: x - w / 2, top: y - h / 2, width: w, height: h, opacity: o, transform: `scale(${back(seg(t, el.in, 0.4)) * 0.04 + 0.96})` }}>
      <div data-box="terminal" style={{ position: "absolute", inset: 0, borderRadius: 18, background: "#16171C", boxShadow: "0 24px 60px rgba(0,0,0,0.22)", overflow: "hidden" }}>
        <div style={{ height: 52, display: "flex", alignItems: "center", gap: 10, padding: "0 20px", borderBottom: "1px solid #2a2c33" }}>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
            <div key={c} style={{ width: 16, height: 16, borderRadius: 8, background: c }} />
          ))}
          <div style={{ flex: 1, textAlign: "center", fontFamily: F.mono, fontSize: 22, color: "#8b8f98", marginRight: 60 }}>{el.title ?? "claude"}</div>
        </div>
        <div style={{ padding: "18px 28px", fontFamily: F.mono, fontSize: size, lineHeight: 1.45 }}>
          {shown.map((l: any, i: number) => {
            const typed = l.kind === "cmd" ? Math.floor(String(l.text).length * Math.min(1, (t - l.in) / Math.max(0.4, String(l.text).length * 0.035))) : String(l.text).length;
            const text = String(l.text).slice(0, typed);
            return (
              <div key={`${l.in}-${i}`} style={{ color: col(l.kind), fontWeight: l.kind === "head" || l.kind === "cmd" ? 700 : 400, whiteSpace: "pre-wrap", wordBreak: "break-all", opacity: l.kind === "cmd" ? 1 : seg(t, l.in, 0.2) }}>
                {l.kind === "cmd" ? <span style={{ color: "#D97757" }}>{"> "}</span> : null}
                {text}
                {l.kind === "cmd" && typed < String(l.text).length ? <span style={{ background: "#E9E7E1" }}> </span> : null}
              </div>
            );
          })}
        </div>
      </div>
      {el.label ? <div style={{ position: "absolute", left: 0, top: h + 16, fontFamily: F.sans, fontWeight: 600, fontSize: 28, color: th.muted, whiteSpace: "nowrap" }}>{el.label}</div> : null}
    </div>
  );
};
