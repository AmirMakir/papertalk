import { loadFont as loadDisplay } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadBody } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadSerif } from "@remotion/google-fonts/Newsreader";

// All four are open-licence Google Fonts, loaded at render time.
export const fonts = {
  display: loadDisplay("normal", { weights: ["500", "700"], subsets: ["latin"] }).fontFamily,
  body: loadBody("normal", { weights: ["400", "600", "800"], subsets: ["latin"] }).fontFamily,
  mono: loadMono("normal", { weights: ["400", "700"], subsets: ["latin"] }).fontFamily,
  serif: (loadSerif("italic", { weights: ["500"], subsets: ["latin"] }), loadSerif("normal", { weights: ["500", "600"], subsets: ["latin"] }).fontFamily),
};
