# Performance Baseline

## Automated Checks

Run:

```bash
npm run test:perf
```

This builds the production bundle, serves it with Vite preview, and runs
`e2e/performance.spec.ts` against Chromium.

The perf smoke suite records:

- startup resource summary
- DOM and canvas counts
- requestAnimationFrame frame intervals
- `>32ms` and `>50ms` frame counts
- long task counts and max duration

Current interaction thresholds:

- p95 frame interval: `<= 24ms`
- `>50ms` frames: `0`
- long tasks per scenario: `<= 1`
- max long task duration: `<= 80ms`
- largest production script asset: `<= 500KB`

## Covered Scenarios

- Freeform canvas: middle-button pan, wheel pan, ctrl-wheel zoom.
- Structured canvas: selection drag and node drag on a seeded scene.
- Animation canvas: playback with onion skin and repeated frame stepping.
- Startup: production script/resource size and local storage footprint.

Each scenario writes a JSON attachment in the Playwright output.

## Known Hotspots

- Canvas rendering redraws visible cells on every relevant state change.
- Structured text selection scans grapheme ranges for selected text.
- Minimap scans the full grid when its base preview is rebuilt.
- Character library data is large: nerdfonts and emoji JSON dominate library
  payload size.
- Large store selectors in `AsciiCanvas` and the right sidebar can make canvas
  state changes fan out into React component work.

## Current Guardrails

- Character library fetches are guarded against duplicate in-flight loads.
- Production chunks are split into React, Radix, icons, motion, Yjs, and vendor
  groups so main app code does not absorb all dependencies.

## Manual Follow-Up

Use React DevTools Profiler when a perf smoke test fails:

1. Capture the failing scenario.
2. Check commit count and slowest commit duration.
3. Compare component updates against the scenario's JSON metrics.
4. Inspect whether the cost is canvas drawing, React rerendering, resource load,
   or persistence/storage.
