# @chardesk/blackboard

Local, read-only projection of one directly edited `.chardesk` Blackboard.

- `serve [board.chardesk] [--port 7331]` serves a Viewer on loopback.
- `check <board.chardesk>` validates UTF-8 and visible ESC-less ANSI.

The Agent writes the source with native filesystem tools. The server only reads
the current file and keeps no second revision.
