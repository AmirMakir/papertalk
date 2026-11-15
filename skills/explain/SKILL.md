---
name: explain
description: Turn a paper, blog post, essay or X post into a 1–2.5 minute horizontal explainer video where the picture shows exactly what the voice says. Use on /papertalk:explain <link or file>, "make a video of this paper/post", "explain this article in a video".
---

# papertalk: source in, explainer video out

The viewer should finish the video able to say the source's main idea in one sentence and know where to look in it. The video is not a teaser and not a full walk-through.

## Commands

Every step runs through one launcher. Below, `pt` stands for:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/papertalk.mjs"
```

Write it out in full in each Bash call. The first call of a session is `init`, with the settings the person chose when installing:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/papertalk.mjs" --data "${CLAUDE_PLUGIN_DATA}" --home "${user_config.output_dir}" --voice "${user_config.voice}" --local-voice "${user_config.local_voice}" init
```

`init` remembers these settings, installs the engine the first time (about 1 GB, 1–3 minutes: say so before running it, and run it in the background if your Bash tool allows), and checks the setup. Later calls need only `pt <command>`. Every path the commands print is absolute; the person's videos are in the folder `pt where` reports as `home`.

## One command, two stops

When the person runs `/papertalk:explain <link or file>`:

1. Run `init`. If something is marked ✗, say what to do and stop.
   **The voice.** If `init` says "Voice: not chosen yet", ask the person once, before anything else:
   - **Free voice on this computer**: no key, no cost; about 90 MB downloads once. Male `am_michael` or female `af_heart`. To hear them first: `pt sample am_michael,af_heart`, then open the two WAVs it prints.
   - **ElevenLabs**: more natural, needs their API key. The safe place for it is the plugin's settings: `/plugin` → **Installed** → papertalk → **Configure options**, which keeps the key in the system keychain; then `/reload-plugins`. Never ask for the key in chat and never write it anywhere yourself.
   - **Their own voice files** from another text-to-speech service.

   Save the answer with `pt setup --voice local am_michael` (or `--voice eleven`, `--voice files`), so later runs don't ask.
2. Do steps 1–4 below (source, format, facts, script) without asking anything.
3. **Stop 1.** Show the person, in a few lines: the main idea in one sentence, the one picture you will draw, and the script. Ask for an OK or changes. Don't make the voice before the OK.
4. Do steps 6–8 (voice, storyboard, check). Fix the check until it is clean.
5. **Stop 2.** Show the contact sheets the check printed and ask whether to render.
6. Render, open the video, and write `post.md` next to the script (below). Reply with the video's path, its length, and the post text.

If the person says "no stops" or "just make it", skip both stops.

## The rules that make it clear

1. **One picture for the whole video.** Build it from the source's own core example: a tower of layers for a paper about a model's insides, the example sentence with arcs for attention, the system diagram for an engineering post. Every later point happens on that same picture: something lights up, moves, gets swapped or switched off. Do not cut to a new diagram per point.
2. **The picture shows what the voice says, at the word it says it.** Every change is cued to a word of the narration (`"9:spider"`). If a sentence has no visible change, rewrite the sentence or add the change.
3. **A term appears only when its thing is already on screen.** Say "that middle stretch is the workspace" while the band lights up, not before.
4. **Show, don't list.** No formulas in the narration, no bullet lists on screen when something can be shown. On-screen text is for names, the exact words a lens or a quote shows, and short notes of two to five words.
5. **One caption line**, burned in. X and most feeds autoplay muted.
6. **Calm motion.** About one change per second, eased in and out, things keep their place. Nothing flashes for decoration.

## Facts

- Every claim in the narration comes from the source, with its place: section heading, figure or paragraph. Keep the exact quotes in `facts.md` before writing the script.
- If a number is not in the source, either drop it or show it as a sketch and say so on screen ("illustrative").
- The video is about the source, not from it: never present it as made by the authors or their company. Credit the authors and link the source on screen.
- Opinions stay attributed: "the authors argue", "Dario writes". Do not take sides.

## Steps

The video's folder is `<home>/videos/<name>/`, where `<name>` is short kebab-case.

1. **Source.** `pt ingest <name> <link or file>` writes `source.md` and prints the outline. Read the outline first, then the parts you need. X threads and Articles need a logged-in browser: ask the person to paste the text into a `.md` file, or read the page in their browser if you have a browser tool and they agree, then `pt ingest <name> <file> --kind post`.
2. **Format.** Pick the beat sheet by kind: `${CLAUDE_PLUGIN_ROOT}/docs/formats/paper.md`, `essay.md` or `post.md`.
3. **Facts.** Write `facts.md` in the video's folder: each quote verbatim, with its section.
4. **Script.** Write `script.txt` (format below). Short sentences, spoken American English, one idea per line. Check each line against facts.md.
5. *(Stop 1.)*
6. **Voice.** With the free voice or own files: `pt voice <name>` (own files: `pt voice <name> --chunks` prints the text per take; ask the person for the WAVs, then `pt voice <name> take-1.wav …`). With ElevenLabs, use the `papertalk_voice` tool of this plugin's MCP server instead: it holds the key, the Bash tool doesn't.
7. **Storyboard.** Write `storyboard.json` (`${CLAUDE_PLUGIN_ROOT}/docs/storyboard.md`): the one picture and every change cued to a word. For a sentence-shaped idea, use the row (the example sentence) and its elements. For a system, loop or argument, draw the final frame as one SVG next to the storyboard and reveal it part by part (`${CLAUDE_PLUGIN_ROOT}/docs/svg.md`). Worked examples: `${CLAUDE_PLUGIN_ROOT}/examples/`.
8. **Check.** `pt check <name>` renders each moment small and reports overlapping or cut-off text. Fix and repeat until it says "no overlaps, nothing cut off". Then look at the contact sheets once, as a viewer: does each frame show what its caption says?
9. *(Stop 2.)* **Render.** `pt render <name>` writes `<home>/out/<name>.mp4` in about 1–2 minutes.

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
