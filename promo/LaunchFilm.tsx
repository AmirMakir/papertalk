/* papertalk launch film for X: 30 s, white + one accent, one camera, no cuts.
   Built on what the light launch videos on X share (research-x.md): scenes clear to white instead of cutting,
   one accent object carries every change (here a blue dot: caret → highlights → progress bar → logo dot),
   3D comes from tilting flat cards, a small mono HUD frames the film, 2–5 word headlines, one numbers beat.
   0 dot → terminal · 2.5 page, words count · 4.3 camera along the page, paragraphs flip into clips, clock runs
   · 9 fly into one card → player (drop at 10 s) · 12 carousel of six sources · 20 numbers · 24 end card.
   Numbers come from one real hands-off run; props in videos/launch/film.json. */
import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import { F } from "../src/theme";

type Card = { src: string; from: number; kind: string; title: string };
export type FilmProps = {
  link: string;
  paper: { site: string; title: string; byline: string };
  words: number;
  secs: number;
  length: string;
  blocks: { src: string; from: number }[]; // the three paragraphs' backs; the middle one becomes the player
  cards: Card[]; // the carousel; the first continues the player
};
export const FILM_FRAMES = 900;
const SONG = { src: "music/ramp-it-up.mp3", start: 22.1 }; // its drop (32.1 s) lands at 10 s

const BG = "#FFFFFF";
const INK = "#0F1115";
const ACCENT = "#2B50E0";
const MUTED = "#7A7F8C";
const LINE = "#E4E6EB";
const SOFT = "#F4F5F7";
const SHADOW = "0 30px 80px rgba(20,28,60,0.14), 0 6px 18px rgba(20,28,60,0.08)";

const c01 = (x: number) => Math.max(0, Math.min(1, x));
const eio = (x: number) => {
  const v = c01(x);
  return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
};
const eo = (x: number) => 1 - Math.pow(1 - c01(x), 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const at = (f: number, a: number, d: number) => eio((f - a) / d);
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// ── when things happen (frames, 30 fps) ──
const T = { dot: 0, card: 12, type: 26, page: 76, tilt: 104, run: 136, flips: [150, 190, 230], fly: 268, drop: 300, carousel: 360, glide: 386, clear: 600, nums: 628, strike: 664, swap: 684, end: 724 };

const Vid: React.FC<{ src: string; from: number; w: number }> = ({ src, from, w }) => (
  <div style={{ width: 1920, height: 1080, transform: `scale(${w / 1920})`, transformOrigin: "0 0", position: "absolute", left: 0, top: 0 }}>
    <OffthreadVideo src={staticFile(src)} muted trimBefore={Math.max(0, Math.round(from * 30))} style={{ width: 1920, height: 1080, display: "block" }} />
  </div>
);

// where the middle card lands: flat, 1440 wide (clear of the headline above and the HUD below)
const PLAYER = { w: 1440, cy: 575 };
const PERSP = 2000;

// ── the page: a terminal card that unfolds into the paper, tilts back, and lifts three paragraphs into clips ──
const PW = 1100; // page width
const PH = 2240;
const BW = 920; // a paragraph block: 16:9
const BH = (BW * 9) / 16;
const BY = [470, 1080, 1690]; // block tops on the page
const Lines: React.FC<{ n: number; w?: number; tint?: string; seed?: number }> = ({ n, w = 940, tint = LINE, seed = 1 }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
    {Array.from({ length: n }, (_, i) => {
      const r = Math.abs(Math.sin((i + 1) * 12.9898 * seed)) % 1;
      return <div key={i} style={{ height: 16, borderRadius: 8, background: tint, width: i === n - 1 ? w * (0.35 + 0.3 * r) : w * (0.82 + 0.18 * r) }} />;
    })}
  </div>
);
const Block: React.FC<{ i: number; src: string; from: number; start: number }> = ({ i, src, from, start }) => {
  const f = useCurrentFrame();
  const hl = at(f, start, 10); // the paragraph is marked
  const lift = at(f, start + 8, 14);
  const flip = 180 * at(f, start + 16, 20);
  return (
    <div style={{ position: "absolute", left: (PW - BW) / 2, top: BY[i], width: BW, height: BH, transformStyle: "preserve-3d", transform: `translateZ(${lift * 70}px) rotateY(${flip}deg)` }}>
      {/* front: the paragraph */}
      <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", padding: "34px 40px", borderRadius: 14, background: lift > 0 ? "#fff" : "transparent", boxShadow: lift > 0 ? `0 ${30 * lift}px ${70 * lift}px rgba(20,28,60,${0.16 * lift})` : undefined }}>
        <div style={{ position: "absolute", left: 0, top: 30, bottom: 30, width: 8, borderRadius: 4, background: ACCENT, opacity: hl, transform: `scaleY(${hl})` }} />
        <Lines n={9} w={BW - 80} seed={i + 2} tint={hl > 0.5 ? "#D5DCF7" : LINE} />
      </div>
      {/* back: what the paragraph became */}
      <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)", borderRadius: 14, overflow: "hidden", background: "#F5F1E8", boxShadow: SHADOW }}>
        <Sequence from={start + 16} layout="none">
          <Vid src={src} from={from} w={BW} />
        </Sequence>
        <div style={{ position: "absolute", inset: 0, borderRadius: 14, boxShadow: "inset 0 0 0 1.5px rgba(15,17,21,0.08)" }} />
      </div>
    </div>
  );
};

