import { mkdtemp, mkdir, realpath } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { resolveWorkspaceBoardPath } from "./paths.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("resolveWorkspaceBoardPath", () => {
  it("accepts a missing board below an existing workspace directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "chardesk-blackboard-path-"));
    roots.push(root);
    await mkdir(join(root, "boards"));
    await expect(resolveWorkspaceBoardPath(root, "boards/team.chardesk")).resolves.toEqual({
      root: await realpath(root),
      path: join(await realpath(root), "boards/team.chardesk"),
    });
  });

  it("rejects wrong suffixes and paths outside the workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "chardesk-blackboard-path-"));
    roots.push(root);
    await expect(resolveWorkspaceBoardPath(root, "board.txt")).rejects.toThrow(".chardesk file");
    await expect(resolveWorkspaceBoardPath(root, "../board.chardesk")).rejects.toThrow("inside the current workspace");
  });

  it("resolves a Blackboard directory to its root manifest", async () => {
    const root = await mkdtemp(join(tmpdir(), "chardesk-blackboard-path-"));
    roots.push(root);
    await mkdir(join(root, "gpu"));
    await expect(resolveWorkspaceBoardPath(root, "gpu")).resolves.toEqual({
      root: await realpath(root),
      path: join(await realpath(root), "gpu/blackboard.yaml"),
    });
  });
});
