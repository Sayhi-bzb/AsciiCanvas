import {
  ASCII_CANVAS_FONT_PROFILE,
  type AsciiCanvasFontRoute,
} from "@ascii-canvas/fonts";

export type RenderFontRoute = AsciiCanvasFontRoute;

const EMOJI_PRESENTATION = /\p{Emoji_Presentation}/u;
const EMOJI_MODIFIER = /\p{Emoji_Modifier}/u;
const EXTENDED_PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
const REGIONAL_INDICATOR_PAIR = /^\p{Regional_Indicator}{2}$/u;
const KEYCAP_SEQUENCE = /^[#*0-9]\uFE0F?\u20E3$/u;

export const resolveRenderFontRoute = (
  grapheme: string
): RenderFontRoute => {
  if (!grapheme) return "text";
  if (KEYCAP_SEQUENCE.test(grapheme)) return "emoji";
  if (REGIONAL_INDICATOR_PAIR.test(grapheme)) return "emoji";
  if (grapheme.includes("\uFE0F")) return "emoji";
  if (EMOJI_MODIFIER.test(grapheme)) return "emoji";
  if (
    grapheme.includes("\u200D") &&
    EXTENDED_PICTOGRAPHIC.test(grapheme)
  ) {
    return "emoji";
  }
  return EMOJI_PRESENTATION.test(grapheme) ? "emoji" : "text";
};

export const getRenderFontFamily = (route: RenderFontRoute) =>
  ASCII_CANVAS_FONT_PROFILE.families[route];

export const getRenderFontFamilyForGrapheme = (grapheme: string) =>
  getRenderFontFamily(resolveRenderFontRoute(grapheme));
