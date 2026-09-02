# Experimental live backstage

When a shared live Canvas has no `chardesk_blackboard_*` tools, open its setup
surface with available browser navigation. Continue through the [CLI](cli.md)
if discovery still fails.

## ChatGPT Site Tools

In the ChatGPT app, open
[`https://chardesk.com/blackboard`](https://chardesk.com/blackboard) in the
built-in browser. When Site Tools are disabled, open the settings surface when
available; the user enables `Enable site tools` under
`Settings > Browser > Permissions`. Site Tools belong to the open top-level
page.

See the official [OpenAI Site Tools documentation](https://learn.chatgpt.com/docs/webmcp).

## Chrome WebMCP

For a compatible Agent connected to Chrome, open
`chrome://flags/#enable-webmcp-testing`. The user enables the flag and relaunches
Chrome, then opens [`https://chardesk.com/blackboard`](https://chardesk.com/blackboard).

See the official [Chrome WebMCP documentation](https://developer.chrome.com/docs/ai/webmcp).

## Guided activation

The user completes only permission changes, flag changes, and browser restart.
Retry discovery once, then use the CLI when tools remain unavailable.
