# CharGraph structured sources

Use CharGraph when source structure should become editable Unicode Canvas cells.
The pasted result is materialized content; later renderer-setting changes do not
reinterpret existing cells.

## Source forms

- Standard Markdown: headings, emphasis, links, quotes, lists, task lists,
  thematic breaks, fenced code, and GFM tables.
- GitHub Alerts: `NOTE`, `TIP`, `IMPORTANT`, `WARNING`, and `CAUTION`.
- `diff` and `patch` fences: semantic diff lines.
- `json`, `jsonc`, `yaml`, and `yml` fences: compact Unicode trees. Bare JSON
  or YAML is not detected.
- `mermaid` fences: flowchart, state, sequence, class, ER, and XY chart.
- `vega-lite` or `vegalite` fences: inline Cartesian line, point, bar, and
  error-bar charts. Use `data.values`; URL data and transforms are unsupported.
- Inline math: `$...$` and `\(...\)`.
- Block math: `$$...$$`, `\[...\]`, and `math`, `tex`, or `latex` fences.

Use standard Markdown, Mermaid, and TeX syntax within those supported forms;
do not reproduce their general grammars here. Use
[`examples.ts`](../../../../packages/chargraph/src/examples.ts) for maintained
showcase inputs.

## Composition and fallback

Auto rendering checks block layout first, then composes explicit ANSI with
Markdown. Explicit ANSI foreground, background, and links win; text attributes
merge with Markdown. Read [`ansi.md`](ansi.md) when authoring that combination.

Invalid, unsupported, disabled, or bounded-out extensions preserve their source
instead of inventing a partial diagram or tree. A Mermaid fence is limited to
20,000 UTF-16 code units and 400 lines. Use
[`block-layout.md`](block-layout.md) rather than manual space padding when
several independently rendered fields must be arranged together.

The rendering contract is owned by
[`External Text Rendering`](../../../../apps/docs/content/docs/development/architecture/text-rendering.mdx);
graph coordinate and routing internals are owned by
[`CharGraph layout`](../../../../apps/docs/content/docs/development/architecture/chargraph-layout.mdx).
