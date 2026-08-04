# @ascii-canvas/protocol

Parser and conformance data for [AsciiCanvas Text Protocol v1](./spec/v1.md). The package converts plain ASCII/Unicode, standard ANSI, and AsciiCanvas ESC-less ANSI into rendering-neutral cells. It contains no DOM or renderer.

## Install

```sh
npm install @ascii-canvas/protocol
```

## Parse

```ts
import { parseAsciiCanvasText } from "@ascii-canvas/protocol";

const document = parseAsciiCanvasText(
  "[38;2;255;0;0m+---+[0m\n| 界 |",
  { defaultStyle: { color: "#111827" } }
);

for (const cell of document.cells) {
  // cell: { x, y, width, text, color?, bgColor?, attrs?, href? }
}
```

Use `document.source` when preserving ANSI copy and `document.plainText` or `stripAsciiCanvasAnsi(source)` for plain-text copy.

## API

- `parseAsciiCanvasText(source, options?)`
- `stripAsciiCanvasAnsi(source, options?)`
- `splitGraphemes(text)`
- `getGraphemeCellWidth(grapheme)`
- `getTextCellWidth(text)`
- `ASCII_CANVAS_TEXT_PROTOCOL_VERSION`
- `UNICODE_DATA_VERSION`

The default syntax mode is `auto`; use `plain` to disable control parsing or `ansi` to force ESC-less numeric SGR parsing. The default tab size is four cells.

See [`fixtures/v1.json`](./fixtures/v1.json) for portable conformance cases. Parsed links are untrusted and must be sanitized by the renderer.

For AsciiCanvas-compatible glyph coverage, renderers may use the optional [`@ascii-canvas/fonts`](https://www.npmjs.com/package/@ascii-canvas/fonts) profile.
