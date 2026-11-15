import { fonts } from "./fonts";

// Two looks with the same roles. ink = printed text, pen = attention and notes,
// red = the old way's problems, mark = the highlighter on the word in focus.
export type Theme = { bg: string; dot: string; ink: string; muted: string; faint: string; pen: string; red: string; mark: string; markInk: string; card: string; key: string; val: string; dark: boolean };
export const themes: Record<"paper" | "night", Theme> = {
  paper: { bg: "#F5F1E8", dot: "#DCD5C5", ink: "#17181C", muted: "#7E7B73", faint: "#C6BFAF", pen: "#2B50E0", red: "#D8343B", mark: "#D4FF3A", markInk: "#17181C", card: "#FFFEFA", key: "#C96F00", val: "#0B8F63", dark: false },
  night: { bg: "#0E0F13", dot: "#23262F", ink: "#F3F1EA", muted: "#8D93A3", faint: "#3D4250", pen: "#7C9CFF", red: "#FF6B6B", mark: "#D4FF3A", markInk: "#0E0F13", card: "#181A21", key: "#FFB454", val: "#3DDC97", dark: true },
};
export const F = { serif: fonts.serif, sans: fonts.display, body: fonts.body, mono: fonts.mono };
// one colour per attention head
export const HEADS = ["#2B50E0", "#C96F00", "#0B8F63", "#C026D3", "#D8343B", "#0891B2", "#7C3AED", "#65A30D"];
export const W = 1920;
export const H = 1080;
export const FPS = 30;
