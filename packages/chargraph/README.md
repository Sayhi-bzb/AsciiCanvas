# @chardesk/chargraph

CharDesk's source compiler. It transforms explicit text source kinds into
styled fragments and Protocol-laid-out rows without a DOM.

```ts
import {
  compileCharDeskText,
  materializeCompiledCharDeskText,
} from "@chardesk/chargraph";

const compiled = await compileCharDeskText(source, {
  sourceKind: "chargraph",
});
const document = materializeCompiledCharDeskText(compiled);
```

`chargraph` recognizes Markdown, Mermaid, fenced data, math, and block layout.
`chardesk` parses compiled ESC-less ANSI, `ansi` accepts terminal ANSI, and
`plain` preserves literal text. Hosts must select a kind explicitly; exported
CharDesk cells must not be reinterpreted as CharGraph source.

CharGraph emits diagnostics and source-aware fragments. `@chardesk/protocol`
alone owns grapheme segmentation, CJK width, tabs, and cell coordinates. See
[UPSTREAM.md](./UPSTREAM.md) for adapted renderer attribution.
