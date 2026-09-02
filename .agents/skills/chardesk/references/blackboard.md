# Blackboard packages

A Blackboard is a working surface. Ideas keep their place, time leaves traces,
and proximity carries meaning.

A Blackboard package divides one Canvas into independently editable spatial
contexts. `blackboard.yaml` is its first-read context map; `.panel` files own
local content.

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
    - [null, architecture]
  gap:
    column: 4
    row: 1
```

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
