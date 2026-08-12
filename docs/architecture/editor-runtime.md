# Editor runtime

`EditorRuntime` is the UI-independent coordination boundary for editor commands, tools, interaction state, history, and extension lifecycle. Canvas, slides, sessions, and collaboration retain their domain ownership.

`createApplicationEditorHost()` creates isolated editor, canvas, Yjs registry, and collaboration runtimes. The application composition root owns its default host; widgets resolve that host through explicit editor, canvas, and collaboration providers.

Factories require their adapters. There is no production fallback store, document registry, command table, parser registration, or collaboration singleton. Additional hosts disable persistence or provide a distinct non-empty storage key; the main host alone owns the legacy application key.

## Entry direction

```text
DOM shortcut dispatcher → editor keymap or native adapter → command/tool → canvas port → Yjs document
```

- Commands own discrete semantic operations and return a handled result.
- Tools own continuous interaction lifecycle through hierarchical state nodes.
- The canvas gesture adapter emits typed tool events. One tool state tree owns freeform and structured drag state; the canvas port owns decisions and effects, with no parallel interaction reducer.
- The DOM dispatcher owns focus and layer priority; the editor keymap owns configurable semantic bindings.
- Native clipboard events remain adapters and invoke the same commands.
- Widgets read through provider-bound editor or canvas selectors and write through that instance's commands; they do not access the Zustand implementation or Yjs maps.

## State scopes

| Scope | Meaning | History | Sync |
| --- | --- | --- | --- |
| `document` | Authoritative editable content | Local operations only | Yes |
| `session` | Tool, selection, editing target, viewport, preferences | No | No |
| `presence` | Remote identity, cursor, and transient selection | No | Ephemeral |
| `derived` | Rendering, minimap, and preview projections | No | No |

A projection never writes back to its authority. Remote document changes use the remote Yjs origin and never enter local undo history.

## Extensions

Extensions register before `EditorRuntime.start()` and declare a unique ID plus commands, tools, keybindings, managers, and state scopes. Duplicate IDs fail initialization. Runtime disposal unwinds setup and managers in reverse order.

Keybindings are extension-owned and target commands or tools. Device-local overrides load after extension registration and before runtime start, persist under `chardesk-editor-keymap-v1`, and never enter document state, collaboration, or undo history. Equal-priority matches are conflicts and do not execute.

App chrome, menu navigation, presentation controls, IME, native clipboard events, and hold gestures remain host adapters rather than editor commands.

The contract is application-public. It intentionally avoids npm compatibility commitments while preserving a UI-free boundary that can later be extracted without changing editor behavior.
