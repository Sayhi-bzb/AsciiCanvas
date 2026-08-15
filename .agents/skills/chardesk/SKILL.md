---
name: chardesk
description: Authoritative syntax and verified two-phase workflow for CharDesk Unicode, ESC-less ANSI text, and `.slides.md` decks. Use when Codex needs to read, write, style, edit, or review CharDesk content or Slides files.
---

# CharDesk formats

Load only the reference required:

- For Canvas text or ANSI styling, read [`references/ansi.md`](references/ansi.md).
- For `.slides.md` deck structure, read [`references/slides.md`](references/slides.md).
- For styled Slides content, read the Slides reference first, then the ANSI reference.

For a new styled Canvas, use one artifact name and this filesystem workflow:

1. Write `.chardesk/work/<name>/plain.txt` with `apply_patch`; finish layout first.
2. The Hook creates `styled.ans` and publishes the default canvas. If absent,
   run `npm exec -- chardesk-canvas seed <plain> <styled>`.
3. Patch only intentionally styled spans in `styled.ans`. Unstyled cells inherit
   the renderer default; do not color the whole Canvas. Reset after each span.
4. The Hook publishes `<name>.chardesk`, byte-identical to validated `styled.ans`.
   Without it, run `npm exec -- chardesk-canvas publish <plain> <styled> <name>.chardesk`.

Styling must not change visible text or cell geometry. A rejection is repairable:
retry at most twice, then return the Plain layout. The validator owns ANSI, CJK,
grapheme, and width logic; never reproduce it. Do not probe for MCP with shell.
