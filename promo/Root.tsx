import React from "react";
import { Composition } from "remotion";
import { LaunchFilm, FILM_FRAMES, type FilmProps } from "./LaunchFilm";

// papertalk's own launch video, made in code like everything else here. Not part of the plugin.
const empty: FilmProps = { link: "", paper: { site: "", title: "", byline: "" }, words: 0, secs: 0, length: "", blocks: [], cards: [] };
export const PromoRoot: React.FC = () => <Composition id="LaunchFilm" component={LaunchFilm} fps={30} width={1920} height={1080} durationInFrames={FILM_FRAMES} defaultProps={empty} />;
