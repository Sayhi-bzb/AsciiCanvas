# @chardesk/cli

Headless CharDesk renderer, checker, grid inspector, and terminal preview. It consumes the same CharGraph,
Protocol, Rendering, and vendored font contracts as the application without
starting a browser, server, or CharDesk UI.

## Render

```sh
chardesk render input.md -o output.png
```

The output suffix selects the materialized artifact:

| Suffix | Format | Artifact |
| --- | --- | --- |
| `.png` | `png` | Raster image |
| `.chardesk` | `chardesk` | Canonical Freeform CharDesk document |
| `.ans` | `ansi` | Terminal ANSI text |
| `.txt` | `text` | Plain Unicode text |

Use `--format` to override suffix inference. Text formats may write to stdout;
stdout requires an explicit format and cannot be combined with `--json`.

```sh
printf '# Status\n\n**Ready**' |
  chardesk render - -o - --format text
```

## Check

`check` runs the same source compiler without creating an artifact. Diagnostics
make the command fail; `--json` includes the renderer, pipeline, dimensions, and
diagnostics.

```sh
chardesk check input.md --json
```

## Result

`result` prints the materialized Protocol grid used by Canvas and PNG rendering.
It is a bounded, style-free diagnostic view rather than a text artifact.

```sh
chardesk result input.md
chardesk result gpu-blackboard/ --region 0,0,96,32
chardesk result board.chardesk --no-ruler
chardesk result input.md --styles
```

The default view is at most 96 columns by 32 rows. Metadata reports the full
grid, visible absolute coordinates, and omitted edges. Coordinate rulers use
Protocol cells, so CJK and other double-width graphemes stay aligned. A region
that intersects a double-width cell expands by at most one column to keep the
cell intact. Compiler diagnostics still print the fallback projection and make
the command exit with status 1.

`--styles` appends compact Agent-readable evidence from the same materialized
cells. CSS-like rules use inclusive absolute selectors: `y:x`, `y:x0-x1`, or
`y0-y1:x0-x1`, followed by declarations such as `{fg:#0969da;bold}`. Equal
horizontal runs merge into rectangles, then regions sharing a style share one
rule. Unstyled cells are omitted. Evidence is capped at 256 merged regions;
narrow `--region` when the result reports omissions. The default remains
style-free.

## Preview

`preview` presents the materialized grid directly in a human terminal. It uses
the terminal foreground and background for unstyled cells, while preserving
explicit truecolor ANSI, text attributes, and OSC 8 links. The output is
Protocol-cell accurate; font glyphs and emoji appearance remain terminal-owned.

```sh
chardesk preview input.md
chardesk preview gpu-blackboard/ --region 80,0,80,24
chardesk preview board.chardesk --color always
```

Without `--region`, the view fits `columns - 1` by `rows - 1` terminal cells to
avoid automatic wrapping. `--color auto` is the default and emits plain text
for pipes, `NO_COLOR`, and `TERM=dumb`; use `always` or `never` to override it.
Viewport omissions are reported on stderr, leaving stdout as preview content.

## Input and options

`auto` recognizes canonical and legacy Freeform `.chardesk` input, a
`blackboard.yaml` manifest, or a directory containing that manifest; other
files and stdin default to CharGraph source. Blackboard packages may also use
`--input blackboard`, but require a filesystem path. Canonical Structured and Slide documents
return `unsupported-document-mode` until their headless renderers are added.
Override non-document input with `--input chargraph`, `--input chardesk`, or
`--input blackboard`.

```text
--format <png|chardesk|ansi|text>
--scale <1..4>       PNG only; default 2
--padding <0..256>   PNG only; default 16 logical pixels
--strict             reject render diagnostics
--json               emit one machine-readable result
--region <x,y,columns,rows>  result only
--no-ruler                   result only
--styles                     result only; include materialized style evidence
--color <auto|always|never>  preview only; default auto
```

Successful file writes replace the explicit path atomically. Diagnostics go to
stderr unless `--json` is selected. Exit codes are 0 for success, 1 for
content/render/write failure, and 2 for invalid arguments.
PNG uses an isolated native raster process. A backend signal or invalid worker
result returns `raster-backend-crash` and never replaces the target artifact.
