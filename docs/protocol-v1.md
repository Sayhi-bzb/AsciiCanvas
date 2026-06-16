# ASCII Canvas Protocol v1

## Overview

`ascii-canvas-document` is the canonical interchange format for ASCII Canvas.
It is a mode-aware document schema for internal adapters, future import/export
work, and AI-facing serialization.

Protocol header:

- `type`: always `"ascii-canvas-document"`
- `version`: always `1`
- `mode`: `"freeform" | "animation" | "structured"`

Color encoding is preserved exactly as the editor stores it today: CSS-compatible
color strings such as hex values. The protocol does not normalize to ANSI or a
palette in v1.

Coordinates are absolute sparse canvas coordinates. Cells and nodes that are not
present are omitted from the document.

## Mode Payloads

### Freeform

```json
{
  "type": "ascii-canvas-document",
  "version": 1,
  "mode": "freeform",
  "cells": [
    { "x": 0, "y": 0, "char": "@", "color": "#ff0000" }
  ]
}
```

### Animation

```json
{
  "type": "ascii-canvas-document",
  "version": 1,
  "mode": "animation",
  "size": { "width": 80, "height": 25 },
  "playback": { "fps": 12, "loop": true },
  "frames": [
    {
      "id": "f1",
      "name": "Idle",
      "cells": [{ "x": 1, "y": 2, "char": "@", "color": "#ff0000" }]
    }
  ]
}
```

### Structured

```json
{
  "type": "ascii-canvas-document",
  "version": 1,
  "mode": "structured",
  "nodes": [
    {
      "id": "node-1",
      "type": "box",
      "order": 1,
      "start": { "x": 0, "y": 0 },
      "end": { "x": 10, "y": 5 },
      "name": "Panel",
      "style": { "color": "#111111" }
    }
  ]
}
```

Structured mode preserves semantic nodes rather than flattening them into a grid.

## Compatibility Rules

- v1 is additive foundation work only; legacy export formats stay valid.
- Builders must not include transient editor state such as selections, scratch
  layers, hovered cells, or open-panel UI state.
- Future versions should branch by `version` rather than mutating v1 semantics.

## Export Integration

The export dialog JSON path should use `ascii-canvas-document@v1` as the primary
serialized format for `freeform`, `animation`, and `structured` modes.

- PNG and GIF exports remain visual export paths and do not change protocol shape.
- Asciinema `.cast` import/export is an animation-only terminal playback
  adapter. It serializes each animation frame as a v2 output event and is not
  the primary JSON representation.
- Plain text export remains available for freeform copy/export workflows.
- Structured F12 text remains a compatibility helper format and is no longer the
  primary JSON export representation.

## ANSI Export

ANSI export is a display protocol for terminals, not the canonical data format.

- ANSI output uses SGR truecolor foreground sequences (`38;2;R;G;B`).
- Current implementation exports foreground color only.
- Freeform and structured ANSI output are grid-based terminal renderings.
- Animation ANSI export targets the current frame as fixed-size terminal text.

## Asciinema Cast

`.cast` support targets simple frame streams, not full terminal emulation.

- Import reads asciinema v2 headers and `"o"` output events into animation
  frames.
- Export writes one full-frame output event per animation frame using the
  timeline FPS.
- Imported event timing is rounded to the nearest FPS and capped at 60 FPS.
- Supported input terminal text is limited to printable graphemes, CR/LF,
  SGR reset, and SGR truecolor foreground sequences.
- Cursor movement, clear-screen, background colors, and 8/256-color palette
  terminal semantics are out of scope for this adapter.
