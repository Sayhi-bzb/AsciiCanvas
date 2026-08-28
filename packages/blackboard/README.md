# @chardesk/blackboard

Shared compiler and local Reader for either one Freeform `.chardesk` or a
multi-file Blackboard package. Structured and Slide documents are rejected.

- App Menu → File → Import Blackboard imports a selected package directory as an editable Freeform snapshot.
- `serve [board.chardesk|blackboard.yaml|directory] [--port 7331]` serves the main CharDesk application at `/blackboard` on loopback.
- `check <board.chardesk|blackboard.yaml|directory>` validates the source and every registered Panel.

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

The Agent writes source files with native filesystem tools. The server composes
packages into one static Freeform projection and keeps no second revision or
runtime layout layer.

The App directory importer uses the same compiler but creates a normal editable
session. CharGraph Panels materialize the standard light Renderer Theme; explicit
ANSI still has precedence. Later source or Renderer Theme changes do not update
that imported snapshot. Use
[`demo/gpu-blackboard`](../../demo/gpu-blackboard) for a compact example and
[`demo/gpu-deep-dive-blackboard`](../../demo/gpu-deep-dive-blackboard) for a
multi-panel CharGraph showcase.

The main application build must exist before `serve` starts. Blackboard uses a
non-persistent `freeform` session with navigation, selection, and copy enabled;
content mutation and session management remain disabled for the Human host.
