# storyboard.json

A storyboard says what is on screen and when. Times are cues into the narration, so a change of wording never breaks the timing. `scripts/make.mjs` turns the cues into seconds, checks them, and renders. Comment lines starting with `//` are allowed.

Full examples: `examples/jspace/storyboard.json` (one picture, the tower) and `examples/attention/storyboard.json` (the sentence row with arcs).

## Cues

| Cue | Means |
|---|---|
| `"9"` | line 9 starts |
| `"9$"` | line 9 ends |
| `"9:spider"` | the word "spider" in line 9 is said |
| `"9:is#2"` | the second "is" in line 9 |
| `"B4"` | block 4 starts |
| `"9:spider+0.3"`, `"9$-0.2"` | any cue moved by seconds |

A cue that does not resolve stops the build with the line's text, so typos show at once. Keys that take cues: `in`, `out`, anything ending in `In`, `Out` or `At`, `gin`, `nin`, `lin`, and arrays `ins` and `show`.

## Top level

```json
{
  "paper": { "id": "site.org/path", "title": "…", "link": "site.org/path", "byline": "Authors · Venue, Year" },
  "row": { "text": "The number of legs on the animal that spins webs is", "line": 1, "y": 840, "cx": 850, "width": 1180, "size": 70,
           "alts": [ { "text": "Think of a sport.", "in": "14:new", "out": "16" } ] },
  "tags": [["6", "Methods · The Jacobian Lens"], ["20", ""]],
  "nocaps": [["24", null]],
  "theme": "paper",
  "els": [ … ]
}
```

- `paper.id` stays in the top-left corner the whole time: the viewer always knows what is being explained.
- `row` is the example sentence the picture is built on. `line` makes its words appear as they are said; `show: [[in, out]]` limits when it is visible; `alts` swaps in up to three other sentences for a while.
- `tags` is the section badge, top right: where in the source this part comes from. An empty text hides it.
- `nocaps` hides captions between two cues. `theme` is `paper` (light) or `night`.

## Colours and markup

Roles: `ink` (text), `pen` (blue, attention), `red` (change, removal, warning), `mark` (yellow highlighter), `muted`, `faint`, `key`, `val`, `h0`…`h7` (one colour per item in a set). In any text: `{pen:word}` colours, `*word*` highlights, `~word~` strikes out in red, `\n` breaks the line.

## Elements on the row

Word positions are indices or the word itself (`"w": "spider"`).

| `t` | What it does | Main fields |
|---|---|---|
| `mark`, `underline`, `strike` | highlight, underline or strike one word | `w`, `in`, `out`, `c` |
| `dim` | fade every word but `keep` | `keep`, `in`, `out` |
| `swap` | two words trade places | `a`, `b`, `in`, `out` |
| `replace` | a word flips to another text | `w`, `text`, `c`, `in`, `out` |
| `arcs` | arcs between words (attention, links) | `from`, `to`, `pairs`, `weights`, `wIn`, `heads`, `ins`, `low`, `dots` |
| `tokens` | a small box over each word | `words`, `except`, `lane`, `text`, `solid` |
| `values` | numbers over words that change in steps | `steps`, `lane`, `warn`, `emph` |
| `label` | a note over or under words, or in an area | `text`, `over`/`under`/`lane` or `area`+`x`/`y`, `box`, `plate`, `size`, `serif`, `mono` |
| `tower` | the model as a stack of layers over the row (below) | |

### tower

One column per row word, layer 0 at the bottom.

- `layers` (9), `in`, `out`, `growIn` (when the layers build; the answer box can show earlier).
- `ins: [cue…]` waves of signal running up; `reflows: [{in, from}]` red waves from a layer up.
- `answer: [{in, text, c}]` the box on top; an empty text hides it.
- `band: {from, to, in, label}` highlights a stretch of layers; `off: {in, out}` greys it out.
- `bubbles: [{in, out, text, layer, note, nin}]` a dashed thought, before or over the tower.
- `lens: {col, nsize, stops: [{in, layer, text, c, note, nc}]}` a magnifier on one column. Moving to another layer slides it; same layer with new text plays a swap (old text struck out, new drops in). `{in, hide: true}` puts it away; the next stop brings it back.

## Free elements

Placed by `area`: `title`, `top`, `mid`, `under`, `full`, plus `x` (`left`, `right` or a fraction 0–1 of the area's width, centred there), `y` (`top`, `center`, `bottom`), `dx`, `dy`.

| `t` | What it does | Main fields |
|---|---|---|
| `title` | big serif title, word by word | `text`, `ins`, `hl` (words to highlight), `wrap`, `maxw`, `size` |
| `chips` | term + short gloss pairs | `items: [{term, gloss, in, gin, c}]` |
| `formula` | a small TeX subset (only when the formula is the point) | `tex` or `parts` |
| `stats` | big numbers with a line under each | `items: [{big, sub, in, c}]` |
| `bars` | bars that grow, and with `to: {v, in, c}` change height | `items: [{label, v, text, in, to}]`, `max`, `h`, `bw` |
| `table` | small table, rows appear one by one | `cols`, `rows`, `rowIns`, `hl` |
| `grid`, `stack` | counted cells, stacked boxes | `items` |
| `diagram` | nodes and edges at fractions of the area | `nodes: [{id, text, x, y, kind, in}]`, `edges: [{a, b, label, bend, dash, in}]` |
| `boxes` | a row of words in boxes | `items`, `ins`, `hl` |
| `cards` | where each thing lives in the source, each card may hold a small copy of another element (`pic`) | `items: [{tag, note, in, pic}]` |
| `end` | the link and byline | `link`, `byline`, `size` |
| `svg` | a hand-drawn picture from `src` (an .svg next to the storyboard), revealed part by part; see `docs/svg.md` | `src`, `steps`, `focus`, `flows`, `glow` |

Every element takes `in` and `out`. Sounds are added automatically by element type (`"sfx": false` turns one off, `"sfx": "pop"` picks one).
