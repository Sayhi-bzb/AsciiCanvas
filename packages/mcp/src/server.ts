#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { publishCanvasFiles } from "./authoring.js";
import { resolveWorkspacePath } from "./paths.js";

const server = new McpServer(
  { name: "chardesk", version: "0.2.0" },
  {
    instructions:
      "Prefer read and apply_patch: write .chardesk/work/<name>/plain.txt, patch only intentional style spans in the generated styled.ans, then publish. Unstyled cells inherit the renderer default.",
  }
);

const result = (value: unknown, isError = false) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value) }],
  structuredContent: value as Record<string, unknown>,
  ...(isError ? { isError: true } : {}),
});

server.registerTool(
  "publish_canvas",
  {
    description: "Validate Plain against visible ESC-less ANSI, then atomically publish that text as .chardesk.",
    inputSchema: z.object({
      plain_path: z.string().min(1),
      styled_path: z.string().min(1),
      output_path: z.string().endsWith(".chardesk"),
    }),
  },
  async ({ plain_path, styled_path, output_path }) => {
    try {
      const cwd = process.cwd();
      const [plain, styled, output] = await Promise.all([
        resolveWorkspacePath(cwd, plain_path),
        resolveWorkspacePath(cwd, styled_path),
        resolveWorkspacePath(cwd, output_path, { output: true }),
      ]);
      const published = await publishCanvasFiles(plain, styled, output);
      if (!published.accepted) {
        return result({
          status: "rejected",
          code: published.code,
          retryable: published.retryable,
          issue: published.mismatch ?? published.diagnostics?.[0] ?? published.message,
        });
      }
      return result({ status: "accepted" });
    } catch (error) {
      return result(
        { status: "error", message: error instanceof Error ? error.message : "Publishing failed." },
        true
      );
    }
  }
);

await server.connect(new StdioServerTransport());
