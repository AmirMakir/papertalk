---
name: papertalk
description: Turn a paper, blog post, essay or X post into a 1–2.5 minute horizontal explainer video where the picture shows exactly what the voice says. Use on /papertalk <link or file>, "make a video of this paper/post", "explain this article in a video".
---

# papertalk: source in, explainer video out

The viewer should finish the video able to say the source's main idea in one sentence and know where to look in it. The video is not a teaser and not a full walk-through.

## One command, two stops

When the person runs `/papertalk <link or file>`:

1. Run `node scripts/doctor.mjs` once per session. If something is marked ✗, say what to run and stop.
2. Do steps 1–4 below (source, format, facts, script) without asking anything.
3. **Stop 1.** Show the person, in a few lines: the main idea in one sentence, the one picture you will draw, and the script. Ask for an OK or changes. Don't make the voice before the OK.
4. Do steps 6–8 (voice, storyboard, check). Fix the check until it is clean.
5. **Stop 2.** Show the contact sheets (`out/<slug>-check-*.png`) and ask whether to render.
6. Render, open the video, and write `videos/<slug>/post.md` (below). Reply with the video path, the length, and the post text.

If the person says "no stops" or "just make it", skip both stops.

## The rules that make it clear

1. **One picture for the whole video.** Build it from the source's own core example: a tower of layers for a paper about a model's insides, the example sentence with arcs for attention, the system diagram for an engineering post. Every later point happens on that same picture: something lights up, moves, gets swapped or switched off. Do not cut to a new diagram per point.
2. **The picture shows what the voice says, at the word it says it.** Every change is cued to a word of the narration (`"9:spider"`). If a sentence has no visible change, rewrite the sentence or add the change.
3. **A term appears only when its thing is already on screen.** Say "that middle stretch is the workspace" while the band lights up, not before.
4. **Show, don't list.** No formulas in the narration, no bullet lists on screen when something can be shown. On-screen text is for names, the exact words a lens or a quote shows, and short notes of two to five words.
5. **One caption line**, burned in. X and most feeds autoplay muted.
6. **Calm motion.** About one change per second, eased in and out, things keep their place. Nothing flashes for decoration.

## Facts

- Every claim in the narration comes from the source, with its place: section heading, figure or paragraph. Keep the exact quotes in `videos/<slug>/facts.md` before writing the script.
- If a number is not in the source, either drop it or show it as a sketch and say so on screen ("illustrative").
- The video is about the source, not from it: never present it as made by the authors or their company. Credit the authors and link the source on screen.
- Opinions stay attributed: "the authors argue", "Dario writes". Do not take sides.

## Steps

1. **Source.** `node scripts/ingest.mjs <slug> <url | file>` writes `videos/<slug>/source.md` and prints the outline. Read the outline first, then the parts you need. X threads and Articles need a logged-in browser: ask the person to paste the text into a `.md` file, or read the page in their browser if you have a browser tool and they agree, then ingest the file with `--kind post`.
2. **Format.** Pick the beat sheet by kind: `docs/formats/paper.md`, `essay.md` or `post.md`.
3. **Facts.** Write `facts.md`: each quote verbatim, with its section.
4. **Script.** Write `script.txt` (format below). Short sentences, spoken American English, one idea per line. Check each line against facts.md.
5. *(Stop 1.)*
6. **Voice.** `node scripts/voice.mjs <slug>` uses ElevenLabs when `ELEVENLABS_API_KEY` is in `.env`, otherwise a free voice on this machine (`--local am_michael` or `af_heart`; the first run downloads ~90 MB). Other TTS: `--chunks` prints the text per take, then pass the WAV files.
7. **Storyboard.** Write `storyboard.json` (`docs/storyboard.md`): the one picture and every change cued to a word. For a sentence-shaped idea, use the row (the example sentence) and its elements. For a system, loop or argument, draw the final frame as one SVG and reveal it part by part (`docs/svg.md`).
8. **Check.** `node scripts/make.mjs <slug> check` renders each moment small and reports overlapping or cut-off text. Fix and repeat until it says "no overlaps, nothing cut off". Then look at the contact sheets once, as a viewer: does each frame show what its caption says?
9. *(Stop 2.)* **Render.** `node scripts/make.mjs <slug> render` writes `out/<slug>.mp4` in about 1–2 minutes.

## script.txt

```
# A The silent step
"The number of legs on the animal that spins webs is..."
Eight. To get there, you thought "spider". But nobody said "spider".
# B The tower and the lens
Picture the model as a tower. The question goes in at the bottom.
Figure {35|thirty-five}: a safety test, read from the inside.
```

- `# Title` starts a block. Blocks are the beats.
- One line = one caption phrase, 1–3 short sentences. Lines are numbered from 1 for cues.
- `{shown|spoken}`: the caption shows the first, the voice says the second.

## post.md

The text to post with the video, under 280 characters before the link:

```
<the hook: the source's most surprising point, one sentence>

<what the video walks through, one line>

<title> by <authors>: <link>
```

No hashtags, no "thread", no emojis unless the person asks. Credit the authors; don't write as if you were them.

## Time budget

Source and facts about 3 minutes, script about 2, voice 1–2, storyboard and check about 3, render about 2. If a step takes much longer, the picture is probably too complicated: simplify it.
