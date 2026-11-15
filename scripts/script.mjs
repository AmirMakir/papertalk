// The narration script: "# Block" headings and one narration line per text line.
// {2017|twenty seventeen} shows "2017" on screen and sends "twenty seventeen" to the voice.
import { syllables } from "./align.mjs";

const brkOf = (tok) => {
  const s = tok.replace(/["'”’)\]]+$/, "");
  if (/[.?!]$/.test(s)) return 3;
  if (/[,:;—–]$/.test(s)) return 2;
  return 0;
};

export function parseScript(text) {
  const lines = [];
  const blocks = [];
  for (const raw of text.split(/\r?\n/)) {
    const s = raw.trim();
    if (!s || s.startsWith("//")) continue;
    if (s.startsWith("#")) {
      blocks.push({ id: blocks.length + 1, title: s.replace(/^#+\s*/, ""), first: lines.length + 1 });
      continue;
    }
    if (!blocks.length) blocks.push({ id: 1, title: "", first: 1 });
    const groups = [];
    const re = /\{([^|}]*)\|([^}]*)\}(\S*)|(\S+)/g;
    let m;
    while ((m = re.exec(s))) {
      if (m[4] !== undefined) groups.push({ disp: [m[4]], spk: [m[4]] });
      else {
        const disp = m[1].trim().split(/\s+/);
        const spk = m[2].trim().split(/\s+/);
        disp[disp.length - 1] += m[3];
        spk[spk.length - 1] += m[3];
        groups.push({ disp, spk });
      }
    }
    lines.push({ n: lines.length + 1, block: blocks.length, groups, display: groups.flatMap((g) => g.disp).join(" "), spoken: groups.flatMap((g) => g.spk).join(" ") });
  }
  // flat list of spoken words with the break after each
  const words = [];
  lines.forEach((l, li) => {
    const lastOfBlock = li === lines.length - 1 || lines[li + 1].block !== l.block;
    l.groups.forEach((g, gi) =>
      g.spk.forEach((tok, k) => {
        const lastTok = gi === l.groups.length - 1 && k === g.spk.length - 1;
        words.push({ tok, syl: syllables(tok), brk: lastTok ? (lastOfBlock ? 5 : 4) : brkOf(tok), line: l.n, group: gi });
      }),
    );
  });
  return { lines, blocks, words };
}
