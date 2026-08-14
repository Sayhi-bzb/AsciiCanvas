---
name: chardesk
description: Authoritative syntax and verified two-phase workflow for CharDesk Unicode, ESC-less ANSI text, and `.slides.md` decks. Use when Codex needs to read, write, style, edit, or review CharDesk content or Slides files.
---

# CharDesk formats

Load only the reference required:

- For Canvas text or ANSI styling, read [`references/ansi.md`](references/ansi.md).
- For `.slides.md` deck structure, read [`references/slides.md`](references/slides.md).
- For styled Slides content, read the Slides reference first, then the ANSI reference.

For new styled Canvas text, first finalize an ANSI-free plain layout. Then call
`create_canvas_draft`, observe its canonical text and revision, and call
`apply_canvas_style` without changing visible text or cell geometry. Retry a
rejected style at most twice; return the plain draft if validation still fails.

When the MCP tools are unavailable, create separate plain and ANSI files and run
`chardesk-canvas validate <plain-file> <ansi-file>`. Treat the references as the
format owners and the validator as the geometry authority; do not reproduce parser logic.
