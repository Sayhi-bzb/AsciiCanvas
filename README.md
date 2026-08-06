## Star History

<a href="https://www.star-history.com/?repos=Sayhi-bzb%2FAsciiCanvas&type=date&logscale=&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=Sayhi-bzb/AsciiCanvas&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=Sayhi-bzb/AsciiCanvas&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=Sayhi-bzb/AsciiCanvas&type=date&legend=top-left" />
 </picture>
</a>

[English] | [简体中文](./README.zh-CN.md)

# ASCII Canvas

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/Framework-React_19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Collaboration](https://img.shields.io/badge/Sync-Yjs_CRDT-orange?logo=distributed-systems)](https://yjs.dev/)
[![Deploy](https://img.shields.io/badge/Demo-Live_Preview-22c55e?logo=cloudflare-pages)](https://ascii-canvas.pages.dev/)
[![npm: protocol](https://img.shields.io/npm/v/%40ascii-canvas%2Fprotocol?label=%40ascii-canvas%2Fprotocol)](https://www.npmjs.com/package/@ascii-canvas/protocol)
[![npm: fonts](https://img.shields.io/npm/v/%40ascii-canvas%2Ffonts?label=%40ascii-canvas%2Ffonts)](https://www.npmjs.com/package/@ascii-canvas/fonts)

> **A Unicode grid editor for freeform drawing and structured ASCII UI composition.**

<div align="center">
  <img src="public/demo.gif" alt="ASCII Canvas Demo" width="100%" style="border-radius: 6px; border: 1px solid #333; margin: 5px;">
</div>

<br />

<p align="center">
  <img src="public/Cover.png" alt="ASCII Canvas Cover" width="100%" style="border-radius: 8px; border: 1px solid #333; box-shadow: 0 8px 30px rgba(0,0,0,0.12);">
</p>

<p align="center">
  <a href="https://ascii-canvas.pages.dev/">
    <img src="https://img.shields.io/badge/Try_Live_Demo-Click_Here-22c55e?style=for-the-badge&logo=rocket" height="40">
  </a>
</p>

---

## Core Features

**ASCII Canvas** renders editable Unicode grids instead of opaque pixels. It is built for drawings and UI surfaces that humans can inspect visually and LLMs can still read as text.

It supports two session modes:

- **Freeform**: an infinite ASCII canvas for sketching, diagrams, terminal-style layouts, and exploratory drawing.
- **Structured**: a semantic canvas where text, backgrounds, boxes, split boxes, and lines stay editable as structured nodes.

### 1. Structured Canvas

- **Structured nodes**: compose scenes from `text`, `bg`, `box`, `splitBox`, and `line` nodes instead of flattening everything into plain text.
- **Components tab**: drag reusable UI molecules such as buttons, badges, inputs, cards, tables, charts, progress bars, calendars, and scroll areas.
- **Template tab**: insert full scene examples such as Safari, File tree, Timeline, Snippet, and Terminal.
- **Layer-aware backgrounds**: `bg` nodes can sit under text and borders as real background layers, or above content when deliberately reordered.
- **Split layouts**: `splitBox` supports resizable regions for panels, cards, terminals, and compound UI sketches.

### 2. Structured Editing

- **Direct manipulation**: select one or many structured nodes, move them together, and resize box, background, split box, and line shapes with handles.
- **Text editing**: double-click structured text to edit it in place; click elsewhere to leave editing mode.
- **Selection formatting**: apply toolbar changes to selected text ranges instead of only whole text nodes.
- **Shape styling**: control character color for box, split box, and line strokes; control background fill separately for `bg` layers.
- **Surface and structure copy**: copy structured data inside Structured mode, or paste selected structured surfaces into Freeform mode.

### 3. Freeform Drawing

- **Multi-layer rendering**: background, scratch, and UI layers keep interaction responsive.
- **Grid-aware Unicode**: CJK, Emoji, Nerd Font, PUA icons, and box drawing characters are handled as grid cells.
- **Smart text flow**: newline indentation and two-cell tab stepping keep text aligned.
- **Character library**: browse Unicode, Nerd Font, Emoji, and Box Drawing characters from the right sidebar.
- **Precision selection**: drag rectangular selections, use `Shift + Click` anchor selection, and fill selected areas with typed characters.

### 4. Clipboard, ANSI, And Protocol

- **Context menu**: copy, copy as ANSI, cut, paste, and delete from the canvas.
- **ANSI import/export**: paste standard ESC ANSI or ANSI-like text such as `[38;2;190;24;93m...`, interpreted by the [AsciiCanvas Text Protocol v1](packages/protocol/spec/v1.md).
- **Portable rendering**: use [`@ascii-canvas/fonts`](packages/fonts/README.md) for the default renderer font profile and self-hosted glyph assets.
- **Terminal style parsing**: supports 8-color, bright 16-color, 256-color, truecolor SGR, and attributes such as bold, italic, underline, and strikethrough.
- **App document format**: JSON protocol v1 covers Freeform and Structured sessions for application import/export. It is separate from the public Text Protocol npm package.

---

## Use AsciiCanvas Output

Use [`@ascii-canvas/protocol`](https://www.npmjs.com/package/@ascii-canvas/protocol) when another application needs AsciiCanvas-compatible Unicode and ANSI layout without embedding the editor:

```bash
npm install @ascii-canvas/protocol
```

```ts
import { parseAsciiCanvasText } from "@ascii-canvas/protocol";

const surface = parseAsciiCanvasText(
  "[38;2;255;0;0m+---+[0m\n| 界 |"
);

for (const cell of surface.cells) {
  // Render cell.text at cell.x/cell.y; cell.width is 1 or 2 grid columns.
}
```

The parsed cells are rendering-neutral and can drive Canvas, HTML, SVG, terminal, or other surfaces. A renderer owns inherited colors, `inverse` resolution, link sanitization, and actual drawing.

For AsciiCanvas's default glyph coverage, optionally install [`@ascii-canvas/fonts`](https://www.npmjs.com/package/@ascii-canvas/fonts):

```bash
npm install @ascii-canvas/fonts
```

```ts
import "@ascii-canvas/fonts/fonts.css";
import { ASCII_CANVAS_FONT_PROFILE } from "@ascii-canvas/fonts";

await document.fonts.ready;
context.font = `16px ${ASCII_CANVAS_FONT_PROFILE.families.text}`;
```

These packages do not include the React editor, a ready-made renderer, or the app's JSON document format. See the [Text Protocol v1 specification](packages/protocol/spec/v1.md), [normative fixtures](packages/protocol/fixtures/v1.json), [protocol package guide](packages/protocol/README.md), and [font package guide](packages/fonts/README.md).

---

## Showcase

<div align="center">
  <img src="public/Case/Case.webp" width="100%" style="border-radius: 6px; border: 1px solid #333; margin: 5px;" />
</div>

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 7
- **State Management**: Zustand 5 with slice-based store modules
- **Styling**: Tailwind CSS 4, Radix UI, shadcn/ui-style primitives
- **Rendering**: layered Canvas 2D rendering with grid metrics for wide characters
- **Font routing**: [self-hosted assets and the default renderer font profile](packages/fonts/README.md)
- **Character catalog**: curated packs and a lazy Unicode explorer
- **Synchronization**: Yjs / Y-IndexedDB
- **Gestures**: @use-gesture/react
- **Terminal Text**: SGR foreground/background, text attributes, and ANSI/ANSI-like import/export

---

## Getting Started

### Installation

```bash
git clone https://github.com/Sayhi-bzb/ascii-canvas.git
cd ascii-canvas
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

---

## Shortcuts And Workflows

| Action | Shortcut / Gesture | Description |
| :-- | :-- | :-- |
| Freeform selection | `Drag` | Select a rectangular grid area |
| Anchor selection | `Shift + Click` | Select from the anchor point to the current point |
| Fill selection | `Char Key` | Fill active selections with the typed character |
| Smart newline | `Enter` | Insert a new line with inherited indentation |
| Pave space | `Tab` | Move the text cursor right by 2 grid units |
| Context menu | `Right Click` | Copy, copy as ANSI, cut, paste, and delete |
| Structured text edit | `Double Click` text | Enter in-place structured text editing |
| Structured insert | Drag from sidebar | Drop components or templates into the structured canvas |

Paste accepts plain text, app-native rich clipboard data, and ANSI/ANSI-like styled terminal text.

---

## Roadmap

- [x] Multi-layer canvas rendering engine.
- [x] Real-time collaboration via Yjs.
- [x] Intelligent indentation and tab system.
- [x] Context menu and ANSI clipboard integration.
- [x] Structured canvas with editable text, backgrounds, boxes, split boxes, and lines.
- [x] Structured Components and Templates libraries.
- [x] JSON protocol v1 for Freeform and Structured sessions.
- [ ] **NES (Next Edit Suggestion)**: predictive character placement based on layout patterns.
- [ ] **AI Chat Integration**: natural language interface for generating canvas components.
- [ ] Full ANSI terminal sequence workspace and SVG export support.

---

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
