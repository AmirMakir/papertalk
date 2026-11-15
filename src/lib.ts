import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";

export type Word = { text: string; start: number; end: number; line: number };
export type Line = { line: number; start: number; end: number };
export type Cap = { text: string; start: number; end: number; line: number };

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
// Progress 0–1 of a move that starts at second `a` and lasts `d` seconds.
export const seg = (t: number, a: number, d: number) => clamp01((t - a) / d);
export const eio = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const eo = (x: number) => 1 - Math.pow(1 - x, 3);
export const back = (x: number) => (x <= 0 ? 0 : 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Times taken from the narration: the start of a line, or of a word inside a line.
// A missing cue throws, so a script change can't silently shift the picture.
export const makeCues = (words: Word[], lines: Line[]) => {
  const L = (n: number) => {
    const l = lines.find((x) => x.line === n);
    if (!l) throw new Error(`papertalk: no line ${n}`);
    return l;
  };
  return {
    ls: (n: number) => L(n).start,
    le: (n: number) => L(n).end,
    at: (n: number, token: string, occ = 0, edge: "start" | "end" = "start") => {
      const hit = words.filter((w) => w.line === n && norm(w.text) === norm(token))[occ];
      if (!hit) throw new Error(`papertalk: no cue ${n}:${token}#${occ}`);
      return hit[edge];
    },
  };
};
export type Cues = ReturnType<typeof makeCues>;

export type Box = { text: string; x: number; w: number; cx: number };

// Lays the example sentence out word by word, centred, as large as fits `maxWidth`.
// Rendering waits until the font is loaded, because the widths depend on it.
export const useSentence = (text: string, family: string, weight: number, centerX: number, maxWidth: number, maxSize: number) => {
  const [out, setOut] = useState<{ boxes: Box[]; size: number } | null>(null);
  const [handle] = useState(() => delayRender("papertalk: measure sentence"));
  useEffect(() => {
    let live = true;
    const fam = family.includes('"') ? family : `"${family}"`;
    document.fonts.load(`${weight} 100px ${fam}`, text).then(() => {
      if (!live) return;
      const ctx = document.createElement("canvas").getContext("2d")!;
      const words = text.split(" ");
      ctx.font = `${weight} 100px ${fam}`;
      const at100 = words.reduce((a, w) => a + ctx.measureText(w).width, 0) + ctx.measureText(" ").width * (words.length - 1);
      const size = Math.min(maxSize, Math.floor((100 * maxWidth) / at100));
      ctx.font = `${weight} ${size}px ${fam}`;
      const space = ctx.measureText(" ").width;
      const ws = words.map((w) => ctx.measureText(w).width);
      let x = centerX - (ws.reduce((a, b) => a + b, 0) + space * (words.length - 1)) / 2;
      const boxes = words.map((w, i) => {
        const b = { text: w, x, w: ws[i], cx: x + ws[i] / 2 };
        x += ws[i] + space;
        return b;
      });
      setOut({ boxes, size });
      continueRender(handle);
    });
    return () => {
      live = false;
    };
  }, [text, family, weight, centerX, maxWidth, maxSize, handle]);
  return out;
};
