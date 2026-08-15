import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { describe, expect, it } from "vitest";

describe("CharDesk MCP stdio server", () => {
  it("publishes persisted sources with a minimal result", async () => {
    const root = await mkdtemp(join(process.cwd(), ".mcp-test-"));
    const plain = join(root, "plain.txt");
    const styled = join(root, "styled.ans");
    const output = join(root, "result.chardesk");
    await Promise.all([
      writeFile(plain, "A界", "utf8"),
      writeFile(styled, "[31mA[0m界", "utf8"),
    ]);

    const client = new Client({ name: "chardesk-test", version: "1.0.0" });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [fileURLToPath(new URL("../dist/server.js", import.meta.url))],
      stderr: "pipe",
    });

    await client.connect(transport);
    try {
      const listed = await client.listTools();
      expect(listed.tools.map(({ name }) => name)).toEqual(["publish_canvas"]);
      const published = await client.callTool({
        name: "publish_canvas",
        arguments: {
          plain_path: relative(process.cwd(), plain),
          styled_path: relative(process.cwd(), styled),
          output_path: relative(process.cwd(), output),
        },
      });
      expect(published.isError).not.toBe(true);
      expect(published.structuredContent).toEqual({ status: "accepted" });
      expect(await readFile(output, "utf8")).toBe("[31mA[0m界");
    } finally {
      await client.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("returns a repairable mismatch as a normal tool result", async () => {
    const root = await mkdtemp(join(process.cwd(), ".mcp-test-"));
    await Promise.all([
      writeFile(join(root, "plain.txt"), "A", "utf8"),
      writeFile(join(root, "styled.ans"), "B", "utf8"),
    ]);
    const client = new Client({ name: "chardesk-test", version: "1.0.0" });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [fileURLToPath(new URL("../dist/server.js", import.meta.url))],
      stderr: "pipe",
    });
    await client.connect(transport);
    try {
      const rejected = await client.callTool({
        name: "publish_canvas",
        arguments: {
          plain_path: relative(process.cwd(), join(root, "plain.txt")),
          styled_path: relative(process.cwd(), join(root, "styled.ans")),
          output_path: relative(process.cwd(), join(root, "result.chardesk")),
        },
      });
      expect(rejected.isError).not.toBe(true);
      expect(rejected.structuredContent).toMatchObject({
        status: "rejected",
        code: "geometry-mismatch",
        retryable: true,
      });
    } finally {
      await client.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
