# Agent navigation benchmark

This benchmark measures whether a product-level question reaches the correct owner without prior knowledge of project symbol names.

Run `npm run check:agent-navigation` with an up-to-date GitNexus index. The command is diagnostic: it reports Top-3 owner hits and does not replace source or test verification.

## Acceptance criteria

- At least 90% of cases include the expected owner in the first three ranked results.
- A correct investigation reaches the authoritative rule in at most three source files.
- Two independent investigations agree on the owner for at least 90% of cases.
- Any disagreement between graph results and source is recorded as an index issue, not treated as source truth.

The benchmark cases and expected owners live with the runner in `scripts/quality/agent-navigation-cases.mjs`. Add a case when a new cross-domain capability is introduced or a navigation failure recurs.
