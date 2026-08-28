import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkBlackboardBytes, checkBlackboardFile } from "./check.js";
import { resolveWorkspaceBoardPath } from "./paths.js";

const bytes = (source: string) => new TextEncoder().encode(source);
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("checkBlackboardBytes", () => {
  it("accepts Plain, ESC-less ANSI, CJK and emoji", async () => {
    await expect(checkBlackboardBytes(bytes("┌──┐\n│界│\n└──┘"))).resolves.toEqual({ accepted: true });
    await expect(checkBlackboardBytes(bytes("[1;32m登录[0m 👩‍💻"))).resolves.toEqual({ accepted: true });
    await expect(checkBlackboardBytes(bytes([
      "---",
      "chardesk: document/v1",
      "mode: freeform",
      "---",
      "[1;32mCanonical[0m",
    ].join("\n")))).resolves.toEqual({ accepted: true });
  });

  it("rejects canonical modes that Blackboard cannot display", async () => {
    await expect(checkBlackboardBytes(bytes([
      "---",
      "chardesk: document/v1",
      "mode: slide",
      "---",
      "## Slide",
    ].join("\n")))).resolves.toMatchObject({
      accepted: false,
      issue: { code: "unsupported-document-mode" },
    });
  });

  it("rejects terminal escapes and protocol diagnostics", async () => {
    await expect(checkBlackboardBytes(bytes("\u001b[31mred\u001b[0m"))).resolves.toMatchObject({
      accepted: false,
      issue: { code: "terminal-escape", offset: 0 },
    });
    await expect(checkBlackboardBytes(bytes("[999mred[0m"))).resolves.toMatchObject({
      accepted: false,
      issue: { code: "protocol-diagnostic" },
    });
  });

  it("rejects malformed UTF-8", async () => {
    await expect(checkBlackboardBytes(Uint8Array.from([0xc3, 0x28]))).resolves.toMatchObject({
      accepted: false,
      issue: { code: "invalid-utf8" },
    });
  });

  it("checks every registered package panel and reports unused drafts", async () => {
    const root = await mkdtemp(join(tmpdir(), "chardesk-blackboard-check-"));
    roots.push(root);
    await mkdir(join(root, "panels"));
    await writeFile(join(root, "blackboard.yaml"), `
chardesk: blackboard/v1
panels:
  shown: { source: panels/shown.panel }
  draft: { source: panels/draft.panel }
layout:
  areas: [[shown]]
`);
    await writeFile(join(root, "panels/shown.panel"), "shown");
    await writeFile(join(root, "panels/draft.panel"), "draft");
    const board = await resolveWorkspaceBoardPath(root, ".");
    await expect(checkBlackboardFile(board)).resolves.toEqual({
      accepted: true,
      warnings: ["Panel \"draft\" is registered but not used by layout.areas."],
    });
  });
});
