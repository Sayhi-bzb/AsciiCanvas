# Live Blackboard workspaces

Use this workflow only when `chardesk_blackboard_*` tools are available and the
task targets a live browser workspace. Otherwise use the local source workflow
in [`../SKILL.md`](../SKILL.md). Do not require users to enable experimental
browser features.

1. Use an explicit workspace ID. List workspaces only when the ID is missing or
   ambiguous.
2. List and read the canonical Blackboard source before changing it.
3. Pass the latest revision as `baseRevision` when the mutation supports it.
4. Batch related writes and deletes in one patch when possible.
5. Check the workspace after mutation.
6. Report changed paths and the resulting revision; do not repeat the content.

On a revision conflict, read the current source, recompute the patch, and retry
once. Stop and report the conflict if it repeats. If a workspace is not found,
list workspaces once; never silently select another workspace.

Edit canonical source files, not rendered DOM or cells. Runtime tool definitions
own operation names and schemas; do not duplicate them here.
