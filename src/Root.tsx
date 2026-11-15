import React from "react";
import { Composition } from "remotion";
import { Sheet, sheetMetadata } from "./Sheet";
import { Kit, kitMetadata } from "./kit/Kit";

// One composition. Real props come from videos/<slug>/props.json via scripts/make.mjs.
export const Root: React.FC = () => (
  <>
  <Composition
    id="PaperTalk"
    component={Kit}
    fps={30}
    width={1920}
    height={1080}
    durationInFrames={300}
    calculateMetadata={kitMetadata}
    defaultProps={{ sb: { paper: { id: "", title: "", link: "", byline: "" }, els: [] }, duration: 10 }}
  />
  <Composition id="Sheet" component={Sheet} fps={30} width={1932} height={270} durationInFrames={1} calculateMetadata={sheetMetadata} defaultProps={{ frames: [] }} />
  </>
);
