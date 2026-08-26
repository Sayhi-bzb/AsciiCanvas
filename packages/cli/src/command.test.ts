import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { parseCliArguments, runCli } from "./command.js";

const temporaryDirectories: string[] = [];

const temporaryDirectory = async () => {
  const path = await mkdtemp(join(tmpdir(), "chardesk-cli-"));
  temporaryDirectories.push(path);
  return path;
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) =>
    rm(path, { recursive: true, force: true })
  ));
});

const capture = () => {
  let text = "";
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      text += chunk.toString();
      callback();
    },
  });
  return { stream, text: () => text };
};

const streams = (input: Uint8Array | string = "") => {
  const stdout = capture();
  const stderr = capture();
  return {
    value: {
      stdin: (async function* () { yield input; })(),
      stdout: stdout.stream,
      stderr: stderr.stream,
    },
    stdout: stdout.text,
    stderr: stderr.text,
  };
};

describe("chardesk render command", () => {
  it("parses the stable first-version command contract", () => {
    expect(parseCliArguments([
      "render", "input.md", "-o", "output.png", "--strict",
    ])).toEqual({
      help: false,
      command: {
        kind: "render",
        input: "input.md",
        output: "output.png",
        format: "png",
        inputMode: "auto",
        scale: 2,
        padding: 16,
        strict: true,
        json: false,
      },
    });
  });

  it("infers render formats and keeps check as a no-output command", () => {
    expect(parseCliArguments([
      "render", "input.md", "-o", "board.chardesk",
    ])).toMatchObject({ command: { kind: "render", format: "chardesk" } });
    expect(parseCliArguments([
      "render", "input.md", "-o", "-", "--format", "text",
    ])).toMatchObject({ command: { kind: "render", output: "-", format: "text" } });
    expect(parseCliArguments([
      "check", "input.md", "--json",
    ])).toEqual({
      help: false,
      command: {
        kind: "check",
        input: "input.md",
        inputMode: "auto",
        json: true,
      },
    });
    expect(() => parseCliArguments([
      "render", "input.md", "-o", "-", "--format", "text", "--json",
    ])).toThrow("--json cannot be combined");
    expect(() => parseCliArguments([
      "render", "input.md", "-o", "output.txt", "--scale", "2",
    ])).toThrow("apply only to PNG");
  });

  it("renders stdin to an atomically replaceable PNG and reports JSON", async () => {
    const cwd = await temporaryDirectory();
    const io = streams("# Agent\n\n**Ready** 中文🙂");
    const args = ["render", "-", "-o", "result.png", "--json"];

    await expect(runCli(args, io.value, cwd)).resolves.toBe(0);
    await expect(runCli(args, streams("# Updated").value, cwd)).resolves.toBe(0);
    const result = JSON.parse(io.stdout());
    expect(result).toMatchObject({
      status: "rendered",
      inputMode: "chargraph",
      renderer: "markdown",
      diagnostics: [],
    });
    expect(Array.from((await readFile(join(cwd, "result.png"))).slice(0, 4)))
      .toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("detects .chardesk inputs and rejects diagnostics in strict mode", async () => {
    const cwd = await temporaryDirectory();
    await writeFile(join(cwd, "board.chardesk"), "[31mRed[0m", "utf8");
    const board = streams();
    expect(await runCli([
      "render", "board.chardesk", "-o", "board.png", "--json",
    ], board.value, cwd)).toBe(0);
    expect(JSON.parse(board.stdout())).toMatchObject({ inputMode: "chardesk" });

    const invalid = streams("```mermaid\nnot-a-diagram\n```");
    expect(await runCli([
      "render", "-", "-o", "invalid.png", "--strict", "--json",
    ], invalid.value, cwd)).toBe(1);
    expect(JSON.parse(invalid.stdout())).toMatchObject({ status: "rejected" });
    await expect(access(join(cwd, "invalid.png"))).rejects.toThrow();
  });

  it("writes inferred text formats and supports plain text on stdout", async () => {
    const cwd = await temporaryDirectory();
    for (const [filename, marker] of [
      ["result.chardesk", "[1m"],
      ["result.ans", "\u001b["],
      ["result.txt", "Ready 界"],
    ] as const) {
      const io = streams("**Ready** 界");
      expect(await runCli([
        "render", "-", "-o", filename, "--strict",
      ], io.value, cwd)).toBe(0);
      expect(await readFile(join(cwd, filename), "utf8")).toContain(marker);
    }
    expect(await readFile(join(cwd, "result.chardesk"), "utf8"))
      .not.toContain("\u001b");

    const stdout = streams("**Ready** 界");
    expect(await runCli([
      "render", "-", "-o", "-", "--format", "text", "--strict",
    ], stdout.value, cwd)).toBe(0);
    expect(stdout.stdout()).toBe("Ready 界");
    expect(stdout.stderr()).toBe("");
  });

  it("checks valid and diagnostic-bearing input without writing an artifact", async () => {
    const valid = streams("# Valid");
    expect(await runCli(["check", "-", "--json"], valid.value)).toBe(0);
    expect(JSON.parse(valid.stdout())).toMatchObject({
      status: "valid",
      renderer: "markdown",
      diagnostics: [],
    });

    const invalid = streams("```mermaid\nnot-a-diagram\n```");
    expect(await runCli(["check", "-", "--json"], invalid.value)).toBe(1);
    expect(JSON.parse(invalid.stdout())).toMatchObject({
      status: "invalid",
      renderer: "markdown",
    });
    expect(JSON.parse(invalid.stdout()).diagnostics.length).toBeGreaterThan(0);
  });

  it("keeps usage and content failures on distinct exit codes", async () => {
    const usage = streams();
    expect(await runCli(["render", "input.md"], usage.value)).toBe(2);
    expect(usage.stderr()).toContain("requires -o");

    const invalidUtf8 = streams(new Uint8Array([0xff]));
    expect(await runCli([
      "render", "-", "-o", "unused.png", "--json",
    ], invalidUtf8.value)).toBe(1);
    expect(JSON.parse(invalidUtf8.stdout())).toMatchObject({
      status: "error",
      code: "invalid-utf8",
    });
  });
});
