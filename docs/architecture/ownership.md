# Ownership and dependency direction

Use this page to choose the first domain to inspect. Public contracts define allowed cross-domain access; source and tests own implementation facts.

## Ownership map

| Capability | Owner | Does not own | Primary public entry |
| --- | --- | --- | --- |
| Application assembly | `app` | Business rules or reusable UI | `src/app/compositionRoot.ts` |
| User commands | `actions` | Editor state or rendering | `src/domains/actions/public.ts` |
| Editor state and Yjs projection | `canvas` | Provider lifecycle or durable schema | `src/domains/canvas/public.ts` |
| Collaboration connection and presence | `collaboration` | Editor reconciliation or persistence | `src/domains/collaboration/public.ts` |
| External document parsing and conversion | `document` | Editor state or delivery | `src/domains/document/public.ts` |
| Export preparation and delivery | `export` | Document parsing or editor state | `src/domains/export/public.ts` |
| Static-grid selection model | `selection` | Rendering or command routing | `src/domains/selection/public.ts` |
| Session model and durable schema | `sessions` | Yjs projection or provider lifecycle | `src/domains/sessions/public.ts` |
| Slide deck, size, crop, and markdown rules | `slides` | Editor coordination or UI | `src/domains/slides/public.ts` |
| Structured nodes, layout, and scene rendering | `structured-content` | Canvas UI or provider lifecycle | `src/domains/structured-content/public.ts` |
| Product interaction and presentation | `widgets` | Domain rules or persistence schemas | Feature-local entry |
| Domain-neutral primitives | `shared` | Product concepts or domain state | Owning source module |

## Dependency direction

```text
shared <- domains <- widgets <- app
```

- `shared` depends only on `shared` and external packages.
- A domain may use another domain only through its `public.ts` contract.
- A domain uses its own source directly, never its own `public.ts`.
- `widgets` may coordinate public domain capabilities but may not define domain validation, persistence, or synchronization rules.
- Cross-domain registration and application-wide side effects belong in the composition root.

## Canonical flows

- Remote collaboration: provider → Yjs document → canvas observers → editor state → widgets.
- Slide resize: widget intent → canvas slide slice → slides resize rule → active document and session snapshot.
- Session persistence: editor snapshot → persistence coordinator → sessions schema → browser storage.
- Slide preview: slide data → canonical slide canvas renderer → preview or playback surface.
- Selection command: UI or shortcut → actions command → canvas selection port → editor mutation.

Each arrow has one direction. A projection or cache is derived state and must not overwrite its authority without an explicit command.
