---
name: chardesk
description: Authoritative syntax and direct Blackboard workflow for canonical `.chardesk` documents, Canvas text, CharGraph structured sources, ESC-less ANSI, block layouts, and Slides. Use when Codex needs to create, edit, style, or review CharDesk content.
---

# CharDesk formats

Load only the required reference:

- Canvas text or ANSI styling: [`references/ansi.md`](references/ansi.md).
- Markdown, fenced Mermaid or data, and math: [`references/chargraph.md`](references/chargraph.md).
- Multi-field or multi-row Canvas composition: [`references/block-layout.md`](references/block-layout.md).
- Slide document structure: [`references/slides.md`](references/slides.md).
- Headless source checking or artifact rendering: [`references/rendering.md`](references/rendering.md).
- Styled Slides: Slides first, then ANSI.
- Slides that compile Markdown, Mermaid, data, math, or block layout: Slides
  first, then CharGraph; load Block Layout when the source uses `|||` or `---`.
- Structured fields in a block layout: Block Layout first, then CharGraph; also
  load ANSI only when the source uses explicit CharDesk styles.

For a Blackboard, use the named `.chardesk` path or `blackboard.chardesk` when
none is named:

1. Read an existing Blackboard before writing.
2. Patch locally with `apply_patch`; clear or replace only when explicitly asked.
3. For a new complex layout, write Plain first, then add sparse style controls
   with a second patch to the same file. Unstyled cells use the default style.
4. Run `npm exec -- chardesk-blackboard check <board.chardesk>`.
5. Report only what changed and where; do not repeat the Blackboard in chat.

The protocol owns ANSI, CJK, grapheme, and width logic. Use visible ESC-less
controls in `.chardesk`; never emit terminal ESC bytes or reproduce validation.
