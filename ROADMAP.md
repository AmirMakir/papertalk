# Roadmap

What works now, and what is left before publishing.

## Works

- Papers end to end: J-space (2:10) and Attention Is All You Need, from ingest to render.
- Blog posts end to end: "Building always-on agents" (2:04), drawn as one SVG revealed part by part (`docs/svg.md`).
- Ingest: arXiv HTML, transformer-circuits.pub, blogs and essays (Readability), a single X post (oEmbed), local md/txt/html/pdf.
- Voice: a free local voice (Kokoro) by default, ElevenLabs when a key is set (written, not yet run with a real key), or WAVs from any TTS; the local aligner times every word.
- Check: overlap and cut-off report, contact sheets drawn by Remotion (no Chrome needed).
- `/papertalk <link>` in Claude Code with two stops (script, before render) and a post for X; `doctor` checks the setup.
- MCP server with the whole pipeline as tools.

## Sources

- [ ] **X threads and Articles.** They only load when logged in. Options: the agent reads the page in the user's own browser (Claude in Chrome), or the paid X API. Decide which.
- [ ] **PDF without an HTML version.** `pdftotext` loses headings; try the agent's own PDF reading, or GROBID.
- [ ] **Figures from the source.** Crop a figure and show it with a credit line. Waits on a per-source licence check: arXiv papers under CC BY are fine with credit, most others are not.

## Formats

- [x] paper: `docs/formats/paper.md`, two examples.
- [x] essay: `examples/always-on` (an Anthropic engineering post). Still to try: an opinion piece.
- [ ] post: first pilot on an X post that links a paper.

## Kit (the picture)

- [ ] Quote card: the exact words, the author, the place in the source. Needed for essays and posts.
- [ ] Post card: name, handle and the quoted sentence, without avatar or X interface.
- [ ] Plots with axes: a line or scatter that draws itself, with a highlighted point.
- [ ] Graphs that build: nodes and edges appearing, then a path lighting up. This is also the argument picture for essays.
- [ ] Timeline.
- [ ] Figure element (image, crop, zoom, highlight box), once figures are allowed.
- [ ] 9:16 vertical cut of the same storyboard for Reels and Shorts.

## Pipeline

- [x] Claude Code plugin: `/plugin install papertalk --marketplace AmirMakir/papertalk`; settings for voice, key (keychain) and folder; the engine installs once into the plugin's data folder.
- [ ] Plugin icon (512 px PNG) and a submission to Anthropic's plugin directory.
- [ ] Run the ElevenLabs path once with a real key.
- [ ] Typecheck and a tiny render in CI.

## Before publishing

- [x] Engine: Remotion. Free for individuals and teams of up to three; bigger companies buy a Remotion licence, as the README says.
- [x] Licence for our code: MIT.
- [x] Name: papertalk. README with two preview GIFs.
- [ ] Full example videos hosted somewhere (the X posts) and linked from the README.
- [ ] Check that no keys, personal paths or voice files are in git, and that the default voice ID in `scripts/voice.mjs` is a public ElevenLabs library voice.
- [ ] Launch post on X: the J-space video plus "made with papertalk", with a link.
