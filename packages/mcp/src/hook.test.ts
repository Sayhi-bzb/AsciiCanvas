import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { handlePostToolUse } from "./hook.js";

const payload = (cwd: string, patch: string) => ({
  cwd,
  tool_name: "apply_patch",
  tool_input: { command: patch },
});

describe("PostToolUse hook", () => {
  it("ignores unrelated patches", async () => {
    await expect(handlePostToolUse(payload(process.cwd(), "*** Update File: README.md"))).resolves.toBeUndefined();
    await expect(
      handlePostToolUse(payload(process.cwd(), "*** Update File: ../.chardesk/work/escape/styled.ans"))
    ).resolves.toBeUndefined();
  });

  it("seeds styled text and publishes a default canvas after a plain patch", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "chardesk-hook-"));
    const work = join(cwd, ".chardesk", "work", "login");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(work, { recursive: true }));
    await writeFile(join(work, "plain.txt"), "A界", "utf8");
    const result = await handlePostToolUse(payload(cwd, "*** Add File: .chardesk/work/login/plain.txt"));
    expect(result).toMatchObject({
      hookSpecificOutput: {
        additionalContext: "Prepared styled.ans; published default canvas.",
      },
    });
    await expect(readFile(join(work, "styled.ans"), "utf8")).resolves.toBe("A界");
    await expect(readFile(join(cwd, "login.chardesk"), "utf8")).resolves.toBe("A界");
  });

  it("publishes after a styled patch and reports a concise rejection", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "chardesk-hook-"));
    const work = join(cwd, ".chardesk", "work", "login");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(work, { recursive: true }));
    await Promise.all([
      writeFile(join(work, "plain.txt"), "A", "utf8"),
      writeFile(join(work, "styled.ans"), "B", "utf8"),
    ]);
    const patch = "*** Update File: .chardesk/work/login/styled.ans";
    const rejected = await handlePostToolUse(payload(cwd, patch));
    expect(rejected?.hookSpecificOutput.additionalContext).toContain("geometry-mismatch");

    await writeFile(join(work, "styled.ans"), "[31mA[0m", "utf8");
    const accepted = await handlePostToolUse(payload(cwd, patch));
    expect(accepted?.hookSpecificOutput.additionalContext).toBe("Accepted.");
    await expect(readFile(join(cwd, "login.chardesk"), "utf8")).resolves.toBe("[31mA[0m");
  });
});
