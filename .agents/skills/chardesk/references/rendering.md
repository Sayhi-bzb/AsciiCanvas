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
- Use `render` for materialized output. The `.png`, `.chardesk`, `.ans`, and
  `.txt` suffixes select the artifact; use the user's requested path or a
  task-scoped temporary path for a preview.
- `.chardesk` output is a canonical `document/v1` Freeform document. `.ans` and
  `.txt` remain terminal and plain-text artifacts.
- For PNG, use `--strict --json`, check the result, then inspect the image itself.
- For plain text on stdout, use `-o - --format text` without `--json`.

```sh
node_modules/.bin/chardesk check - --json
node_modules/.bin/chardesk render - -o <output.png> --strict --json
node_modules/.bin/chardesk render - -o - --format text
```

Run `npm run build:cli` if the repository-local CLI has not been built. Do not
install a global CLI or start the web application for this workflow.
