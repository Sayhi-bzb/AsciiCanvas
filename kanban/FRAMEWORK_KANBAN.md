# Agent–CharDesk Blackboard Graph

Snapshot: 2026-08-15

## Graph

```text
Conversation                              Blackboard
Human <----------- speech -----------> Agent
  |                                        |
  | observe                                | read / apply_patch
  v                                        v
Viewer <-- raw text + ETag -- Reader --> board.chardesk
  ^                              read-only   source of truth
  |
Protocol <---------------- Check

Skill ---------------------> Agent behavior
```

## Physical mapping

| Physical blackboard | CharDesk |
| --- | --- |
| Classroom | Shared interaction context |
| Blackboard | Named `.chardesk` Canvas |
| Speech | Conversation |
| Chalk | Write capability |
| Look at the board | Read or observe the current Canvas |
| Write or erase locally | `apply_patch` |
| Erase the board | Explicit clear or replacement |
| Point at a mark | Cell cursor or rectangular selection |
| Photograph the board | Meaningful checkpoint |
| Photo archive | Durable history |

## Roles

| Role | Relation | Active holder |
| --- | --- | --- |
| Speaker | Expresses intent, explanation, or feedback through Conversation | Human and Agent |
| Writer | Reads the current Blackboard, then changes it | Agent |
| Viewer | Observes the current Blackboard | Human |
| Facilitator | Selects the goal, focus, and accepted checkpoint | Human |

## Nodes

| Node | Owner | Fact |
| --- | --- | --- |
| Human | Product participant | Speaks through Conversation and observes through Viewer |
| Agent | Agent host | Speaks through Conversation and writes through native file tools |
| Conversation | Agent host | Carries intent, explanation, questions, and change reports |
| Skill | CharDesk Agent adapter | Constrains Blackboard authoring behavior |
| Blackboard | CharDesk file format | One named `.chardesk` file is the state authority |
| Reader | `@chardesk/blackboard` | Stateless, loopback, workspace-scoped, and read-only |
| Viewer | `@chardesk/viewer` | Presents the current source and protocol diagnostics |
| Protocol | `@chardesk/protocol` | Owns ESC-less ANSI, Unicode, CJK width, graphemes, and diagnostics |
| Check | `@chardesk/blackboard` | Delegates single-file acceptance to Protocol |
| Checkpoint | Blackboard lifecycle | Captures a meaningful Blackboard state for durable history |
| Durable history | Product storage | Retains accepted checkpoints rather than every write |

## Edges

| From | Relation | To |
| --- | --- | --- |
| Human | speaks and responds through | Conversation |
| Agent | speaks and responds through | Conversation |
| Conversation | carries language about | Blackboard |
| Blackboard | carries spatial structure for | Conversation |
| Skill | instructs | Agent |
| Agent | reads with native `read` | Blackboard |
| Agent | changes locally with native `apply_patch` | Blackboard |
| Agent | clears only through explicit replacement | Blackboard |
| Reader | reads raw source from | Blackboard |
| Viewer | polls every 500 ms with `GET /board` | Reader |
| Reader | returns raw text and content `ETag` to | Viewer |
| Viewer | parses and renders with | Protocol |
| Check | validates with | Protocol |
| Check | reads | Blackboard |
| Human | observes | Viewer |
| Blackboard | may produce | Checkpoint |
| Checkpoint | enters | Durable history |

## Authoring relations

| Fact | Relation |
| --- | --- |
| Read before write | Agent reads the current Blackboard before taking write capability |
| Preserve marks | Local patch is the default operation |
| Explicit clear | Whole-board replacement requires explicit intent |
| Default style | Unstyled cells inherit the renderer default |
| Sparse color | Style expresses relationships, emphasis, or state rather than decoration |
| Spatial authority | Blackboard content is not reproduced in full in Conversation |
| Turn boundary | File changes do not wake an idle Agent; the Agent reads again on its next turn |

## Observation states

| Reader result | Viewer relation |
| --- | --- |
| `200 text/plain` with `ETag` | Display the current source |
| `304` | Preserve the current display |
| `404` | Clear the display, show waiting, and continue polling |
| Protocol diagnostics | Display the current parse and a warning |
| Reader unavailable | Preserve the last display and show disconnected state |
