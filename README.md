# papertalk

Give it a paper, a blog post or a post on X. Get back a 1–2.5 minute explainer video, 16:9, where the picture shows exactly what the voice is saying.

<p>
  <img src="docs/media/jspace.gif" width="49%" alt="A paper explained on one picture: a lens rides up a tower of model layers and reads the word spider in the middle">
  <img src="docs/media/always-on.gif" width="49%" alt="A blog post explained as one diagram: an agent with its inbox, timers, memory, permissions and outbox">
</p>

Claude Code does the reading and the writing. papertalk does the rest: it fetches the source, voices the script, times every word, draws and animates the picture, checks every frame for overlapping text and renders the video.

No API keys needed: the thinking runs on your Claude subscription and the voice is generated on your machine. With an ElevenLabs key, the voice sounds more natural.

## Start

Needs Node 20+ and [Claude Code](https://claude.com/claude-code).

```bash
git clone https://github.com/AmirMakir/papertalk && cd papertalk
npm install
node scripts/doctor.mjs        # checks everything, downloads Remotion's headless browser
claude
```

Then in Claude Code:

```
/papertalk https://arxiv.org/abs/1706.03762
```

The first time, Claude asks which voice to use: the free one on your computer, ElevenLabs with your own key (you paste it into `.env`, never into the chat), or your own voice files. The answer is saved, so it asks only once.

Then Claude reads the source and shows you the main idea, the picture it plans and the script. After your OK it makes the voice and the storyboard, checks every frame and shows you contact sheets. After your second OK it renders `out/<name>.mp4` and writes a post to go with it. It takes about 10–15 minutes. Say "no stops" to skip both questions.

## What makes the videos clear

- **One picture for the whole video**, built from the source's own example. Every point happens on it: something lights up, moves, gets swapped or switched off.
- **The picture changes on the word that names the change.** Timings come from the voice itself, word by word.
- **A term appears only once its thing is on screen.**
- **No formulas or bullet lists where something can be shown.** One caption line, because feeds autoplay muted.
- **Facts only from the source**, each with its place in it, credited and linked on screen.

The full rules are in [the skill](.claude/skills/papertalk/SKILL.md).

## Sources

| Source | How |
|---|---|
| arXiv | its HTML version (most papers since late 2023) |
| Research sites, blogs, essays | the readable part of the page |
| A post on X | X's public embed, no login |
| X threads and Articles | need a login: paste the text into a `.md` file and give Claude the file |
| Your files | `.md`, `.txt`, `.html`, `.pdf` (PDF needs `pdftotext` from poppler) |

Only the page text is fetched. Images stay as links.

## By hand, without the skill

```bash
node scripts/ingest.mjs <name> <link or file>   # videos/<name>/source.md + outline
# write videos/<name>/script.txt and storyboard.json (see docs/)
node scripts/voice.mjs <name>                   # ElevenLabs if the key is set, else the free local voice
node scripts/make.mjs <name> check              # overlap report + contact sheets in out/
node scripts/make.mjs <name> render             # out/<name>.mp4
```

Voice: `node scripts/setup.mjs --voice local am_michael` (or `af_heart` and other [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) voices), `--voice eleven` with `ELEVENLABS_API_KEY` in `.env`, or `--voice files` for WAVs from any TTS. `--sample am_michael,af_heart` writes samples to listen to.

## In other MCP clients

```bash
claude mcp add papertalk -- node /absolute/path/to/papertalk/mcp/server.mjs
```

Cursor, Claude Desktop and other MCP clients get the same steps as tools: `papertalk_guide` (the rules), `papertalk_ingest`, `papertalk_write`, `papertalk_voice_text`, `papertalk_voice`, `papertalk_check`, `papertalk_render`.

## How it fits together

```
source ──ingest──▶ source.md ──Claude──▶ facts.md, script.txt
                                              │
                               voice ─────────┴──▶ voice.wav + every word's time
                                                          │
                                        Claude ──▶ storyboard.json (+ picture.svg)
                                                          │
                                   check: frames + overlap report ──▶ render ──▶ out/<name>.mp4
```

```
src/kit/          the picture: sentence row, arcs, tower and lens, bars, diagrams, svg, the frame checker
scripts/          ingest, voice (+ word aligner, local TTS), make (check and render), doctor, sound effects
mcp/server.mjs    the same steps as MCP tools
docs/             storyboard and SVG reference, formats for papers, essays and posts
examples/         finished scripts, storyboards and facts
videos/<name>/    your work (git-ignored)
```

## Licences

papertalk's code is MIT. Rendering uses [Remotion](https://www.remotion.dev/license): free for individuals and companies of up to three people, while larger companies need a Remotion company licence. The local voice is Kokoro-82M (Apache-2.0). Fonts are Google Fonts under the Open Font License. Sound effects are generated by `scripts/sfx.mjs`, with no samples.

The videos explain other people's work: credit the authors, link the source, quote briefly, and don't present the video as coming from them.
