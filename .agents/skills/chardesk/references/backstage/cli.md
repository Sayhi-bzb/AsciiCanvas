# Local backstage

Use `@chardesk/cli` for local paths, Slides, and file artifacts. Edit persistent
source with native filesystem tools.

The default new workspace location is `.chardesk/<slug>/`.

```sh
npx -y @chardesk/cli init .chardesk/<slug> --title "<title>"
npx -y @chardesk/cli inspect <path> --json
npx -y @chardesk/cli open <path>
npx -y @chardesk/cli render <input> -o <output> --strict --json
```

- `inspect` returns the materialized Protocol grid without a browser. Use
  `--panel <id>`, `--region x,y,w,h`, or `--styles` for bounded evidence.
- `open` ensures a managed live source projection. Human editing is disabled;
  filesystem edits appear automatically. It is idempotent: invoke it whenever
  an interactive Canvas is requested, and let the CLI reuse, recreate, and
  retire sessions. `--no-browser` returns the URL.
- `render` produces PNG, `.chardesk`, ANSI, or text artifacts.
- Stdin is available for temporary `inspect` and `render` input; `open` uses a
  persistent path.
- If Canvas opening fails, deliver the fallback artifact or error directly.

The published package requires neither a CharDesk checkout nor a dev server.
