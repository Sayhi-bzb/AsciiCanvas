import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) =>
    rm(path, { recursive: true, force: true })
  ));
});

const runBinary = (cwd: string, args: readonly string[], input: string) => new Promise<{
  code: number | null;
  stdout: string;
  stderr: string;
}>((resolve) => {
  const child = spawn(process.execPath, [
    new URL("../dist/cli.js", import.meta.url).pathname,
    ...args,
  ], { cwd, stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.on("close", (code) => resolve({ code, stdout, stderr }));
  child.stdin.end(input);
});

describe("chardesk executable", () => {
  it("accepts Agent-authored CharGraph source over stdin", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "chardesk-cli-bin-"));
    temporaryDirectories.push(cwd);
    const result = await runBinary(cwd, [
      "render", "-", "-o", "binary.png", "--json",
    ], [
      "```mermaid",
      "flowchart LR",
      "  Agent --> PNG",
      "```",
    ].join("\n"));

    expect(result).toMatchObject({ code: 0, stderr: "" });
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: "rendered",
      renderer: "markdown",
    });
    await expect(access(join(cwd, "binary.png"))).resolves.toBeUndefined();
    expect(Array.from((await readFile(join(cwd, "binary.png"))).slice(0, 4)))
      .toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("inspects stdin without producing an artifact", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "chardesk-cli-bin-"));
    temporaryDirectories.push(cwd);
    const result = await runBinary(cwd, ["inspect", "-", "--json"], "# Valid");

    expect(result).toMatchObject({ code: 0, stderr: "" });
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: "valid",
      renderer: "markdown",
      diagnostics: [],
    });
  });
});
