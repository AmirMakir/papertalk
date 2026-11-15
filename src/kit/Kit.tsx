import React, { useLayoutEffect, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, Html5Audio, staticFile, useCurrentFrame, type CalculateMetadataFunction } from "remotion";
import { Sfx, type SfxName } from "../sfx";
import { eio, eo, seg, useSentence } from "../lib";
import { F, FPS, H, themes, W } from "../theme";
import { BACK, renderEl, SVG, vis, type Ctx, type El, type Paper, type Row } from "./els";

// A papertalk video from a storyboard: videos/<slug>/storyboard.json, resolved by
// scripts/make.mjs. With `check` set, frame k shows second check[k] and logs
// overlapping or cut-off text instead of playing sound.

type Cap = { text: string; start: number; end: number; line: number };
export type KitProps = {
  sb: { paper: Paper; row?: Record<string, any> | null; tags?: [number, string][]; els: El[]; nocaps?: [number, number | null][] };
  caps?: Cap[];
  duration: number;
  audio?: string;
  sfx?: [SfxName, number, number][];
  theme?: "paper" | "night";
  captions?: boolean;
  check?: number[];
};

export const kitMetadata: CalculateMetadataFunction<KitProps> = ({ props }) => ({
  durationInFrames: props.check ? Math.max(1, props.check.length) : Math.max(30, Math.round(props.duration * FPS)),
  fps: FPS,
  width: W,
  height: H,
});

const Probe: React.FC<{ t: number; captions: boolean }> = ({ t, captions }) => {
  const frame = useCurrentFrame();
  const [handle] = useState(() => delayRender("papertalk: probe"));
  useLayoutEffect(() => {
    let live = true;
    document.fonts.ready.then(() => {
      if (!live) return;
      // rendering at --scale shrinks the page: measure in composition pixels
      const root = document.querySelector("[data-kit-root]")!.getBoundingClientRect();
      const k = root.width / W;
      const boxes = Array.from(document.querySelectorAll<HTMLElement>("[data-box]"))
        .map((e) => {
          let o = 1;
          for (let n: HTMLElement | null = e; n; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity || "1");
          const q = e.getBoundingClientRect();
          const r = { left: (q.left - root.left) / k, right: (q.right - root.left) / k, top: (q.top - root.top) / k, bottom: (q.bottom - root.top) / k, width: q.width / k, height: q.height / k };
          return { e, name: e.dataset.box ?? "?", o, r };
        })
        .filter((b) => b.o > 0.4 && b.r.width > 2 && b.r.height > 2);
      const issues: string[] = [];
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
          const ix = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
          const iy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
          if (ix > 4 && iy > 4 && ix * iy > 150) issues.push(`overlap: ${a.name} × ${b.name}`);
        }
      for (const b of boxes) {
        if (b.r.left < 16 || b.r.right > W - 16 || b.r.top < 16 || b.r.bottom > H - 16) issues.push(`off-frame: ${b.name}`);
        else if (captions && !b.name.startsWith("caption") && b.r.bottom > 952) issues.push(`over captions: ${b.name}`);
        if (b.name.startsWith("ERROR")) issues.push(b.name);
      }
      console.log(`PRIMERCHECK ${JSON.stringify({ t: Math.round(t * 100) / 100, issues })}`);
      continueRender(handle);
    });
    return () => {
      live = false;
    };
  }, [frame, t, captions, handle]);
  return null;
};

