# Slide documents

A Slide is one visual moment in a sequence. Each page advances the thought while
remaining inside the document's established scene.

```text
product-overview/
├── blackboard.yaml
└── panels/
    ├── opening.panel
    └── closing.panel
```

```yaml
chardesk: blackboard/v2
mode: slide
title: Product overview
panels:
  opening:
    source: panels/opening.panel
    title: Opening
  closing:
    source: panels/closing.panel
    title: Closing
layout:
  pages: [opening, closing]
```

- One `.panel` owns one page; `layout.pages` owns sequence.
- Panel content draws freely from the available [materials](materials.md).
- Page size follows compiled content automatically. Leave `size` absent.
- A user-requested fixed frame sets `size: <columns>x<rows>` on that Panel.
- Page titles are unique; an omitted `title` uses the Panel ID.
- Registered Panels outside `layout.pages` remain drafts.
- Standalone `.chardesk` Slide documents and legacy `.slides.md` remain
  compatibility inputs.
