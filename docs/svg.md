# Drawing the picture as SVG

Use this when the one picture isn't a sentence or a tower: a system, a loop, a pipeline, an argument. Example: `examples/always-on/picture.svg` (an agent with its inbox, timers, memory, permissions and outbox).

## The method

1. **Draw the final frame first.** One SVG with everything the video will ever show, laid out as it looks at the end. Every later frame is this picture with parts hidden or dimmed.
2. **Give every part that appears at its own moment an `id`**, as a top-level `<g>`. Group the icon with its label.
3. **Add guide paths for movement**: a `<path id="…">` along each arrow an event travels on. It can be the visible arrow itself or `stroke="none"`.
4. **Step it in the storyboard**: `steps` reveal parts on the word that names them, `focus` dims everything but the part being talked about, `flows` send a dot along a path, `glow` puts a halo on a part.
5. **Check**, look at the sheets once, render.

A 20-part picture takes one pass to write. Because the layout is fixed from the start, nothing jumps around when parts appear.

## The canvas

- `viewBox="0 0 1920 1080"`. Keep everything between y 130 and y 930: the source line and section badge sit above, the caption below.
- Text no smaller than 22 px; labels 28–34 px; names of the main parts 34 px bold.
- Lines 5 px, small chips 3 px, round caps.

## Tokens

| In the SVG | Becomes |
|---|---|
| `$ink` `$pen` `$red` `$mark` `$muted` `$faint` `$card` `$bg` `$key` `$val` | the theme colours (blue `pen` = what's happening now, `red` = what doesn't happen or goes wrong) |
| `$sans` `$serif` `$mono` `$body` | the fonts |
| `marker-end="url(#i-arrow)"`, `#i-arrow-pen`, `#i-arrow-red`, `#i-arrow-muted` | arrowheads |
| `<use href="#i-NAME" x y width height color="$ink"/>` | a built-in icon |

Icons: clock, mail, chat, bolt, db, folder, file, lock, shield, user, bell, cog, bot, bot-sleep, send, check, x, ask, moon, key, list, eye.

## Rules that keep it clean

- Shapes draw themselves on (`"how": "draw"`, the default). Dashed lines can't draw on, so they fade in.
- Don't use `fill-opacity`; pick a lighter colour instead (it is animated during the draw).
- Put a `$card` rectangle behind an icon that sits on a line, so the line doesn't show through.
- An id may appear in several steps to show, hide and show it again, like an agent waking up and falling asleep.
- To show that something does *not* happen, draw the arrow in `$red`, dashed, with an `i-x` on it, and hide it a moment later.

## Storyboard

```json
{ "t": "svg", "src": "picture.svg", "in": "1", "out": "18",
  "steps": [ { "id": "inbox", "in": "6:inbox" }, { "id": "src-hook", "in": "6:webhooks", "how": "pop" } ],
  "focus": [ { "ids": ["agent", "inbox", "src-hook"], "in": "6", "out": "8" } ],
  "flows": [ { "path": "s2", "in": "7:drop", "dur": 1.0, "text": "event" } ],
  "glow":  [ { "id": "memory", "in": "16:memory", "out": "16:acts" } ] }
```

`how`: `draw` (lines draw on, then fills and text fade in), `pop`, `up`, `fade`. Each step also takes `out` and `dur`.
