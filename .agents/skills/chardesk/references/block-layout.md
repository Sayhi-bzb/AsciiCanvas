# Block Layout syntax

Use Block Layout to arrange independently rendered source fields without pixel
or cell coordinates. A control is recognized only when it occupies a line by
itself; surrounding horizontal whitespace is ignored.

```text
AA
|||
BB
---
CC
|||
DD
```

This produces two layout rows: `AA` beside `BB`, then `CC` beside `DD`.

- `|||`: start the next field in the current layout row.
- `---`: start the first field of the next layout row.
- `\|||` and `\---`: emit literal control lines without creating a boundary.
- Empty fields and rows are valid.

Every field independently uses the normal CharGraph text renderer, so a field
may contain Markdown, fenced Mermaid or data, math, or explicit ANSI. Rows begin
below the tallest field in the previous row. Defaults are four columns between
fields and one blank row between layout rows.

Block Layout is recognized before Markdown. A standalone `---` therefore starts
a layout row; use `***` for a Markdown thematic break. Parsing, serialization,
and placement are owned by
[`block-layout.ts`](../../../../packages/chargraph/src/block-layout.ts) and
verified by
[`block-layout.test.ts`](../../../../packages/chargraph/src/block-layout.test.ts).
