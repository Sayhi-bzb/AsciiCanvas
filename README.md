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
[![React](https://img.shields.io/badge/Framework-React_18-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Collaboration](https://img.shields.io/badge/Sync-Yjs_CRDT-orange?logo=distributed-systems)](https://yjs.dev/)
[![Deploy](https://img.shields.io/badge/Demo-Live_Preview-22c55e?logo=cloudflare-pages)](https://ascii-canvas.pages.dev/)

> **"The native visual interface for the LLM era: An infinite, multi-byte ASCII canvas designed to be the shared whiteboard for Humans and AI."**

<div align="center">
  <img src="public/demo.gif" alt="ASCII Canvas Demo" width="100%" style="border-radius: 6px; border: 1px solid #333; margin: 5px;">
</div>

<br />

<p align="center">
  <img src="public/Cover.png" alt="ASCII Canvas Cover" width="100%" style="border-radius: 8px; border: 1px solid #333; box-shadow: 0 8px 30px rgba(0,0,0,0.12);">
</p>

<p align="center">
  <a href="https://ascii-canvas.pages.dev/">
    <img src="https://img.shields.io/badge/✨_Try_Live_Demo-Click_Here-22c55e?style=for-the-badge&logo=rocket" height="40">
  </a>
</p>

---

## 🛠 Core Features

**ASCII Canvas** is a high-performance, collaborative ASCII art creation engine. Unlike traditional whiteboards that output pixels (opaque to LLMs), this engine renders structured, semantic Unicode grids.

It now supports three session modes:

- **Freeform**: the original infinite ASCII canvas for exploratory drawing.
- **Animation**: a fixed-size frame timeline for ASCII motion work.
- **Structured**: an in-progress layout mode for semantic scene construction.

### 1. High-Performance Rendering

- **Multi-layer Architecture**: Utilizes three distinct layers (Background, Scratch, and UI) to maintain 60FPS.
- **Mode-aware Viewports**: Freeform uses an infinite viewport, while Animation uses a fixed camera and bounded canvas.

### 2. Intelligent Layout Engine

- **Setback Inheritance**: Smart newline logic automatically detects and maintains indentation.
- **Wide-Character Support**: Native support for **CJK characters**, **Nerd Fonts**, and **Emojis**.
- **Modular Indentation**: Professional Tab system shifting cursor by 2 grid units.
- **Character Library**: Browse Unicode, Nerd Font, Emoji, and Box Drawing characters from a dense right sidebar with character names/tooltips.

### 3. Animation Workflow

- **Fixed Canvas Presets**: Start animation sessions with common sizes like `80x25`, `64x64`, and `128x128`, or enter custom dimensions.
- **Frame Sidebar**: Add, duplicate, delete, reorder, and rename frames from a dedicated left sidebar with compact previews.
- **Onion Skin Playback**: Toggle ghosted neighboring frames for frame-by-frame ASCII animation.
- **Export Ready**: Export animations as lightweight JSON, GIF, asciinema `.cast`, or ANSI text for the current frame.

### 4. Distributed Collaboration

- **Yjs CRDT Integration**: Real-time, low-latency collaborative editing.
- **Robust Persistence**: High-granularity undo/redo management with local storage sync.

### 5. Precision Editing & Clipboard

- **Anchor Zoning**: `Shift + Click` for rapid rectangular selection.
- **Mass Fill**: Instantly fill active selections with any character.
- **Context Hub**: Professional menu for Copy, Copy as ANSI, Cut, Paste, and Delete operations.
- **ANSI Clipboard**: Copy selected content as truecolor ANSI-like text without ESC (`[38;2;R;G;Bm`) and paste standard ANSI or ANSI-like text such as `[38;2;190;24;93m...`.

---

## Showcase

<div align="center">
  <img src="public/Case/Case.webp" width="100%" style="border-radius: 6px; border: 1px solid #333; margin: 5px;" />
</div>

---

## Tech Stack

- **Frontend**: React 18, TypeScript
- **State Management**: Zustand (Slice Pattern)
- **Synchronization**: Yjs / Y-IndexedDB
- **Gestures**: @use-gesture/react
- **Animation Export**: JSON exchange format, in-browser GIF generation, and simple asciinema `.cast` frame streams
- **Terminal Text**: ANSI-like truecolor copy, standard ANSI export, and ANSI-like paste parsing
- **UI Components**: Tailwind CSS, Shadcn UI, Radix UI

---

## 🚀 Getting Started

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

## ⌨️ Shortcuts Reference

| Action            | Shortcut        | Description                                       |
| :---------------- | :-------------- | :------------------------------------------------ |
| **Zoning**        | `Drag`          | Traditional rectangular area selection            |
| **Anchor Zoning** | `Shift + Click` | Create selection between anchor and current point |
| **Mass Fill**     | `Char Key`      | Fill active selection with the pressed character  |
| **Smart Newline** | `Enter`         | New line with inherited indentation               |
| **Pave Space**    | `Tab`           | Shift cursor right by 2 grid units                |
| **Context Menu**  | `Right Click`   | Access Copy, Copy as ANSI, Cut, Paste, and Delete |

Paste accepts plain text, app-native rich clipboard data, and ANSI/ANSI-like truecolor text. Animation sessions also expose timeline controls for frame stepping, playback, loop, ghost toggle, and JSON/GIF/asciinema `.cast` export from the animation bar/sidebar UI.

---

## 🗺 Roadmap

- [x] Multi-layer Canvas rendering engine.
- [x] Real-time collaboration via Yjs.
- [x] Intelligent Indentation & Tab system.
- [x] Context Menu & Clipboard integration.
- [x] Fixed-size animation mode with timeline, onion skin, and export.
- [x] Simple asciinema `.cast` import/export for animation frame streams.
- [x] ANSI-like truecolor copy, standard ANSI export, and ANSI-like paste parsing.
- [ ] **NES (Next Edit Suggestion)**: Predictive character placement based on layout patterns.
- [ ] **AI Chat Integration**: Natural language interface for generating canvas components.
- [ ] Full ANSI terminal sequence workspace and SVG export support.

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
