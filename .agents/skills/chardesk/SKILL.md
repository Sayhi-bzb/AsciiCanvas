---
name: chardesk
description: Authoritative syntax and direct Blackboard workflow for CharDesk Unicode, ESC-less ANSI text, and `.slides.md` decks. Use when Codex needs to read, write, style, edit, or review CharDesk content or Slides files.
---

# CharDesk formats

Load only the required reference:

- Canvas text or ANSI styling: [`references/ansi.md`](references/ansi.md).
- `.slides.md` structure: [`references/slides.md`](references/slides.md).
- Styled Slides: Slides first, then ANSI.

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
