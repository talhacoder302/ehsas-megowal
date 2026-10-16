import "server-only";
import path from "node:path";
import type { Style } from "@react-pdf/types";
import { Font, Text, View } from "@react-pdf/renderer";
import { formatNumber } from "@/lib/money";

// Shared pieces of the PDFs (receipts and monthly reports).
// Keep Urdu lines from starting with a digit (the bidi engine moves it to the
// end) and use plain ASCII signs: the Naskh font has no "−" or "·".
// Urdu uses Noto Naskh Arabic UI. react-pdf's text engine cannot shape Nastaliq
// (it runs out of memory), and with plain Naskh or Sans Arabic it drops the
// first letter of many words; the UI variant renders correctly.
// Each label and value is its own <Text> so Urdu and Latin never mix in one run.
export const URDU_FONT = "NotoNaskh";
export const LATIN_FONT = "Helvetica";

let fontsRegistered = false;
export function registerFonts() {
  if (fontsRegistered) return;
  const dir = path.join(process.cwd(), "assets", "fonts");
  Font.register({
    family: URDU_FONT,
    fonts: [
      { src: path.join(dir, "NotoNaskhArabicUI-Regular.ttf") },
      { src: path.join(dir, "NotoNaskhArabicUI-Bold.ttf"), fontWeight: 700 },
    ],
  });
  // Never break words with hyphens (it splits Urdu words).
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

/** Text with no Arabic-script letters can use the Latin font. */
export function isLatin(text: string): boolean {
  return !/[؀-ۿ]/.test(text);
}

export const colors = { ink: "#1c1917", muted: "#6b6460", line: "#e7e2dd", brand: "#0f6b47", danger: "#b42318", soft: "#f4f1ee" };

// Type only; @react-pdf/types ships with @react-pdf/renderer.
export type Styles = Style | Style[];

function styleList(style: Styles | undefined): Style[] {
  return Array.isArray(style) ? style : [style ?? {}];
}

const urduText: Style = { fontFamily: URDU_FONT };
const latinText: Style = { fontFamily: LATIN_FONT };

/** A piece of text in the font its script needs. */
export function T({ children, style }: { children: string; style?: Styles }) {
  return <Text style={[isLatin(children) ? latinText : urduText, ...styleList(style)]}>{children}</Text>;
}

/** "Rs. 1,500" in English; "1,500" and "روپے" as two pieces in Urdu. */
export function Money({ amount, rtl, rupees, style }: { amount: number; rtl: boolean; rupees: string; style?: Styles }) {
  const text = formatNumber(Math.abs(amount));
  const sign = amount < 0 ? "-" : "";
  if (!rtl) return <T style={style}>{`${sign}Rs. ${text}`}</T>;
  return (
    <View style={{ flexDirection: "row-reverse", gap: 3, alignItems: "center" }}>
      <T style={style}>{`${sign}${text}`}</T>
      <T style={style}>{rupees}</T>
    </View>
  );
}
