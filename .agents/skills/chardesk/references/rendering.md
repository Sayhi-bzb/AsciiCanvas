# Headless checking and artifact rendering

Use the CharDesk CLI when authored content needs validation or a materialized
artifact without opening the app.
The command contract is owned by [`packages/cli/README.md`](../../../../packages/cli/README.md).

- For generated or temporary content, stream UTF-8 source through stdin with
  input `-`; create a source file only when the user wants to keep one.
- Stdin uses CharGraph by default. Canonical or legacy Freeform `.chardesk`
  input is recognized as ESC-less content; CLI rendering rejects Structured and
  Slide document modes explicitly.
- Use `check <input|-> --json` when the task needs diagnostics but no artifact.
- Use `result <input|->` for the default layout review. It prints the actual
  materialized Protocol grid with bounded absolute coordinates and does not
  require opening an image.
- Add `--styles` when foreground, background, attributes, or links need
  inspection. It reports CSS-like absolute grid regions and declarations
  without terminal escapes; selectors are `y:x`, `y:x0-x1`, or
  `y0-y1:x0-x1`, with inclusive coordinates.
- Use `render` for materialized output. The `.png`, `.chardesk`, `.ans`, and
  `.txt` suffixes select the artifact; use the user's requested path or a
  task-scoped temporary path for a preview.
- `.chardesk` output is a canonical `document/v1` Freeform document. `.ans` and
  `.txt` remain terminal and plain-text artifacts.
- Do not call `view_image` for routine CharDesk verification. Use `result` for
  content, geometry, coordinates, and clipping, and `result --styles` for
  materialized style evidence.
- For PNG, use `--strict --json`. Rendering, exporting, or taking a screenshot
  does not authorize image inspection. Inspect the artifact only when the user
  explicitly requests pixel-level visual review.
- For plain text on stdout, use `-o - --format text` without `--json`.

```sh
node_modules/.bin/chardesk check - --json
node_modules/.bin/chardesk result -
node_modules/.bin/chardesk result - --styles
node_modules/.bin/chardesk render - -o <output.png> --strict --json
node_modules/.bin/chardesk render - -o - --format text
```

Run `npm run build:cli` if the repository-local CLI has not been built. Do not
install a global CLI or start the web application for this workflow.
