# [38;2;220;38;38m42 MINUTES[0m TO RECOVERY
[1;38;2;255;255;255;48;2;220;38;38m SEV-2 [0m  [38;2;100;116;139mCheckout API · p95 latency[0m
---
```vega-lite
{
  "title": "p95 latency · ms",
  "data": {"values": [
    {"minute": 0, "latency": 280},
    {"minute": 6, "latency": 420},
    {"minute": 10, "latency": 1180},
    {"minute": 14, "latency": 1860},
    {"minute": 19, "latency": 1720},
    {"minute": 27, "latency": 940},
    {"minute": 42, "latency": 310}
  ]},
  "mark": "line",
  "encoding": {
    "x": {"field": "minute", "type": "quantitative", "title": "Minutes since rollout"},
    "y": {"field": "latency", "type": "quantitative", "scale": {"domain": [0, 2000]}}
  }
}
```
|||
## [38;2;220;38;38mINCIDENT CLOCK[0m

[38;2;100;116;139m14:02[0m  [38;2;245;158;11m●  rollout[0m
        │
[38;2;100;116;139m14:08[0m  [38;2;220;38;38m●  alert[0m
        │
[38;2;100;116;139m14:21[0m  [38;2;245;158;11m●  cache bypass[0m
        │
[38;2;100;116;139m14:44[0m  [38;2;22;163;74m●  recovered[0m

[38;2;22;163;74m280 ms[0m ───────────────→ [1;38;2;220;38;38m1,860 ms[0m ───────────────→ [38;2;22;163;74m310 ms[0m
---
```mermaid
flowchart LR
  A[Config rollout] --> B[Reuse OFF]
  B --> C[Cache timeout]
  C --> D[Database fallback]
  D --> E>p95 · 1.86 s]
```
---
╭──────────────────────────────────╮
│ [1;38;2;220;38;38mROOT CAUSE[0m                       │
│ Cache connections were not reused│
╰──────────────────────────────────╯
|||
╭──────────────────────────────────╮
│ [1;38;2;245;158;11mTURNING POINT[0m                    │
│ 14:21 · bypass the cache         │
╰──────────────────────────────────╯
|||
╭──────────────────────────────────╮
│ [1;38;2;22;163;74mRECOVERY[0m                         │
│ 14:44 · p95 returns to 310 ms    │
╰──────────────────────────────────╯
---
> [1;38;2;255;255;255;48;2;220;38;38m AHA [0m More database capacity did not recover the service. Removing the failing cache path did.
