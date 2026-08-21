# Upstream

The Mermaid renderer in `src/vendor` is derived from
[`beautiful-mermaid`](https://github.com/lukilabs/beautiful-mermaid) 1.1.3 at
commit `65f4e0ab8c289e9691a9e5bc4f9eac7108cf449b`.

Only the text-rendering pipeline and its parsers are retained. CharDesk wraps
that pipeline with its Unicode cell-width protocol. SVG and DOM rendering stay
outside this package; Flow and State placement uses `elkjs` behind CharDesk's
layout-neutral graph contract and integer-cell projection.

Vendored files are excluded from repository lint and TypeScript diagnostics.
The typed package boundary and renderer fixtures own verification of local
adaptations. CharDesk's local text renderer also resolves overlapping Unicode
box-drawing strokes from their four-way connection topology instead of relying
on upstream's order-sensitive glyph-pair table.

The Markdown renderer is adapted from the block, inline, list, and table
behavior of
[`marked-terminal`](https://github.com/mikaelbr/marked-terminal) 7.3.0.
CharDesk retains the renderer behavior rather than the published package so
the browser build does not inherit Chalk, TTY detection, `node:process`, or
terminal-specific highlighting. Styling is emitted through the CharDesk text
protocol, code highlighting stays with Shiki, and cell measurement uses the
protocol's Unicode width implementation. See `LICENSE.marked-terminal`.
