# @chardesk/document

Portable envelope for canonical UTF-8 `.chardesk` documents.

```text
---
chardesk: document/v1
mode: freeform
title: Example
---
Hello
```

The package owns envelope parsing and serialization only. Mode bodies remain
owned by CharDesk's Freeform, Structured, and Slides codecs.