export const Kit: React.FC<KitProps> = ({ sb, caps = [], audio, sfx = [], theme = "paper", captions = true, check }) => {
  const frame = useCurrentFrame();
  const t = check ? (check[Math.min(frame, check.length - 1)] ?? 0) : frame / FPS;
  const th = themes[theme];
  const rs = sb.row ?? null;
  const sent0 = useSentence(rs?.text ?? "·", F.serif, 500, rs?.cx ?? W / 2, rs?.width ?? 1740, rs?.size ?? 94);
  // other questions in the same frame: row.alts = [{ text, in, out }] (up to three; row.alt = one)
  const alts: { text: string; in: number; out?: number | null }[] = rs?.alts ?? (rs?.alt ? [rs.alt] : []);
  const sA = useSentence(alts[0]?.text ?? "·", F.serif, 500, rs?.cx ?? W / 2, rs?.width ?? 1740, rs?.size ?? 94);
  const sB = useSentence(alts[1]?.text ?? "·", F.serif, 500, rs?.cx ?? W / 2, rs?.width ?? 1740, rs?.size ?? 94);
  const sC = useSentence(alts[2]?.text ?? "·", F.serif, 500, rs?.cx ?? W / 2, rs?.width ?? 1740, rs?.size ?? 94);
  let ai = -1;
  alts.forEach((a, i) => {
    if (t >= a.in && (a.out == null || t < a.out)) ai = i;
  });
  const alt = ai >= 0 ? alts[ai] : null;
  const altOn = !!alt;
  const sent1 = sA && sB && sC ? [sA, sB, sC][Math.max(0, ai)] : null;
  const sent = altOn ? sent1 : sent0;
  const altFade = Math.min(1, ...alts.flatMap((a) => (a.out != null ? [a.in, a.out] : [a.in])).map((e) => Math.abs(t - e) / 0.3));
  const els = sb.els;

  // the example row and what the modifiers do to it
  let row: Row | null = null;
  let rowO = 0;
  if (rs && sent0 && sent1 && sent) {
    const top = rs.y ?? 520;
    const n = sent.boxes.length;
    const dx = new Array(n).fill(0);
    const dy = new Array(n).fill(0);
    for (const e of els)
      if (e.t === "swap") {
        const sw = eio(seg(t, e.in - 0.2, 0.6)) - (e.out != null ? eio(seg(t, e.out - 0.1, 0.6)) : 0);
        const [a, b] = [e.a, e.b];
        dx[a] += (sent.boxes[b].cx - sent.boxes[a].cx) * sw;
        dx[b] += (sent.boxes[a].cx - sent.boxes[b].cx) * sw;
        dy[a] -= Math.sin(Math.PI * sw) * 44;
        dy[b] += Math.sin(Math.PI * sw) * 44;
      }
    row = { boxes: sent.boxes, size: sent.size, top, bottom: top + sent.size, arcY: top + sent.size * 0.1, dx, dy };
    const shows: [number, number | null][] = rs.show ?? [[rs.in ?? 0, null]];
    rowO = Math.max(0, ...shows.map(([a, b]) => vis(t, a, b, 0.4, 0.4)));
  }
  const ctx: Ctx = { t, th, row, paper: sb.paper, dip: altFade };
  const tag = [...(sb.tags ?? [])].reverse().find(([at]) => t >= at);
  const nocap = (sb.nocaps ?? []).some(([a, b]) => t >= a && (b == null || t < b));
  let cap: Cap | null = null;
  for (const c of caps) if (t >= c.start - 0.08) cap = c;
  if (cap && t > cap.end + 0.7) cap = null;

  return (
    <AbsoluteFill data-kit-root style={{ background: th.bg, overflow: "hidden" }}>
      <AbsoluteFill style={{ backgroundImage: `radial-gradient(circle, ${th.dot} 2px, transparent 2.6px)`, backgroundSize: "48px 48px", backgroundPosition: "24px 24px" }} />
      <div style={{ position: "absolute", left: 64, top: 62, fontFamily: F.mono, fontSize: 32, color: th.muted }}>{sb.paper.id}</div>
      {tag && tag[1] ? (
        <div data-box="tag" style={{ position: "absolute", right: 64, top: 50, opacity: eo(seg(t, tag[0], 0.35)), fontFamily: F.mono, fontSize: 34, fontWeight: 700, color: th.ink, border: `3px solid ${th.ink}`, borderRadius: 12, padding: "8px 18px", background: th.card }}>
          {tag[1]}
        </div>
      ) : null}

      {row && rowO > 0 ? (
        <div style={{ position: "absolute", inset: 0, opacity: rowO }}>
          {els.filter((e) => BACK[e.t]).map((e, i) => {
            const Comp = BACK[e.t];
            return <Comp key={`b${i}`} el={e} ctx={ctx} />;
          })}
          <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
            {els.filter((e) => SVG[e.t]).map((e, i) => {
              const Comp = SVG[e.t];
              return <Comp key={`s${i}`} el={e} ctx={ctx} />;
            })}
          </svg>
          {row.boxes.map((b, i) => {
            const at: number = alt ? alt.in : (rs!.words?.[i] ?? rs!.in ?? 0);
            const p = seg(t, at - 0.06, 0.28) * altFade;
            let dim = 1;
            for (const e of els) if (e.t === "dim" && !(e.keep ?? []).includes(i)) dim *= 1 - 0.72 * vis(t, e.in, e.out);
            const rep = els.find((e) => e.t === "replace" && e.w === i && t >= e.in - 0.15 && (e.out == null || t < e.out + 0.15));
            const fo = rep && rep.out != null ? seg(t, rep.out - 0.15, 0.3) : 0;
            const flip = rep ? Math.abs(Math.cos(Math.PI * (fo > 0 ? fo : seg(t, rep.in - 0.15, 0.3)))) : 1;
            const text = rep && t >= rep.in && (rep.out == null || t < rep.out) ? rep.text : b.text;
            const marked = els.some((e) => e.t === "mark" && e.w === i && t > e.in && (e.out == null || t < e.out));
            return (
              <div
                key={`w${i}`}
                data-box={p > 0.5 ? `row word ${i}` : undefined}
                style={{
                  position: "absolute",
                  left: b.x + row!.dx[i] + (rep ? b.w / 2 : 0),
                  top: row!.top + (1 - eo(p)) * 16 + row!.dy[i],
                  transform: rep ? `translateX(-50%) scaleY(${flip})` : undefined,
                  opacity: p * dim,
                  fontFamily: F.serif,
                  fontWeight: 500,
                  fontSize: row!.size,
                  lineHeight: `${row!.size}px`,
                  color: rep ? roleText(th, rep.c) : marked && th.dark ? th.markInk : th.ink,
                  whiteSpace: "nowrap",
                }}
              >
                {text}
              </div>
            );
          })}
        </div>
      ) : null}

      {els.map((e, i) => {
        const anchored = row && (["tokens", "values", "strike"].includes(e.t) || (e.t === "label" && (e.over != null || e.under != null || e.lane != null)));
        const node = renderEl(e, ctx);
        return anchored ? (
          <div key={`f${i}`} style={{ position: "absolute", inset: 0, opacity: rowO }}>
            {node}
          </div>
        ) : (
          <React.Fragment key={`f${i}`}>{node}</React.Fragment>
        );
      })}

      {captions && cap && !nocap ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 968, display: "flex", justifyContent: "center" }}>
          <div data-box="caption" style={{ fontFamily: F.body, fontWeight: 600, fontSize: 48, lineHeight: 1.2, color: th.ink, opacity: 0.9 * seg(t, cap.start - 0.08, 0.14), background: th.bg, padding: "4px 20px", borderRadius: 12, whiteSpace: "nowrap" }}>
            {cap.text}
          </div>
        </div>
      ) : null}
      {!check && audio ? <Html5Audio src={staticFile(audio)} /> : null}
      {!check ? sfx.map(([name, at, volume], i) => <Sfx key={`x${i}`} name={name} at={at} volume={volume} />) : null}
      {check ? <div style={{ position: "absolute", left: 0, top: 0, background: "#000", color: "#fff", fontFamily: F.mono, fontSize: 60, padding: "2px 16px" }}>{Math.round(t * 100) / 100}s</div> : null}
      {check && sent0 && sent1 ? <Probe t={t} captions={captions} /> : null}
    </AbsoluteFill>
  );
};

const roleText = (th: (typeof themes)["paper"], c?: string) => (c ? ((th as unknown as Record<string, string>)[c] ?? c) : th.pen);
