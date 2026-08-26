# @chardesk/cli

Headless CharDesk source renderer and checker. It consumes the same CharGraph,
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
| `.chardesk` | `chardesk` | Styled ESC-less CharDesk text |
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

## Input and options

`auto` treats `.chardesk` as materialized ESC-less ANSI and other files or
stdin as CharGraph source. Override it with `--input chargraph` or
`--input chardesk`.

```text
--format <png|chardesk|ansi|text>
--scale <1..4>       PNG only; default 2
--padding <0..256>   PNG only; default 16 logical pixels
--strict             reject render diagnostics
--json               emit one machine-readable result
```

Successful file writes replace the explicit path atomically. Diagnostics go to
stderr unless `--json` is selected. Exit codes are 0 for success, 1 for
content/render/write failure, and 2 for invalid arguments.
