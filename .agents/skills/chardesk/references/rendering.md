# Local inspection, Canvas viewing, and artifacts

The command contract is owned by
[`packages/cli/README.md`](../../../../packages/cli/README.md).

Use normal filesystem tools to author persistent source. The preferred workspace location is
`.chardesk/<slug>/`; its `blackboard.yaml` and `.panel` files remain authoritative.

- Use `inspect <path> --json` after writing. It verifies compilation and returns the materialized
  Protocol grid without requiring a browser.
- Add `--panel <id>` to isolate a package panel or `--region x,y,w,h` to inspect a large grid in
  bounded sections.
- Add `--styles` only when foreground, background, attributes, or links need verification.
- Use `open <path>` when the human asks to see the result. It returns after starting a local native
  Canvas session; use `status` and `close` to manage sessions.
- Use `render` when the requested deliverable is `.png`, `.chardesk`, `.ans`, or `.txt`. For PNG,
  use `--strict --json`.
- For temporary content, stdin is valid for `inspect` and `render`; do not create a source file
  unless the user wants to keep it. `open` requires a persistent path.
- Do not inspect generated PNG pixels unless the user requests visual review. `inspect` owns
  content, geometry, clipping, and materialized style verification.

```sh
npx -y @chardesk/cli inspect .chardesk/example --json
npx -y @chardesk/cli inspect .chardesk/example --panel overview --styles --json
npx -y @chardesk/cli open .chardesk/example
npx -y @chardesk/cli status
npx -y @chardesk/cli close .chardesk/example
npx -y @chardesk/cli render .chardesk/example -o <output.png> --strict --json
```

Inside the repository, run `npm run build:cli` and invoke `packages/cli/dist/cli.js`. Outside it,
use the published `@chardesk/cli`; neither path requires a web application checkout or dev server.
