import React from "react";
import { AbsoluteFill, Img, staticFile, type CalculateMetadataFunction } from "remotion";

// A contact sheet for `make.mjs check`: up to 16 check frames, four to a row.
export type SheetProps = { frames: string[] };
const TW = 480;
const TH = 270;
const GAP = 4;

export const sheetMetadata: CalculateMetadataFunction<SheetProps> = ({ props }) => ({
  durationInFrames: 1,
  fps: 30,
  width: 4 * TW + 3 * GAP,
  height: Math.max(1, Math.ceil(props.frames.length / 4)) * (TH + GAP) - GAP,
});

export const Sheet: React.FC<SheetProps> = ({ frames }) => (
  <AbsoluteFill style={{ background: "#000", display: "grid", gridTemplateColumns: `repeat(4, ${TW}px)`, gridAutoRows: `${TH}px`, gap: GAP }}>
    {frames.map((f) => (
      <Img key={f} src={staticFile(f)} style={{ width: TW, height: TH, display: "block" }} />
    ))}
  </AbsoluteFill>
);
