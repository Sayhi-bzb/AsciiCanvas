# CharDesk visual casebook

[1;38;2;9;105;218mCASE 01 · PARALLEL MACHINE[0m

╭──────────────╮      ╭──────────────────────╮
│ CPU · serial ├─────>│ GPU · parallel       │
╰──────────────╯      │ ┌──┬──┬──┬──┬──┬──┐  │
                      │ │01│02│03│04│05│06│  │
command stream        │ ├──┼──┼──┼──┼──┼──┤  │
────────────────────> │ │07│08│09│10│11│12│  │
                      │ └──┴──┴──┴──┴──┴──┘  │
                      ╰──────────────────────╯

One instruction becomes many simultaneous workers.
|||
## Work becomes pixels

```mermaid
flowchart LR
  C[CPU command] ==> G[GPU scheduler]
  G --> V[Vertex work]
  G --> S[Shader work]
  G --> M[Memory work]
  V --> F[Frame]
  S --> F
  M --> F
```

[90mThe grid gives the machine a body; the graph exposes its flow.[0m
---
[1;38;2;130;80;223mCASE 02 · EL NIÑO OBSERVATORY[0m

WEST PACIFIC                         EAST PACIFIC
Indonesia                               Americas
   ☁ ☁       trade winds →→→
≈≈≈≈≈≈╲──────────────────────────────╱≈≈≈≈≈≈  ocean
 warm pool ████████████▓▓▒▒░░░░░░░░░░ warm east
          ╲──────── thermocline ──────╱

East–west contrast: $T_1 - T_2$

[90mA geographic cross-section keeps direction and distance visible.[0m
|||
## Temperature anomaly

```vega-lite
{
  "title": "Niño 3.4 anomaly",
  "data": {
    "values": [
      { "month": "Jan", "value": 0.2, "error": 0.10 },
      { "month": "Apr", "value": 0.8, "error": 0.15 },
      { "month": "Jul", "value": 1.5, "error": 0.20 },
      { "month": "Oct", "value": 2.1, "error": 0.25 }
    ]
  },
  "encoding": {
    "x": { "field": "month", "type": "ordinal", "title": "Month" },
    "y": { "field": "value", "type": "quantitative", "title": "°C" },
    "yError": { "field": "error" }
  },
  "layer": [
    { "mark": "line" },
    { "mark": "point" },
    { "mark": "errorbar" }
  ]
}
```

[90mThe curve carries change; uncertainty remains attached to each reading.[0m
---
[1;38;2;31;136;61mCASE 03 · AGENT DELIVERY[0m

```mermaid
sequenceDiagram
  participant H as Human
  participant A as Agent
  participant F as Source files
  participant C as Canvas
  H->>A: Explain the system
  A->>F: Write canonical content
  A->>F: Inspect and revise
  F-->>C: Project cells
  C-->>H: Open visual result
```

[90mThe sequence keeps authorship, persistence, and projection distinct.[0m
|||
## Canonical source

```json
{
  "workspace": "research-notes",
  "panels": {
    "overview": "panels/overview.panel",
    "evidence": "panels/evidence.panel"
  },
  "revision": 3
}
```

[90mThe tree makes ownership and nesting inspectable.[0m
|||
[1mDelivery[0m

╭─────────────────────╮
│ [38;2;31;136;61m● source valid[0m      │
│ [38;2;9;105;218m● canvas opened[0m     │
│ [38;2;130;80;223m● artifact ready[0m    │
╰─────────────────────╯

| Artifact | Role |
| --- | --- |
| `.panel` | editable source |
| Canvas | human view |

[90mMotion leads the story; the small table pins two exact interfaces.[0m
