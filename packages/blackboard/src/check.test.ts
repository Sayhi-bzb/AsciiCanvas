import { describe, expect, it } from "vitest";
import { checkBlackboardBytes } from "./check.js";

const bytes = (source: string) => new TextEncoder().encode(source);

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
});
