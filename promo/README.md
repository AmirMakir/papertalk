# The launch video

papertalk's 30-second launch video, written in code with Remotion like the explainers themselves: one camera move, white plus one accent colour, no cuts.

Every number in it comes from one real hands-off run: `/papertalk:explain transformer-circuits.pub/2026/workspace` read a 49,836-word paper and wrote a 2:35 explainer in 12 min 14 s, with no stops and no edits. The other clips are explainers papertalk made of an essay, a Wikipedia article, a blog post and two more papers.

To render it you need your own explainers and a music track: the props in `film.json` point to short segments of them in `videos/launch/clips/seg/` and to `videos/launch/music/ramp-it-up.mp3` (Mixkit "Ramp It Up", free licence; not included here, as Mixkit doesn't allow sharing the file itself).

```bash
npx remotion render promo/index.ts LaunchFilm out/launch-film.mp4 --props=promo/film.json --public-dir=videos/launch
```
