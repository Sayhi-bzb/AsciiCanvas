#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { CanvasDraftService } from "./drafts.js";

const drafts = new CanvasDraftService();
const server = new McpServer(
  { name: "chardesk", version: "0.1.0" },
  {
    instructions:
      "For styled CharDesk canvas text, call create_canvas_draft with a complete ANSI-free layout, observe its canonical text and revision, then call apply_canvas_style. Styling may add supported ANSI controls only; it must not change visible text, grapheme boundaries, line breaks, or cell positions. Retry a rejected style at most twice, then use the canonical plain draft.",
  }
);

const result = (value: unknown, isError = false) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value) }],
  structuredContent: value as Record<string, unknown>,
  ...(isError ? { isError: true } : {}),
});

server.registerTool(
  "create_canvas_draft",
  {
    description:
      "Save an ANSI-free CharDesk canvas layout before styling. Returns canonical plain text, revision, and geometry signature.",
    inputSchema: z.object({
      plain_text: z.string().describe("Complete plain Unicode canvas text without ANSI controls."),
    }),
  },
  async ({ plain_text }) => {
    try {
      const draft = drafts.create(plain_text);
      return result({
        draft_id: draft.draftId,
        revision: draft.revision,
        canonical_plain_text: draft.canonicalPlainText,
        geometry_signature: draft.geometrySignature,
        expires_at: draft.expiresAt,
      });
    } catch (error) {
      return result(
        {
          accepted: false,
          code: "invalid-plain-text",
          message: error instanceof Error ? error.message : "Invalid plain text.",
        },
        true
      );
    }
  }
);

server.registerTool(
  "apply_canvas_style",
  {
    description:
      "Apply ANSI styling to an existing plain draft. Accepts only identical visible text and cell geometry.",
    inputSchema: z.object({
      draft_id: z.string().min(1),
      revision: z.number().int().positive(),
      ansi_text: z.string().describe("Complete styled CharDesk text using ANSI or ESC-less SGR."),
    }),
  },
  async ({ draft_id, revision, ansi_text }) => {
    const applied = drafts.apply(draft_id, revision, ansi_text);
    if (!applied.accepted) {
      return result(
        {
          accepted: false,
          code: applied.code,
          message: applied.message,
          retryable: applied.retryable,
          ...(applied.diagnostics ? { diagnostics: applied.diagnostics } : {}),
          ...(applied.mismatch ? { mismatch: applied.mismatch } : {}),
          ...(applied.expectedGeometrySignature
            ? { expected_geometry_signature: applied.expectedGeometrySignature }
            : {}),
          ...(applied.actualGeometrySignature
            ? { actual_geometry_signature: applied.actualGeometrySignature }
            : {}),
        },
        true
      );
    }
    return result({
      accepted: true,
      draft_id: applied.draftId,
      revision: applied.revision,
      ansi_text: applied.ansiText,
      geometry_signature: applied.geometrySignature,
    });
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
