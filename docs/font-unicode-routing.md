# Font and Unicode Routing

This page owns font selection, grid width, loading, and asset policy.

Character discovery and catalog policy are owned by
[Character Library](character-library.md).

## Font Roles

| Route | Order | Role |
| --- | --- | --- |
| Text | Maple Mono NF CN → Noto Sans Symbols 2 → system monospace | ASCII, box drawing, common CJK, Nerd Font PUA, then missing technical symbols |
| Emoji | Noto Emoji → Noto Sans Symbols 2 → Maple Mono NF CN → system monospace | Monochrome supported Emoji; visible system fallback for unsupported Emoji |

Text symbols remain Maple glyphs when Maple covers them. Noto Sans Symbols 2 only fills missing glyphs. Common music signs are supported; full musical notation is out of scope.

## Routing and Width

Routing operates on grapheme clusters. Emoji presentation, VS16, ZWJ, modifier, regional-indicator flag, and keycap sequences use the Emoji route as one draw operation.

Grid occupancy is one or two cells. Emoji-route graphemes and Unicode 17.0 East Asian Width `W`/`F` code points occupy two cells. Ambiguous-width and private-use code points occupy one.

## Loading

Canvas drawing selects a font route per cell. The editor invalidates cached layers after a font subset loads. Raster and GIF exports load the actual routed graphemes before drawing. DOM character previews use the same family resolver.

## Assets

Fonts are pinned, self-hosted WOFF2 subsets under `public/fonts`. Runtime builds do not contact a font provider. `npm run fonts:verify` validates the checked-in asset manifest; `npm run fonts:sync` is the explicit networked upgrade path. Every family retains its OFL license.
