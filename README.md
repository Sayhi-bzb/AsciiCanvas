[English] | [简体中文](./README.zh-CN.md)

# CharDesk

> **A Unicode canvas for humans and AI.**

CharDesk, formerly ASCII Canvas, is an editable Unicode grid for drawing diagrams, interfaces, and ideas. What you create stays visual for people and readable as text for language models.

<p align="center">
  <a href="https://chardesk.com/">
    <img src="https://img.shields.io/badge/Open_CharDesk-22c55e?style=for-the-badge" alt="Open CharDesk">
  </a>
</p>

<div align="center">
  <img src="public/demo.gif" alt="Drawing on CharDesk" width="100%">
</div>

## A shared visual language

People understand layout at a glance. Language models work naturally with token sequences. Screenshots bridge that gap, but they also carry pixel noise, consume visual context, and are difficult to revise precisely across multiple turns.

CharDesk uses text itself as the visual medium. A diagram remains a diagram when you look at it, yet it can still be copied, searched, versioned, and given directly to an AI without becoming an opaque image.

```text
┌──────────────┐       ┌──────────────┐
│ Human intent │──────>│ Shared canvas│
└──────────────┘       └──────┬───────┘
                              │
                       ┌──────▼───────┐
                       │ AI-readable  │
                       │ text         │
                       └──────────────┘
```

## Make ideas visible

Use CharDesk for:

- flowcharts, architecture diagrams, and system maps;
- interface wireframes and terminal-style mockups;
- notes where spatial relationships matter;
- Unicode art, icons, tables, and lightweight data views;
- visual context that can move between a conversation, document, issue, or source file.

No drawing skill is required. Start with shapes and templates, arrange them visually, then copy the result as text whenever you need it elsewhere.

## One canvas, three ways to work

### Freeform

Draw directly on an infinite character grid. Place text and symbols anywhere, paint with Unicode characters, select regions, and reshape ideas without leaving the canvas.

### Structured

Build with editable text, boxes, backgrounds, dividers, lines, and arrows. Move and resize parts without redrawing the whole scene, or begin with reusable interface components and complete templates.

### Slides

Arrange a deck as editable text pages, or ask an Agent to generate a `.chardesk` document and continue editing it visually. See the [Slides file structure](.agents/skills/chardesk/references/slides.md).

## Built for the human–AI loop

CharDesk keeps visual work in a form that fits naturally into text conversations:

1. Compose or refine an idea visually.
2. Copy it as plain text or ANSI-styled text.
3. Give the compact representation to an AI for analysis or revision.
4. Paste text back into the canvas and continue visually.

The application does not require a built-in AI provider. The artifact itself is the interface: portable text that both sides can inspect.

## Text can carry more than words

CharDesk brings together Unicode symbols, CJK characters, emoji, box drawing, Nerd Font glyphs, and color on a consistent grid. Its visual language can express structure and emphasis while remaining selectable and editable.

<p align="center">
  <img src="public/Cover.png" alt="Unicode and ANSI artwork in CharDesk" width="100%">
</p>

## See what it can become

<div align="center">
  <img src="public/Case/Case.webp" alt="Examples created with CharDesk" width="100%">
</div>

<p align="center">
  <a href="https://chardesk.com/"><strong>Open CharDesk and start creating →</strong></a>
</p>

## For builders

CharDesk output can also be consumed outside the editor. Use the [`chardesk` CLI](packages/cli/README.md) to check source or render it as PNG and materialized text, [`@chardesk/protocol`](packages/protocol/README.md) for the text interchange format, [`@chardesk/viewer`](packages/viewer/README.md) for framework-independent web rendering, and [`@chardesk/fonts`](packages/fonts/README.md) for compatible glyph assets. [CharGraph](https://chardesk.com/chargraph/) presents structured source as portable Unicode text. Each package owns its installation and API documentation.

## Thanks

Thanks to [LINUX DO](https://linux.do/).

## License

CharDesk is open source under the [MIT License](LICENSE).
