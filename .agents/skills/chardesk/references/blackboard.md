# Blackboard packages

Use a package when one Freeform canvas needs independently editable spatial
contexts. `blackboard.yaml` is the first-read context map; `.panel` files own
local content and local Block Layout.

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
- `title` defaults to the package directory name.
- `summary` is optional one-line routing context.
- Panel sources are package-relative `.panel` paths and cannot escape the package.
- Repeated IDs must form one filled rectangle; `null` is an empty area.
- Content determines track sizes. Do not add coordinates or dimensions.
- Registered Panels outside `layout.areas` are valid drafts and produce a warning.
- Panel content uses normal CharGraph, ANSI, CJK, and Block Layout rules.

The Reader flattens the package into one static Freeform canvas. App directory
import creates an editable snapshot and does not retain a filesystem link. The
matrix is source organization, not a visible node or persistent runtime layout
layer.
