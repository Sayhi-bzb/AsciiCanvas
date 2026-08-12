# Editor runtime

`EditorRuntime` is the UI-independent coordination boundary for editor commands, tools, interaction state, history, and extension lifecycle. Canvas, slides, sessions, and collaboration retain their domain ownership.

## Entry direction

```text
UI input → keymap or native adapter → command/tool → canvas port → Yjs document
```

- Commands own discrete semantic operations and return a handled result.
- Tools own continuous interaction lifecycle through hierarchical state nodes.
- Native clipboard events remain adapters and invoke the same commands.
- Widgets read through editor or canvas selectors and write through commands; they do not access the Zustand implementation or Yjs maps.

## State scopes

| Scope | Meaning | History | Sync |
| --- | --- | --- | --- |
| `document` | Authoritative editable content | Local operations only | Yes |
| `session` | Tool, selection, editing target, viewport, preferences | No | No |
| `presence` | Remote identity, cursor, and transient selection | No | Ephemeral |
| `derived` | Rendering, minimap, and preview projections | No | No |

A projection never writes back to its authority. Remote document changes use the remote Yjs origin and never enter local undo history.

## Extensions

Extensions register before `EditorRuntime.start()` and declare a unique ID plus commands, tools, managers, and state scopes. Duplicate IDs fail initialization. Runtime disposal unwinds setup and managers in reverse order.

The contract is application-public. It intentionally avoids npm compatibility commitments while preserving a UI-free boundary that can later be extracted without changing editor behavior.
