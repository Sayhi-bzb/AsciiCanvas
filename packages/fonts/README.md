# @chardesk/fonts

Self-hosted assets and the default renderer font profile for CharDesk output. This package is optional: [`@chardesk/protocol`](https://www.npmjs.com/package/@chardesk/protocol) remains rendering-neutral.

## Install

```sh
npm install @chardesk/fonts
```

Load the faces once, then use the exported stacks when rendering protocol cells:

```ts
import "@chardesk/fonts/fonts.css";
import { CHARDESK_FONT_PROFILE } from "@chardesk/fonts";

await document.fonts.ready;
context.font = `16px ${CHARDESK_FONT_PROFILE.families.text}`;
```

The legacy-compatible `ascii-canvas/default-v1` profile routes ordinary text through Maple Mono NF CN and Noto Sans Symbols 2, and emoji presentation through monochrome Noto Emoji first. The source versions are exported in `CHARDESK_FONT_PROFILE` and recorded with checksums in `manifest.json`.

Font files are distributed under the SIL Open Font License found beside each family in `assets/*/OFL.txt`. Package code is MIT licensed.
