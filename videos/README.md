# videos/

One folder per video, made by the scripts and ignored by git:

```
videos/<slug>/
  source.md, source.json   what is being explained (scripts/ingest.mjs)
  facts.md                 exact quotes with their place in the source
  script.txt               the narration, one caption line per line
  vo/                      voice takes and the text per take
  voice.wav, timing.json   the voice track and every word's time (scripts/voice.mjs)
  storyboard.json          what is on screen and when
```

Finished videos go to `out/<slug>.mp4`.
