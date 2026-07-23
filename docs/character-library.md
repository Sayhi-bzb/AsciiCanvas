# Character Library

This page owns character classification, catalog assets, search, and Unicode
Explorer loading. Font selection remains in
[Font and Unicode Routing](font-unicode-routing.md).

## Catalog layers

The main catalog loads three independent packs:

| Pack | Source | Policy |
| --- | --- | --- |
| Essentials | Unicode 17 UCD plus explicit task ranges | ASCII, layout, arrows, shapes, math, technical, number, dingbat, braille, and common symbols with vendored glyph coverage |
| Nerd | Checked-in Nerd Font source catalog | Entries covered by Maple Mono NF CN |
| Emoji | Unicode Emoji 17 test data | Fully-qualified sequences in official group and CLDR order |

Language packs are not generated. Full assigned Unicode is available through
the advanced Explorer, not the default palette.

## Unicode Explorer

Explorer records are canonical 1,024-code-point shards. Block, Script, and
General Category facets reference ranges over the same shards. Opening the
Explorer loads only its manifest; selecting a facet loads one 240-entry page.
An eight-shard LRU bounds decoded data.

Character and code-point queries locate a shard directly. The full lowercase
Unicode name and alias index loads only for advanced name search and is
filtered in a Web Worker. Unassigned, surrogate, noncharacter, and anonymous
private-use values are absent. Controls and default-ignorable values are
metadata-only; combining marks use a dotted circle preview.

## Search and rendering

The Freeform sidebar exposes Essentials, Nerd Icons, Emoji, and Unicode as an
icon-only view rail. Main-pack search matches grapheme, code point, Unicode or
icon name, and aliases within the active view after a 100 ms debounce. Results
are deduplicated by grapheme and capped at 100. Groups mount only while open
and render at most 240 entries per page.

Every entry uses the shared grapheme font resolver. Coverage flags are derived
from the checked-in WOFF2 cmap data during generation.

## Assets

`npm run generate:character-data` is the explicit networked update path.
`npm run characters:verify` validates checked-in hashes and budgets: 16,000
main records, 2,000 Essentials records, 175 KiB gzip for all main packs,
40 KiB gzip for the Explorer manifest, and 250 KiB gzip per Unicode shard.
Stable manifests revalidate hourly; content-hashed packs, indexes, and shards
are immutable for one year.
