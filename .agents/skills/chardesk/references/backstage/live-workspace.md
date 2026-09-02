# Live workspace backstage

Use this context when `chardesk_blackboard_*` tools are available. WebMCP and
ChatGPT Site Tools expose the same workspace contract.

1. Resolve an explicit workspace. Create one for new untargeted content; list
   workspaces when an existing target is missing or ambiguous.
2. List and read the canonical source with its current revision.
3. Batch related writes and deletes in one patch and pass `baseRevision`.
4. Check the workspace after mutation.
5. Navigate to the returned workspace URL after creation; later edits keep the
   current page.
6. Report changed paths and the resulting revision.

A revision conflict refreshes the source and recomputes one patch. A repeated
conflict ends the mutation attempt. A missing workspace may be resolved through
one workspace listing.

Edit canonical source files rather than rendered cells. Runtime tool definitions
own operation names and schemas.
