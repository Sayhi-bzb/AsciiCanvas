# Experimental live access

Live browser integration is optional and experimental. When the task needs a
shared live Canvas and `chardesk_blackboard_*` tools are unavailable, use
available browser navigation to open the relevant setup surface directly. The
host approval flow handles authorization. Continue through the [CLI](cli.md)
when discovery still fails.

## ChatGPT Site Tools

In the ChatGPT desktop app, open
[`https://chardesk.com/blackboard`](https://chardesk.com/blackboard) in the
built-in browser. When Site Tools are disabled, open the settings surface when
available; the user enables `Enable site tools` under
`Settings > Browser > Permissions`. Site Tools belong to the open top-level
page; ChatGPT currently supports an imperative subset of WebMCP.

See the official [OpenAI Site Tools documentation](https://learn.chatgpt.com/docs/webmcp).

## Chrome WebMCP

For a compatible Agent connected to Chrome, open
`chrome://flags/#enable-webmcp-testing`. The user enables the flag and relaunches
Chrome, then opens [`https://chardesk.com/blackboard`](https://chardesk.com/blackboard).

See the official [Chrome WebMCP documentation](https://developer.chrome.com/docs/ai/webmcp).

## Guided activation

Open the setup surface with browser actions. The user completes only permission
changes, flag changes, and browser restart. Retry tool discovery once, then use
the CLI path and open its local Canvas when the tools remain unavailable.
