# Upstream

The renderer in `src/vendor` is derived from
[`beautiful-mermaid`](https://github.com/lukilabs/beautiful-mermaid) 1.1.3 at
commit `65f4e0ab8c289e9691a9e5bc4f9eac7108cf449b`.

Only the text-rendering pipeline and its parsers are retained. CharDesk wraps
that pipeline with its Unicode cell-width protocol; SVG, DOM, and ELK layout
are intentionally outside this package.

Vendored files are excluded from repository lint and TypeScript diagnostics.
The typed package boundary and renderer fixtures own verification of local
adaptations.
