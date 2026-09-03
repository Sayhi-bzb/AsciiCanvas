# Blackboard packages

A Blackboard is a wall-sized university teaching board: a broad field where a
subject unfolds across several regions while earlier reasoning remains visible.
The viewport moves across the board; it does not define the board's edge.

A visual workshop stands beside the board. Its rendering assistant can typeset
Markdown, draft Mermaid, plot Vega-Lite data, compose mathematics, render
structured trees and source, arrange movable fields, and letter with color or
glyphs. Every instrument leaves compatible marks on the same surface alongside
freehand character work.

A Blackboard package divides one Canvas into independently editable spatial
contexts. `blackboard.yaml` is its first-read context map; `.panel` files own
local content.

```text
orbital-rendezvous/
├── blackboard.yaml
└── panels/
    ├── question.panel
    ├── geometry.panel
    ├── equations.panel
    ├── evidence.panel
    └── synthesis.panel
```

```yaml
chardesk: blackboard/v1
title: Orbital rendezvous
panels:
  question:
    source: panels/question.panel
    summary: The problem to solve
  geometry:
    source: panels/geometry.panel
    summary: Relative motion
  equations:
    source: panels/equations.panel
  evidence:
    source: panels/evidence.panel
  synthesis:
    source: panels/synthesis.panel
layout:
  areas:
    - [question, geometry, evidence]
    - [equations, geometry, synthesis]
  gap:
    column: 4
    row: 1
```

`chardesk init` places the first mark in `main.panel`; the context map grows as
the subject acquires regions.

- `chardesk`, `panels`, and `layout.areas` are required.
- `title` defaults to the package directory name; `summary` is optional
  one-line routing context.
- Panel sources are package-relative `.panel` paths and stay inside the package.
- Repeated IDs form one filled rectangle; `null` is an empty area.
- Content determines track sizes. The layout matrix carries no coordinates or
  dimensions.
- Registered Panels outside `layout.areas` remain valid drafts and produce a
  warning.
- Panel content may draw from the [materials](materials.md).

The Reader flattens the package into one static Freeform Canvas. The matrix is
source organization rather than a visible node or persistent runtime layer.
