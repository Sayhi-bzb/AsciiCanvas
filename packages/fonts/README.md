# @ascii-canvas/fonts

Self-hosted assets and the default renderer font profile for AsciiCanvas output. This package is optional: [`@ascii-canvas/protocol`](../protocol/README.md) remains rendering-neutral.

## Install

```sh
npm install @ascii-canvas/fonts
```

Load the faces once, then use the exported stacks when rendering protocol cells:

```ts
import "@ascii-canvas/fonts/fonts.css";
import { ASCII_CANVAS_FONT_PROFILE } from "@ascii-canvas/fonts";

await document.fonts.ready;
context.font = `16px ${ASCII_CANVAS_FONT_PROFILE.families.text}`;
```

`ascii-canvas/default-v1` routes ordinary text through Maple Mono NF CN and Noto Sans Symbols 2, and emoji presentation through monochrome Noto Emoji first. The source versions are exported in `ASCII_CANVAS_FONT_PROFILE` and recorded with checksums in `manifest.json`.

Font files are distributed under the SIL Open Font License found beside each family in `assets/*/OFL.txt`. Package code is MIT licensed.
