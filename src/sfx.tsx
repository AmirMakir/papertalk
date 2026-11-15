import React, { createContext, useContext } from "react";
import { Html5Audio, interpolate, Sequence, staticFile, useVideoConfig } from "remotion";

// Short sounds made by scripts/sfx.mjs from noise and sine waves (no third-party
// licence), copied into every reel folder as _shared/sfx by the build. The volumes
// sit under the voice.
export type SfxName = "whoosh" | "slap" | "click" | "pop" | "ding" | "buzz" | "thud" | "tick" | "glitch" | "riser";
export const SFX_VOLUME: Record<SfxName, number> = {
  whoosh: 0.32,
  slap: 0.3,
  click: 0.5,
  pop: 0.22,
  ding: 0.28,
  buzz: 0.26,
  thud: 0.55,
  tick: 0.1,
  glitch: 0.16,
  riser: 0.2,
};
// How many files each sound has: name.wav, name-1.wav, …
export const SFX_VARIANTS: Record<SfxName, number> = { whoosh: 4, slap: 3, click: 3, pop: 4, ding: 4, buzz: 1, thud: 3, tick: 2, glitch: 3, riser: 1 };

// Seconds from the start of the reel to the start of the current scene, so a sound
// can pick its variant by where it falls in the whole reel and not only in its scene.
export const SfxClock = createContext(0);

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

// Plays a sound `at` seconds into the current sequence. Without `variant` the file is
// picked from the sound's place in the reel, and the volume moves by up to ±10%, so
// repeated cues don't sound copy-pasted.
export const Sfx: React.FC<{ name: SfxName; at?: number; volume?: number; variant?: number }> = ({ name, at = 0, volume, variant }) => {
  const { fps } = useVideoConfig();
  const offset = useContext(SfxClock);
  const h = hash(`${name}@${Math.round((offset + at) * 100)}`);
  const k = (variant ?? h) % SFX_VARIANTS[name];
  const jitter = variant === undefined ? 0.9 + ((h >>> 8) % 21) / 100 : 1;
  return (
    <Sequence from={Math.max(0, Math.round(at * fps))} durationInFrames={Math.round(1.1 * fps)} layout="none">
      <Html5Audio src={staticFile(`_shared/sfx/${k ? `${name}-${k}` : name}.wav`)} volume={(volume ?? SFX_VOLUME[name]) * jitter} />
    </Sequence>
  );
};

// Background beds: 9.6 s loops from scripts/sfx.mjs. tense under threats, calm under
// the explaining, bright under the payoff.
export type BedName = "tense" | "calm" | "bright";
// The files differ in loudness (a steady drone against sparse plucks); these put all
// three at about −38…−40 dBFS in the pauses, 16–18 dB under the voice.
const BED_VOLUME: Record<BedName, number> = { tense: 0.05, calm: 0.12, bright: 0.12 };
const FADE = 0.4;

// Plays a bed from `start` to `end` (reel seconds), fading in and out and ducking
// under the voice: `envelope` is the voice loudness per frame, 0–1.
export const Bed: React.FC<{ name: BedName; start: number; end: number; envelope?: number[] }> = ({ name, start, end, envelope = [] }) => {
  const { fps } = useVideoConfig();
  const from = Math.max(0, Math.round((start - FADE / 2) * fps));
  const frames = Math.max(1, Math.round((end + FADE / 2) * fps) - from);
  const fade = Math.round(FADE * fps);
  return (
    <Sequence from={from} durationInFrames={frames} layout="none">
      <Html5Audio
        src={staticFile(`_shared/sfx/bed-${name}.wav`)}
        loop
        volume={(f) => {
          // the loudest voice frame in the last ~0.2 s, so the bed doesn't pump between syllables
          let voice = 0;
          for (let i = 0; i < 6; i++) voice = Math.max(voice, envelope[from + f - i] ?? 0);
          const shape = interpolate(f, [0, fade, frames - fade, frames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return BED_VOLUME[name] * shape * (1 - 0.4 * voice);
        }}
      />
    </Sequence>
  );
};