const Page: React.FC<{ p: FilmProps }> = ({ p }) => {
  const f = useCurrentFrame();
  // the card: a dot that grows into the terminal, which unfolds into the page
  const grow = at(f, T.card, 16);
  const unfold = at(f, T.page, 26);
  const w = lerp(lerp(28, 1500, grow), PW, unfold);
  const h = lerp(lerp(28, 300, grow), PH, unfold);
  const r = lerp(lerp(14, 24, grow), 18, unfold);
  // the camera: tilt back, glide down the page, then fly into the middle block
  const tilt = at(f, T.tilt, 30);
  const glide = at(f, T.run - 10, T.fly - T.run + 10);
  const fly = at(f, T.fly, 30);
  const mid = BY[1] + BH / 2; // the middle block's centre on the page
  const rx = lerp(lerp(0, 52, tilt), 0, fly);
  const rz = lerp(lerp(0, -8, tilt), 0, fly);
  // the block is lifted 70 px toward the camera, so solve for the scale that makes it exactly PLAYER.w wide
  const sFly = (PLAYER.w * PERSP) / (BW * PERSP + 70 * PLAYER.w);
  const s = lerp(lerp(1, 0.78, tilt), sFly, fly);
  // which point of the page sits at the screen centre
  const focusY = lerp(lerp(lerp(150, 360, unfold), lerp(BY[0] + BH / 2, BY[2] + BH / 2, glide), tilt), mid, fly);
  const screenY = lerp(540, PLAYER.cy, fly);
  const typed = Math.floor(p.link.length * c01((f - T.type - 14) / 32));
  const termOut = c01((f - T.page) / 10);
  const pageIn = c01((f - T.page - 8) / 14);
  return (
    <AbsoluteFill style={{ perspective: PERSP, perspectiveOrigin: `50% ${(PLAYER.cy / 1080) * 100}%` }}>
      <div style={{ position: "absolute", left: 960, top: screenY, transformStyle: "preserve-3d", transform: `rotateX(${rx}deg) rotateZ(${rz}deg) scale(${s}) translateY(${-focusY + h / 2}px)` }}>
        <div style={{ position: "absolute", left: -w / 2, top: -h / 2, width: w, height: h, borderRadius: r, background: f < T.card ? ACCENT : "#fff", boxShadow: f < T.card ? undefined : SHADOW, transformStyle: "preserve-3d", transform: "none" }}>
          {/* the terminal */}
          {f >= T.card && termOut < 1 ? (
            <div style={{ position: "absolute", left: 56, top: 60, right: 40, fontFamily: F.mono, opacity: c01((f - T.card - 8) / 8) * (1 - termOut), whiteSpace: "nowrap", overflow: "hidden" }}>
              <div style={{ fontSize: 58, fontWeight: 700, color: INK }}>
                <span style={{ color: ACCENT }}>{"> "}</span>
                {"/papertalk:explain".slice(0, Math.floor(18 * c01((f - T.type) / 12)))}
              </div>
              <div style={{ fontSize: 52, color: INK, marginTop: 22, paddingLeft: 70 }}>
                {p.link.slice(0, typed)}
                <span style={{ display: "inline-block", width: 26, height: 52, marginLeft: 4, verticalAlign: "-8px", background: ACCENT, opacity: f % 18 < 10 || typed < p.link.length ? 1 : 0 }} />
              </div>
            </div>
          ) : null}
          {/* the page */}
          {pageIn > 0 ? (
            <div style={{ position: "absolute", inset: 0, opacity: pageIn, transformStyle: "preserve-3d" }}>
              <div style={{ position: "absolute", left: 90, top: 80, right: 90 }}>
                <div style={{ fontFamily: F.mono, fontSize: 24, color: MUTED }}>{p.paper.site}</div>
                <div style={{ fontFamily: F.serif, fontWeight: 600, fontSize: 52, lineHeight: 1.15, color: INK, marginTop: 22 }}>{p.paper.title}</div>
                <div style={{ fontFamily: F.sans, fontSize: 26, color: MUTED, marginTop: 18 }}>{p.paper.byline}</div>
                <div style={{ marginTop: 40 }}>
                  <Lines n={4} w={PW - 180} seed={9} />
                </div>
              </div>
              {[0, 1].map((k) => (
                <div key={k} style={{ position: "absolute", left: 90, top: BY[k] + BH + 60, right: 90 }}>
                  <Lines n={6} w={PW - 180} seed={k + 5} />
                </div>
              ))}
              <div style={{ position: "absolute", left: 90, top: BY[2] + BH + 60, right: 90 }}>
                <Lines n={3} w={PW - 180} seed={8} />
              </div>
              {p.blocks.map((b, i) => (
                <Block key={i} i={i} src={b.src} from={b.from} start={T.flips[i]} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── the player after the drop: the middle card, flat, with the accent dot running along its progress line ──
const Player: React.FC = () => {
  const f = useCurrentFrame(); // local, from T.drop - 4
  const gone = c01((f - (T.carousel - T.drop + 4)) / 10);
  const top = PLAYER.cy + (PLAYER.w * 9) / 32 + 22;
  return (
    <div style={{ position: "absolute", left: 960 - PLAYER.w / 2, top, width: PLAYER.w, height: 6, borderRadius: 3, background: LINE, opacity: c01(f / 8) * (1 - gone) }}>
      <div style={{ height: 6, borderRadius: 3, background: ACCENT, width: `${4 + 30 * c01(f / 60)}%` }} />
    </div>
  );
};

// ── the carousel: six sources on a tilted plane, the camera gliding past ──
const CW = 1000;
const GAP = 140;
const Carousel: React.FC<{ cards: Card[] }> = ({ cards }) => {
  const f = useCurrentFrame(); // local, 0 = T.carousel
  const settle = at(f, 0, 26); // from the flat player to the plane
  const n = cards.length;
  const step = 42;
  let pos = 0;
  for (let k = 1; k < n; k++) pos += at(f, T.glide - T.carousel + (k - 1) * step, 26);
  const leave = at(f, T.clear - T.carousel, 30);
  const scale = lerp(PLAYER.w / CW, 1, settle) * lerp(1, 0.6, leave);
  const cy = lerp(PLAYER.cy, 500, settle);
  return (
    <AbsoluteFill style={{ perspective: 2200, perspectiveOrigin: "50% 45%", opacity: 1 - leave }}>
      <div style={{ position: "absolute", left: 960, top: cy, transformStyle: "preserve-3d", transform: `scale(${scale}) rotateY(${-16 * settle}deg) rotateX(${5 * settle}deg) translateZ(${-600 * leave}px) translateX(${-pos * (CW + GAP)}px)` }}>
        {cards.map((c, i) => {
          const d = Math.abs(i - pos);
          const dof = i === 0 && settle < 1 ? 0 : Math.min(1, d);
          return (
            <div key={i} style={{ position: "absolute", left: i * (CW + GAP) - CW / 2, top: (-CW * 9) / 32, width: CW, height: (CW * 9) / 16, borderRadius: 14, overflow: "hidden", background: "#F5F1E8", boxShadow: SHADOW, filter: `blur(${dof * 5}px)`, opacity: i === 0 ? 1 : lerp(0, 1 - 0.3 * dof, settle) }}>
              <Vid src={c.src} from={c.from} w={CW} />
              <div style={{ position: "absolute", inset: 0, borderRadius: 14, boxShadow: "inset 0 0 0 1.5px rgba(15,17,21,0.08)" }} />
            </div>
          );
        })}
      </div>
      {/* the label of the card in front */}
      <div style={{ position: "absolute", top: 812, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: c01((settle - 0.75) / 0.25) * (1 - leave) }}>
        {cards.map((c, i) => {
          const on = c01(1 - Math.abs(i - pos) * 2.4);
          return (
            <div key={i} style={{ position: "absolute", display: "flex", alignItems: "center", gap: 20, opacity: on, transform: `translateY(${(1 - on) * 12}px)` }}>
              <span style={{ fontFamily: F.mono, fontSize: 28, fontWeight: 700, color: ACCENT, letterSpacing: 2, textTransform: "uppercase" }}>{c.kind}</span>
              <span style={{ fontFamily: F.serif, fontStyle: "italic", fontSize: 46, color: INK, whiteSpace: "nowrap" }}>{c.title}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ── the numbers, on white ──
const Numbers: React.FC<{ p: FilmProps }> = ({ p }) => {
  const f = useCurrentFrame(); // local, 0 = T.nums
  const a = at(f, 0, 16);
  const strike = at(f, T.strike - T.nums, 14);
  const swap = at(f, T.swap - T.nums, 18);
  const out = at(f, T.end - T.nums - 14, 14);
  const big: React.CSSProperties = { fontFamily: F.sans, fontWeight: 700, fontSize: 210, letterSpacing: -8, lineHeight: 1, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: 1 - out }}>
      <div style={{ position: "relative", height: 230, width: 1700, display: "flex", justifyContent: "center", overflow: "hidden" }}>
        <div style={{ position: "absolute", ...big, color: INK, opacity: a * (1 - swap), transform: `translateY(${(1 - a) * 60 - swap * 80}px)`, filter: `blur(${(1 - a) * 6 + swap * 6}px)` }}>
          {p.words.toLocaleString("en-US")} words
          <div style={{ position: "absolute", left: -10, right: -10, top: "52%", height: 14, borderRadius: 7, background: ACCENT, transform: `scaleX(${strike})`, transformOrigin: "0 50%" }} />
        </div>
        <div style={{ position: "absolute", ...big, color: ACCENT, opacity: swap, transform: `translateY(${(1 - swap) * 80}px)`, filter: `blur(${(1 - swap) * 6}px)` }}>{p.length} video</div>
      </div>
      <div style={{ marginTop: 40, fontFamily: F.sans, fontWeight: 500, fontSize: 64, color: INK, opacity: at(f, T.swap - T.nums + 10, 14), transform: `translateY(${(1 - at(f, T.swap - T.nums + 10, 16)) * 24}px)` }}>
        from {p.words.toLocaleString("en-US")} words, in <span style={{ color: ACCENT, fontWeight: 700 }}>{mmss(p.secs).replace(/^0/, "")}</span> · hands-off
      </div>
    </AbsoluteFill>
  );
};

// ── the end card ──
const INSTALL = "/plugin install papertalk --marketplace AmirMakir/papertalk";
const End: React.FC = () => {
  const f = useCurrentFrame(); // local, 0 = T.end
  const rise = (a: number) => ({ opacity: at(f, a, 14), transform: `translateY(${(1 - at(f, a, 16)) * 26}px)` });
  const typed = Math.floor(INSTALL.length * c01((f - 30) / 20));
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 170 }}>
      <div style={{ display: "flex", alignItems: "baseline", ...rise(0) }}>
        <span style={{ fontFamily: F.serif, fontWeight: 600, fontSize: 230, letterSpacing: -4, color: INK, lineHeight: 1 }}>papertalk</span>
        <span style={{ width: 42, height: 42, borderRadius: 21, background: ACCENT, marginLeft: 14, transform: `scale(${eo((f - 10) / 12)})` }} />
      </div>
      <div style={{ marginTop: 40, fontFamily: F.sans, fontWeight: 500, fontSize: 54, color: INK, ...rise(12) }}>Any paper, article or post → a video to learn it.</div>
      <div style={{ marginTop: 64, background: SOFT, borderRadius: 18, padding: "26px 40px", fontFamily: F.mono, fontSize: 40, fontWeight: 700, color: INK, whiteSpace: "nowrap", minWidth: 1560, ...rise(24) }}>
        <span style={{ color: ACCENT }}>{"> "}</span>
        {INSTALL.slice(0, typed)}
      </div>
      <div style={{ marginTop: 52, fontFamily: F.sans, fontWeight: 700, fontSize: 60, color: ACCENT, ...rise(46) }}>github.com/AmirMakir/papertalk</div>
      <div style={{ marginTop: 14, fontFamily: F.sans, fontWeight: 500, fontSize: 38, color: MUTED, ...rise(54) }}>open source · a Claude Code plugin · free voice on your laptop</div>
    </AbsoluteFill>
  );
};

// ── headlines: 2–5 words, they rise out of a mask and leave the same way ──
const Head: React.FC<{ a: number; b: number; children: React.ReactNode }> = ({ a, b, children }) => {
  const f = useCurrentFrame();
  const p = at(f, a, 16);
  const q = at(f, b, 12);
  if (p <= 0 || q >= 1) return null;
  return (
    <div style={{ position: "absolute", top: 58, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
      <div style={{ overflow: "hidden", padding: "0 10px 10px" }}>
        <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 88, letterSpacing: -2, color: INK, whiteSpace: "nowrap", transform: `translateY(${(1 - p) * 105 - q * 105}%)` }}>{children}</div>
      </div>
    </div>
  );
};
// keeps the headline readable over the page sliding beneath it; gone once the card has landed
const TopFade: React.FC = () => {
  const f = useCurrentFrame(); // local, 0 = T.page
  const o = c01(f / 12) * (1 - c01((f - (T.fly - T.page + 10)) / 16));
  return <AbsoluteFill style={{ background: "linear-gradient(180deg, #fff 0px, #fff 150px, rgba(255,255,255,0) 230px)", opacity: o, pointerEvents: "none" }} />;
};
const A: React.FC<{ children: React.ReactNode }> = ({ children }) => <span style={{ color: ACCENT }}>{children}</span>;

// ── the HUD: small mono labels in the corners, the same all film long ──
const Hud: React.FC<{ p: FilmProps }> = ({ p }) => {
  const f = useCurrentFrame();
  const chapters: [number, string][] = [
    [0, "01 · THE LINK"],
    [T.page, "02 · THE PAPER"],
    [T.run, "03 · THE RUN"],
    [T.fly, "04 · THE FILM"],
    [T.carousel, "05 · ANY SOURCE"],
    [T.clear, "06 · THE RECEIPT"],
    [T.end, "07 · INSTALL"],
  ];
  const ch = [...chapters].reverse().find(([t]) => f >= t)![1];
  const words = Math.round(p.words * eo((f - T.page - 6) / 30));
  const run = p.secs * eio((f - T.run) / (T.drop - T.run));
  const right = f < T.page ? "WORDS 00,000" : f < T.run ? `WORDS ${words.toLocaleString("en-US").padStart(6, "0")}` : `RUN ${mmss(run)}`;
  const label: React.CSSProperties = { position: "absolute", fontFamily: F.mono, fontSize: 24, letterSpacing: 2, color: MUTED };
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: 1 - at(f, T.end + 10, 20) }}>
      <div style={{ ...label, left: 44, top: 30 }}>PAPERTALK / FILM 01</div>
      <div style={{ ...label, right: 44, top: 30, color: f >= T.run && f < T.drop + 30 ? ACCENT : MUTED, fontVariantNumeric: "tabular-nums" }}>{right}</div>
      <div style={{ ...label, left: 44, bottom: 28 }}>{ch}</div>
      <div style={{ ...label, right: 44, bottom: 28 }}>ONE REAL RUN · NO EDITS</div>
    </AbsoluteFill>
  );
};

const Sfx: React.FC<{ at: number; name: string; v?: number }> = ({ at: a, name, v = 0.25 }) => (
  <Sequence from={Math.max(0, a)} durationInFrames={45} layout="none">
    <Audio src={staticFile(`sfx/${name}.wav`)} volume={v} />
  </Sequence>
);

export const LaunchFilm: React.FC<FilmProps> = (p) => {
  // the middle block's clip, continued by the player and then by the first carousel card
  const hero = p.blocks[1];
  const heroAt = (frame: number) => hero.from + (frame - (T.flips[1] + 16)) / 30;
  const cards = p.cards.map((c, i) => (i === 0 ? { ...c, src: hero.src, from: heroAt(T.carousel) } : c));
  return (
    <AbsoluteFill style={{ background: BG, overflow: "hidden" }}>
      <Sequence durationInFrames={T.carousel + 2} layout="none">
        <Page p={p} />
      </Sequence>
      <Sequence from={T.drop - 4} durationInFrames={T.carousel - T.drop + 30} layout="none">
        <Player />
      </Sequence>
      <Sequence from={T.carousel} durationInFrames={T.nums + 10 - T.carousel} layout="none">
        <Carousel cards={cards} />
      </Sequence>
      <Sequence from={T.nums} durationInFrames={T.end - T.nums} layout="none">
        <Numbers p={p} />
      </Sequence>
      <Sequence from={T.end} layout="none">
        <End />
      </Sequence>

      <Sequence from={T.page} durationInFrames={T.drop - T.page} layout="none">
        <TopFade />
      </Sequence>
      <Head a={-16} b={T.page - 4}>
        One <A>link</A>.
      </Head>
      <Head a={T.page + 4} b={T.run - 4}>
        A <A>{p.words.toLocaleString("en-US")}</A>-word paper.
      </Head>
      <Head a={T.run} b={T.fly - 4}>
        <A>Hands-off.</A>
      </Head>
      <Head a={T.fly + 24} b={T.carousel - 4}>
        A <A>{p.length}</A> film to learn it.
      </Head>
      <Head a={T.carousel + 6} b={T.clear}>
        <A>Any</A> source.
      </Head>
      <Hud p={p} />

      <Audio src={staticFile(SONG.src)} trimBefore={Math.round(SONG.start * 30)} volume={(fr) => 0.85 * Math.min(1, fr / 10) * c01((FILM_FRAMES - fr) / 45)} />
      <Sfx at={T.tilt} name="whoosh-1" />
      <Sfx at={T.fly} name="whoosh" />
      <Sfx at={T.clear} name="whoosh-1" />
    </AbsoluteFill>
  );
};
