# @chardesk/blackboard

Shared compiler and local Reader for multi-file Blackboard and Slide packages.

- App Menu → File → Import Blackboard stores the selected package in the browser repository and opens a read-only Blackboard session.
- `chardesk inspect --panel <id>` validates and materializes one package Panel.
- `chardesk open` serves the main CharDesk application on a tokenized loopback URL.

A package uses one root manifest and local Panel sources:

```text
gpu/
├── blackboard.yaml
└── panels/
    ├── introduction.panel
    └── architecture.panel
```

```yaml
chardesk: blackboard/v1
title: GPU
panels:
  introduction:
    source: panels/introduction.panel
    summary: GPU overview
  architecture:
    source: panels/architecture.panel
layout:
  areas:
    - [introduction, architecture]
  gap:
    column: 4
    row: 1
```

`layout.areas` follows named-area matrix semantics. Repeated IDs form one
filled rectangular span; `null` is empty space. Panel content determines track
sizes, so the manifest contains no coordinates or dimensions. Registered but
unused Panels are valid drafts and produce a warning.

An ordered Slide deck uses the same package shape:

```yaml
chardesk: blackboard/v2
mode: slide
title: GPU
panels:
  introduction:
    source: panels/introduction.panel
  architecture:
    source: panels/architecture.panel
    title: Architecture
layout:
  pages:
    - introduction
    - architecture
```

Each Panel is one page. Its compiled content determines page dimensions by
default; omit `size`. A deliberately fixed frame may set `size: 100x27` on that
Panel. `layout.pages` owns navigation order.

The package is the authority. Compilation produces a disposable Canvas surface;
it never writes source state into Canvas Yjs content.
`analyzeBlackboardSourceTree` classifies visible, draft, and unreferenced files
against the `blackboard.yaml` entry graph without materializing the Canvas.

The App keeps browser workspaces in IndexedDB and exposes revision-aware file CRUD
through page tools. Invalid edits remain saved while the last valid surface stays
visible. The local Reader watches filesystem sources and uses the same compiler.
CharGraph Panels materialize the standard light Renderer Theme; explicit ANSI
still has precedence. Use
[`demo/gpu-blackboard`](../../demo/gpu-blackboard) for a compact example and
[`demo/gpu-deep-dive-blackboard`](../../demo/gpu-deep-dive-blackboard) for a
multi-panel CharGraph showcase.

Source-backed Blackboard and Slide sessions support navigation, selection, copy,
import, export, and Slide playback. Human content mutation and collaboration are
disabled; Agents edit source files.
