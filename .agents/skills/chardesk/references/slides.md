# Slide documents

````md
---
chardesk: document/v1
mode: slide
title: Product overview
---

## Opening

```chargraph size=auto
# Product overview
```

## Closing

```chardesk size=80x24
        [36mThank you[0m
```
````

- Frontmatter uses `chardesk: document/v1`, `mode: slide`, and an optional
  title.
- Each `##` heading starts a page followed by its content fence.
- `chardesk` contains compiled Canvas text; `chargraph` compiles visual source
  such as the [casebook](authoring.md). `text` is literal text and `ansi` is
  terminal ANSI input.
- The default frame is `100x27`. A fence may set `size=<columns>x<rows>` or
  `size=auto`; auto sizes the compiled grid with four horizontal and two
  vertical padding cells.
- `.chardesk` is the canonical file entry. Legacy `.slides.md` files remain
  compatibility inputs.
