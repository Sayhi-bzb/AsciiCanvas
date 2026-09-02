# CharDesk CLI

`@chardesk/cli` is the local runtime for creating workspace skeletons,
inspecting compiled Canvas output, opening the bundled Canvas, and rendering
artifacts. Persistent source remains authoritative and is edited with native
filesystem tools.

The default new workspace location is `.chardesk/<slug>/`.

```sh
npx -y @chardesk/cli init .chardesk/<slug> --title "<title>"
npx -y @chardesk/cli inspect <path> --json
npx -y @chardesk/cli open <path>
npx -y @chardesk/cli render <input> -o <output> --strict --json
```

These are Agent actions. Execute them directly, then hand off the opened Canvas
or artifact.

- `inspect` returns the materialized Protocol grid without a browser. Use
  `--panel <id>`, `--region x,y,w,h`, or `--styles` for bounded evidence.
- `open` ensures a managed live source projection. Human editing is disabled;
  filesystem edits appear in the existing Canvas automatically. `--no-browser`
  returns its URL.
- `render` produces PNG, `.chardesk`, ANSI, or text artifacts.
- Stdin is available for temporary `inspect` and `render` input; `open` uses a
  persistent path.
- After successful inspection, open the first complete delivery once. Later
  edits need only another inspection; the open Canvas updates in place.
- If Canvas opening fails, deliver the fallback artifact or error directly.

The published package requires neither a CharDesk checkout nor a dev server.
