import { mkdir, mkdtemp, realpath, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveWorkspacePath } from "./paths.js";

describe("workspace path resolution", () => {
  it("accepts workspace files and rejects traversal", async () => {
    const root = await mkdtemp(join(tmpdir(), "chardesk-path-"));
    await writeFile(join(root, "plain.txt"), "A", "utf8");
    await expect(resolveWorkspacePath(root, "plain.txt")).resolves.toBe(
      await realpath(join(root, "plain.txt"))
    );
    await expect(resolveWorkspacePath(root, "../outside.txt")).rejects.toThrow();
  });

  it("rejects a symlinked output directory outside the workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "chardesk-path-"));
    const outside = await mkdtemp(join(tmpdir(), "chardesk-outside-"));
    await mkdir(join(root, "safe"));
    await symlink(outside, join(root, "escaped"));
    await expect(
      resolveWorkspacePath(root, "escaped/result.chardesk", { output: true })
    ).rejects.toThrow(/inside/);
  });
});
