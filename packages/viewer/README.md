# @chardesk/viewer

DOM-first viewer for CharDesk Unicode and ANSI text. It renders selectable text, keeps the original source available for copying, and requires no framework.

## Install

```sh
npm install @chardesk/viewer @chardesk/fonts
```

Load the CharDesk font profile once in the host page, then register the custom element:

```ts
import "@chardesk/fonts/fonts.css";
import "@chardesk/viewer/register";
```

## Declarative usage

Keep the source in a light-DOM `pre`. It remains readable when JavaScript is unavailable; after registration, the Viewer uses it as source and renders the enhanced view in Shadow DOM.

```html
<chardesk-viewer fit="width">
  <pre data-chardesk-source>┌─────────┐
│ Human   │──&gt; LLM
└─────────┘</pre>
</chardesk-viewer>
```

Use `controls="false"` for a passive embed. The default reading controls appear on hover or keyboard focus, and remain visible on touch devices. They provide zoom, fit, grid-selection copy, plain-text copy, and exact-source copy. See the [responsive Host demo](https://github.com/Sayhi-bzb/CharDesk/blob/main/packages/viewer/demo.html).

The default `interaction="grid"` adds a terminal-style reading layer without replacing the DOM text. Click to place a cell cursor, drag to create a persistent rectangular cell selection, or use Shift with the arrow keys to extend it. Grid selections include empty and trailing cells; use `interaction="text"` when native browser text-flow selection is preferred. The system cursor remains the default arrow over content and a pointer over links. Manual zoom preserves the Viewer frame and changes the internal scrollable surface; Fit and source changes may recalculate the frame height.

## Programmatic usage

```ts
import {
  CharDeskViewerElement,
  defineCharDeskViewer,
} from "@chardesk/viewer";

defineCharDeskViewer();

const viewer = document.querySelector<CharDeskViewerElement>(
  "chardesk-viewer"
)!;
viewer.source = "[38;2;255;80;80mWarning[0m";
viewer.syntax = "ansi";
viewer.fitToViewport("width");
```

### Properties

- `source`: Unicode text with optional standard or ESC-less ANSI.
- `syntax`: `"auto"`, `"plain"`, or `"ansi"`.
- `zoom`: scale from `0.25` through `4`.
- `fit`: `"none"`, `"width"`, or `"contain"`.
- `controls`: shows or hides the built-in reading controls.
- `interaction`: `"grid"` (default) or `"text"`.
- `parsedDocument`: the latest `ParsedCharDeskText`, including diagnostics.
- `cursor`: the current `{ x, y }` cell, or `null`.
- `selection`: the current `{ anchor, focus, rect }` grid selection, or `null`.

### Methods

- `fitToViewport(mode?)`
- `resetZoom()`
- `copyPlainText()`
- `copySource()`
- `setCursor(point)`
- `setSelection(anchor, focus)`
- `clearSelection()`
- `copySelection()`

The element emits `chardesk-zoom-change`, `chardesk-copy`, `chardesk-copy-error`, `chardesk-cursor-change`, and `chardesk-selection-change` events. Rectangular copies preserve empty and trailing cells; a selection boundary that meets a double-width grapheme expands to include the complete grapheme.

## Theme

Override Viewer CSS variables from the host:

```css
chardesk-viewer {
  --chardesk-font-size: 14px;
  --chardesk-fit-max-font-size: 20px;
  --chardesk-line-height: 1.25;
  --chardesk-color: #e5e7eb;
  --chardesk-background: #111827;
  --chardesk-border-color: transparent;
  --chardesk-control-color: #d1d5db;
  --chardesk-control-hover-background: #1f2937;
}
```

Width fit is the default. It fills the available width until the effective
character size reaches `--chardesk-fit-max-font-size`; narrower documents then
stay centered. Manual zoom is not limited by this fit-only cap.

The default theme follows the Host color scheme. Stable Shadow Parts include
`root`, `toolbar`, `zoom-controls`, `copy-controls`, `control`, `zoom-out`,
`zoom-in`, `fit`, `copy-text`, `copy-source`, `viewport`, `stage`, `surface`,
`document`, `interaction-layer`, `selection`, and `cursor`.

The remaining font, border, and control variables are visible in the element's Shadow DOM stylesheet. ANSI links are untrusted input: the Viewer renders only HTTP(S), mailto, relative, and fragment links.
