# @chardesk/cli

Agent-first CharDesk workspace CLI. It creates and inspects source packages, opens the bundled
Canvas locally, and renders portable artifacts. It consumes the same Blackboard, CharGraph,
Protocol, Rendering, and font contracts as the CharDesk application.

Run it without cloning CharDesk or installing a global command:

```sh
npx -y @chardesk/cli --help
```

The examples below use this no-install form. To use the shorter `chardesk`
command instead, install it globally first:

```sh
npm install -g @chardesk/cli
chardesk --help
```

## Workspace workflow

Create a canonical multi-file Blackboard package:

```sh
npx -y @chardesk/cli init .chardesk/gpu --title "GPU"
```

Agents use normal filesystem tools to read and patch `blackboard.yaml` and `.panel` files. The
files are the source of truth; the CLI does not introduce a proprietary CRUD layer.

Inspect the compiled grid before showing it:

```sh
npx -y @chardesk/cli inspect .chardesk/gpu --json
npx -y @chardesk/cli inspect .chardesk/gpu --panel architecture --styles --json
npx -y @chardesk/cli inspect .chardesk/gpu --region 0,0,96,32
```

`inspect` reports the actual Protocol grid used by Canvas and PNG rendering. Its default view is
bounded to 96×32 cells; `--region` selects an absolute grid region. `--styles` adds compact,
Agent-readable style regions. `--panel` isolates one package panel by manifest ID.

Open the workspace when a human wants to see it:

```sh
npx -y @chardesk/cli open .chardesk/gpu
```

`open` starts a managed background session, launches the default browser, and returns. The CLI
ships the same CharDesk application runtime as the hosted product and opens a live source
projection at a short `/s/<token>/` loopback URL. Human editing is disabled; source changes made by
filesystem tools appear in the existing Canvas automatically. A normal launch prints
`Opened CharDesk. Source updates are live.` or `Reused CharDesk. Source updates are live.` It does
not require CharDesk source code, a dev server, a cloud host, or an MCP server. Local files are
never uploaded or modified by Canvas.

```sh
npx -y @chardesk/cli status
npx -y @chardesk/cli close .chardesk/gpu
npx -y @chardesk/cli close --all
```

Opening a directory, its manifest, or a symlink to the same workspace reuses one compatible healthy
session across CLI patch upgrades. Source edits do not change its URL. Use `--no-browser` to return
the URL without launching a browser, `--port` for a fixed loopback port, or `--foreground` to attach the
server lifecycle to the current process. If a launched browser cannot report Canvas readiness,
`open` returns a PNG fallback path instead. `open --json` exposes the public session fields
`status`, `input`, `url`, `runtimeReady`, and `watching`; process and registry metadata remain internal.

## Render

```sh
npx -y @chardesk/cli render input.md -o output.png
```

The output suffix selects the artifact:

| Suffix | Format | Artifact |
| --- | --- | --- |
| `.png` | `png` | Raster image |
| `.chardesk` | `chardesk` | Canonical Freeform document |
| `.ans` | `ansi` | Terminal ANSI text |
| `.txt` | `text` | Plain Unicode text |

Use `--format` to override suffix inference. Plain text on stdout requires an explicit format:

```sh
printf '# Status\n\n**Ready**' | npx -y @chardesk/cli render - -o - --format text
```

PNG uses an isolated native raster process. `--strict` rejects compiler diagnostics without
replacing an existing artifact.

## Inputs and options

`auto` recognizes a Freeform `.chardesk` document, `blackboard.yaml`, or a directory containing
that manifest. Other files and stdin default to CharGraph source. Override detection with
`--input chargraph`, `--input chardesk`, or `--input blackboard`. Structured and Slide documents
return `unsupported-document-mode` until their headless renderers are available.

```text
--title <title>                    init only
--port <0..65535>                  open only; default random
--no-browser                       open only
--foreground                       open only
--panel <id>                       inspect one Blackboard panel
--region <x,y,columns,rows>         inspect only
--no-ruler                         inspect only
--styles                           inspect only
--format <png|chardesk|ansi|text>  render only
--scale <1..4>                     PNG only; default 2
--padding <0..256>                 PNG only; default 16
--strict                           reject render diagnostics
--json                             emit one machine-readable result
```

Successful writes replace the explicit path atomically. Exit codes are 0 for success, 1 for
content/runtime/write failure, and 2 for invalid arguments.
