export const CHARDESK_FONT_PROFILE_ID = "chardesk/default-v1";

export const CHARDESK_TEXT_FONT_FAMILY =
  "'Maple Mono NF CN', 'Noto Sans Symbols 2', ui-monospace, " +
  "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', " +
  "'Courier New', monospace";

export const CHARDESK_EMOJI_FONT_FAMILY =
  "'Noto Emoji', 'Noto Sans Symbols 2', 'Maple Mono NF CN', " +
  "ui-monospace, monospace";

export const CHARDESK_FONT_PROFILE = {
  id: CHARDESK_FONT_PROFILE_ID,
  families: {
    text: CHARDESK_TEXT_FONT_FAMILY,
    emoji: CHARDESK_EMOJI_FONT_FAMILY,
  },
  sources: [
    {
      id: "maple-mono-nf-cn",
      family: "Maple Mono NF CN",
      version: "7.900",
    },
    {
      id: "maple-mono-nf-cn-bold",
      family: "Maple Mono NF CN",
      version: "7.900",
    },
    {
      id: "noto-sans-symbols-2",
      family: "Noto Sans Symbols 2",
      version: "google-fonts-v25",
    },
    {
      id: "noto-emoji",
      family: "Noto Emoji",
      version: "google-fonts-v62",
    },
  ],
} as const;

export type CharDeskFontProfile = typeof CHARDESK_FONT_PROFILE;
export type CharDeskFontRoute = keyof CharDeskFontProfile["families"];
