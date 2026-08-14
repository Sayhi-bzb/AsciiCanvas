import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { describe, expect, it } from "vitest";

describe("CharDesk MCP stdio server", () => {
  it("advertises and completes the two-phase authoring flow", async () => {
    const client = new Client({ name: "chardesk-test", version: "1.0.0" });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [fileURLToPath(new URL("../dist/server.js", import.meta.url))],
      stderr: "pipe",
    });

    await client.connect(transport);
    try {
      expect(client.getInstructions()).toContain("create_canvas_draft");
      const listed = await client.listTools();
      expect(listed.tools.map(({ name }) => name)).toEqual([
        "create_canvas_draft",
        "apply_canvas_style",
      ]);

      const created = await client.callTool({
        name: "create_canvas_draft",
        arguments: { plain_text: "A界" },
      });
      expect(created.isError).not.toBe(true);
      expect(created.structuredContent).toMatchObject({
        revision: 1,
        canonical_plain_text: "A界",
      });
      const draft = created.structuredContent as {
        draft_id: string;
        revision: number;
      };

      const applied = await client.callTool({
        name: "apply_canvas_style",
        arguments: {
          draft_id: draft.draft_id,
          revision: draft.revision,
          ansi_text: "[31mA界[0m",
        },
      });
      expect(applied.isError).not.toBe(true);
      expect(applied.structuredContent).toMatchObject({
        accepted: true,
        revision: 2,
        ansi_text: "[31mA界[0m",
      });
    } finally {
      await client.close();
    }
  });
});
