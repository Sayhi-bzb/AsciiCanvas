import { describe, expect, it } from "vitest";
import { checkBlackboardBytes } from "./check.js";

const bytes = (source: string) => new TextEncoder().encode(source);

describe("checkBlackboardBytes", () => {
  it("accepts Plain, ESC-less ANSI, CJK and emoji", () => {
    expect(checkBlackboardBytes(bytes("┌──┐\n│界│\n└──┘"))).toEqual({ accepted: true });
    expect(checkBlackboardBytes(bytes("[1;32m登录[0m 👩‍💻"))).toEqual({ accepted: true });
  });

  it("rejects terminal escapes and protocol diagnostics", () => {
    expect(checkBlackboardBytes(bytes("\u001b[31mred\u001b[0m"))).toMatchObject({
      accepted: false,
      issue: { code: "terminal-escape", offset: 0 },
    });
    expect(checkBlackboardBytes(bytes("[999mred[0m"))).toMatchObject({
      accepted: false,
      issue: { code: "protocol-diagnostic" },
    });
  });

  it("rejects malformed UTF-8", () => {
    expect(checkBlackboardBytes(Uint8Array.from([0xc3, 0x28]))).toMatchObject({
      accepted: false,
      issue: { code: "invalid-utf8" },
    });
  });
});
