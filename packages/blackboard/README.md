# @chardesk/blackboard

Local, read-only projection of one canonical or legacy Freeform `.chardesk`
Blackboard. Structured and Slide documents are rejected explicitly.

- `serve [board.chardesk] [--port 7331]` serves the main CharDesk application at `/blackboard` on loopback.
- `check <board.chardesk>` validates UTF-8 and visible ESC-less ANSI.

The Agent writes the source with native filesystem tools. The server only reads
the current file and keeps no second revision.

The main application build must exist before `serve` starts. Blackboard uses a
non-persistent `freeform` session with navigation, selection, and copy enabled;
content mutation and session management remain disabled for the Human host.
