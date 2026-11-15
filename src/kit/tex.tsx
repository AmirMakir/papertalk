import React from "react";
import { HEADS, type Theme } from "../theme";

// A small TeX subset for on-screen formulas: \frac{a}{b}, \sqrt{x}, x^{2}, d_k,
// {pen:Q} colours a group by role, \cdot \times \to \sum and Greek letters.
// Single letters (and pairs of capitals like QK) are set in italic as variables; words stay upright.

type N = string | { k: "frac"; a: N[]; b: N[] } | { k: "sqrt"; a: N[] } | { k: "sup" | "sub"; a: N[] } | { k: "col"; c: string; a: N[] } | { k: "big"; s: string };

const SYM: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", theta: "θ", lambda: "λ", mu: "μ", pi: "π", sigma: "σ", tau: "τ", phi: "φ", omega: "ω",
  Sigma: "Σ", Delta: "Δ", nabla: "∇", partial: "∂", cdot: "·", times: "×", to: "→", approx: "≈", le: "≤", ge: "≥", in: "∈", sum: "Σ",
  infty: "∞", ldots: "…", neq: "≠", pm: "±", rightarrow: "→", leftarrow: "←", mid: "|", top: "⊤",
};

export const parseTex = (s: string): N[] => {
  let i = 0;
  const seq = (end?: string): N[] => {
    const out: N[] = [];
    while (i < s.length && s[i] !== end) {
      const c = s[i];
      if (c === "\\") {
        const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i))!;
        i += m[0].length;
        const name = m[1];
        if (name === "frac") out.push({ k: "frac", a: arg(), b: arg() });
        else if (name === "sqrt") out.push({ k: "sqrt", a: arg() });
        else if (name === "big") out.push({ k: "big", s: s[i++] ?? "" });
        else if (name === ",") out.push(" ");
        else out.push(SYM[name] ?? name);
      } else if (c === "^" || c === "_") {
        i++;
        out.push({ k: c === "^" ? "sup" : "sub", a: arg() });
      } else if (c === "{") {
        const m = /^\{([a-z]+[0-9]?):/.exec(s.slice(i));
        if (m) {
          i += m[0].length;
          out.push({ k: "col", c: m[1], a: group() });
        } else {
          i++;
          out.push(...group());
        }
      } else {
        out.push(c);
        i++;
      }
    }
    return out;
  };
  const group = () => {
    const out = seq("}");
    i++;
    return out;
  };
  const arg = (): N[] => {
    while (s[i] === " ") i++;
    if (s[i] === "{") {
      i++;
      return group();
    }
    const c = s[i++];
    return c ? [c] : [];
  };
  return seq();
};

export const roleColor = (th: Theme, c?: string) => {
  if (!c) return th.ink;
  if (/^h\d$/.test(c)) return HEADS[Number(c.slice(1)) % HEADS.length];
  return (th as unknown as Record<string, string>)[c] ?? c;
};

export const Tex: React.FC<{ n: N[]; th: Theme; color?: string }> = ({ n, th, color }) => {
  const out: React.ReactNode[] = [];
  let buf = "";
  const flush = () => {
    if (!buf) return;
    for (const m of buf.matchAll(/[A-Za-z]+|[^A-Za-z]+/g)) {
      const s = m[0];
      if (/^([A-Za-z]|[A-Z]{2})$/.test(s)) out.push(<i key={out.length} style={{ color }}>{s}</i>);
      else out.push(<span key={out.length} style={{ color, whiteSpace: "pre" }}>{s}</span>);
    }
    buf = "";
  };
  for (const x of n) {
    if (typeof x === "string") {
      buf += x;
      continue;
    }
    flush();
    const k = out.length;
    if (x.k === "frac")
      out.push(
        <span key={k} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", verticalAlign: "middle", fontSize: "0.86em", margin: "0 6px" }}>
          <span style={{ padding: "0 8px" }}>
            <Tex n={x.a} th={th} color={color} />
          </span>
          <span style={{ borderTop: `4px solid ${color ?? th.ink}`, padding: "4px 8px 0", alignSelf: "stretch", textAlign: "center" }}>
            <Tex n={x.b} th={th} color={color} />
          </span>
        </span>,
      );
    else if (x.k === "sqrt")
      out.push(
        <span key={k} style={{ color }}>
          √<span style={{ borderTop: `3px solid ${color ?? th.ink}` }}>
            <Tex n={x.a} th={th} color={color} />
          </span>
        </span>,
      );
    else if (x.k === "sup" || x.k === "sub") {
      const Tag = x.k;
      out.push(
        <Tag key={k} style={{ fontSize: "0.58em" }}>
          <Tex n={x.a} th={th} color={color} />
        </Tag>,
      );
    } else if (x.k === "col") out.push(<Tex key={k} n={x.a} th={th} color={roleColor(th, x.c)} />);
    else if (x.k === "big")
      out.push(
        <span key={k} style={{ display: "inline-block", transform: "scaleY(1.9)", color }}>
          {x.s}
        </span>,
      );
  }
  flush();
  return <>{out}</>;
};
