---
name: chardesk
description: Authoritative syntax and verified two-phase workflow for CharDesk Unicode, ESC-less ANSI text, and `.slides.md` decks. Use when Codex needs to read, write, style, edit, or review CharDesk content or Slides files.
---

# CharDesk formats

Load only the reference required:

- For Canvas text or ANSI styling, read [`references/ansi.md`](references/ansi.md).
- For `.slides.md` deck structure, read [`references/slides.md`](references/slides.md).
- For styled Slides content, read the Slides reference first, then the ANSI reference.

For new styled Canvas text, finalize the ANSI-free layout first. When
`create_canvas_draft` and `apply_canvas_style` are exposed, call them directly:
create the draft, use its canonical text and revision, then apply style without
changing visible text or cell geometry. After acceptance, persist the returned
`ansi_text` exactly; do not reconstruct it or append a line break. Do not probe
for MCP with shell commands.

A rejected style is repairable, not an unavailable tool. Retry it at most twice;
return the plain draft if validation still fails. Use the CLI fallback only when
an MCP tool is absent or its call reports a transport, startup, or unavailable
error: write separate plain and ANSI files, then run
`chardesk-canvas validate <plain-file> <ansi-file>`. The validator owns geometry;
do not reproduce parser or width logic.
