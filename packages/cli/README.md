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

## Input and options

`auto` recognizes canonical and legacy Freeform `.chardesk` input; other files
or stdin default to CharGraph source. Canonical Structured and Slide documents
return `unsupported-document-mode` until their headless renderers are added.
Override non-document input with `--input chargraph` or `--input chardesk`.

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
PNG uses an isolated native raster process. A backend signal or invalid worker
result returns `raster-backend-crash` and never replaces the target artifact.
