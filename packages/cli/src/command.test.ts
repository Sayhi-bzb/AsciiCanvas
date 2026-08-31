import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

const streams = (
  input: Uint8Array | string = "",
  terminal: { isTTY?: boolean; columns?: number; rows?: number } = {},
) => {
  const stdout = capture();
  const stderr = capture();
  Object.assign(stdout.stream, terminal);
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
    expect(() => parseCliArguments([
      "render", "input.md", "-o", "output.txt", "--no-ruler",
    ])).toThrow("apply only to result");
    expect(parseCliArguments([
      "result", "input.chardesk", "--region", "2,3,40,20", "--no-ruler",
    ])).toEqual({
      help: false,
      command: {
        kind: "result",
        input: "input.chardesk",
        inputMode: "auto",
        json: false,
        region: { x: 2, y: 3, columns: 40, rows: 20 },
        ruler: false,
        styles: false,
      },
    });
    expect(() => parseCliArguments(["result", "-", "--json"]))
      .toThrow("result accepts only");
    expect(() => parseCliArguments(["result", "-", "--region", "1,2,0,4"]))
      .toThrow("positive safe integers");
    expect(parseCliArguments([
      "preview", "input.md", "--region", "4,5,40,20", "--color", "always",
    ])).toEqual({
      help: false,
      command: {
        kind: "preview",
        input: "input.md",
        inputMode: "auto",
        json: false,
        color: "always",
        region: { x: 4, y: 5, columns: 40, rows: 20 },
      },
    });
    expect(() => parseCliArguments(["preview", "-", "--color", "sometimes"]))
      .toThrow("--color must be auto, always, or never");
  });

  it("previews ANSI for TTYs and plain text for non-TTY output", async () => {
    const tty = streams("[31;1mA[0m", { isTTY: true, columns: 10, rows: 5 });
    expect(await runCli([
      "preview", "-", "--input", "chardesk",
    ], tty.value, process.cwd(), {})).toBe(0);
    expect(tty.stdout()).toContain("\u001b[1;38;2;128;0;0mA");
    expect(tty.stdout()).not.toContain("48;2;255;255;255");
    expect(tty.stdout()).not.toContain("result:");
    expect(tty.stderr()).toBe("");

    const plain = streams("[31;1mA[0m");
    expect(await runCli([
      "preview", "-", "--input", "chardesk",
    ], plain.value, process.cwd(), {})).toBe(0);
    expect(plain.stdout()).toBe("A\n");
    expect(plain.stdout()).not.toContain("\u001b");

    const forced = streams("[31mA[0m");
    expect(await runCli([
      "preview", "-", "--input", "chardesk", "--color", "always",
    ], forced.value, process.cwd(), {})).toBe(0);
    expect(forced.stdout()).toContain("\u001b[");
  });

  it("respects NO_COLOR and reports terminal viewport omissions", async () => {
    const noColor = streams("[31mA[0m", { isTTY: true, columns: 10, rows: 5 });
    expect(await runCli([
      "preview", "-", "--input", "chardesk",
    ], noColor.value, process.cwd(), { NO_COLOR: "" })).toBe(0);
    expect(noColor.stdout()).toBe("A\n");
    expect(noColor.stdout()).not.toContain("\u001b");

    const dumb = streams("[31mA[0m", { isTTY: true, columns: 10, rows: 5 });
    expect(await runCli([
      "preview", "-", "--input", "chardesk",
    ], dumb.value, process.cwd(), { TERM: "dumb" })).toBe(0);
    expect(dumb.stdout()).toBe("A\n");
    expect(dumb.stdout()).not.toContain("\u001b");

    const cropped = streams("0123456789", { isTTY: true, columns: 6, rows: 5 });
    expect(await runCli([
      "preview", "-", "--input", "chardesk", "--color", "never",
    ], cropped.value, process.cwd(), {})).toBe(0);
    expect(cropped.stdout()).toBe("01234\n");
    expect(cropped.stderr()).toContain("preview view x=0..4, y=0..0; omitted: right 5");

    const tooSmall = streams("界", { isTTY: true, columns: 2, rows: 5 });
    expect(await runCli([
      "preview", "-", "--input", "chardesk",
    ], tooSmall.value, process.cwd(), {})).toBe(1);
    expect(tooSmall.stderr()).toContain("terminal-too-small");
  });

  it("prints diagnostic fallback previews and fails validation", async () => {
    const invalid = streams(
      "```mermaid\nnot-a-diagram\n```",
      { isTTY: true, columns: 80, rows: 24 },
    );
    expect(await runCli([
      "preview", "-", "--color", "never",
    ], invalid.value, process.cwd(), {})).toBe(1);
    expect(invalid.stdout().length).toBeGreaterThan(0);
    expect(invalid.stderr()).toContain("warning");
  });

  it("prints a bounded materialized grid result without style controls", async () => {
    const io = streams("[31mA[0m \u754c\nCD");
    expect(await runCli([
      "result", "-", "--input", "chardesk",
    ], io.value)).toBe(0);

    expect(io.stdout()).toContain("result: valid");
    expect(io.stdout()).toContain("grid: 4 cols × 2 rows");
    expect(io.stdout()).toContain("0 │ A 界");
    expect(io.stdout()).toContain("1 │ CD");
    expect(io.stdout()).not.toContain("[31m");
    expect(io.stderr()).toBe("");
  });

  it("adds style evidence only when explicitly requested", async () => {
    const plain = streams("[31;1mStyled[0m plain");
    expect(await runCli([
      "result", "-", "--input", "chardesk", "--no-ruler",
    ], plain.value)).toBe(0);
    expect(plain.stdout()).not.toContain("styles:");

    const styled = streams("[31;1mStyled[0m plain");
    expect(await runCli([
      "result", "-", "--input", "chardesk", "--no-ruler", "--styles",
    ], styled.value)).toBe(0);
    expect(styled.stdout()).toContain("styles:\n  0:0-5{fg:#800000;bold}");
    expect(styled.stdout()).not.toContain("[31;1m");
  });

  it("supports absolute result regions and reports invalid fallback projections", async () => {
    const region = streams("0123456789\nabcdefghij");
    expect(await runCli([
      "result", "-", "--input", "chardesk", "--region", "5,1,4,1", "--no-ruler",
    ], region.value)).toBe(0);
    expect(region.stdout()).toContain("view: x=5..8, y=1..1 · 4×1 cells");
    expect(region.stdout()).toContain("\nfghi\n");

    const invalid = streams("```mermaid\nnot-a-diagram\n```");
    expect(await runCli(["result", "-"], invalid.value)).toBe(1);
    expect(invalid.stdout()).toContain("result: invalid");
    expect(invalid.stderr()).toContain("warning");
  });

  it("auto-detects Blackboard manifests and directories", async () => {
    const cwd = await temporaryDirectory();
    const board = join(cwd, "gpu");
    await mkdir(join(board, "panels"), { recursive: true });
    await writeFile(join(board, "blackboard.yaml"), [
      "chardesk: blackboard/v1",
      "panels:",
      "  left: { source: panels/left.panel }",
      "  right: { source: panels/right.panel }",
      "layout:",
      "  areas: [[left, right]]",
      "  gap: { column: 2, row: 0 }",
    ].join("\n"));
    await writeFile(join(board, "panels/left.panel"), "[31mGPU[0m");
    await writeFile(join(board, "panels/right.panel"), "\u663e卡");

    for (const input of ["gpu", "gpu/blackboard.yaml"]) {
      const io = streams();
      expect(await runCli(["result", input, "--no-ruler"], io.value, cwd)).toBe(0);
      expect(io.stdout()).toContain("GPU  显卡");
      expect(io.stdout()).not.toContain("[31m");
    }

    const styled = streams();
    expect(await runCli([
      "result", "gpu", "--no-ruler", "--styles",
    ], styled.value, cwd)).toBe(0);
    expect(styled.stdout()).toContain("0:0-2{fg:#800000}");

    const preview = streams();
    expect(await runCli([
      "preview", "gpu", "--color", "never",
    ], preview.value, cwd, {})).toBe(0);
    expect(preview.stdout()).toContain("GPU  显卡");
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

    await writeFile(join(cwd, "canonical.chardesk"), [
      "---",
      "chardesk: document/v1",
      "mode: freeform",
      "---",
      "[32mCanonical[0m",
    ].join("\n"), "utf8");
    const canonical = streams();
    expect(await runCli([
      "render", "canonical.chardesk", "-o", "canonical.txt", "--json",
    ], canonical.value, cwd)).toBe(0);
    expect(await readFile(join(cwd, "canonical.txt"), "utf8")).toBe("Canonical");

    const invalid = streams("```mermaid\nnot-a-diagram\n```");
    expect(await runCli([
      "render", "-", "-o", "invalid.png", "--strict", "--json",
    ], invalid.value, cwd)).toBe(1);
    expect(JSON.parse(invalid.stdout())).toMatchObject({ status: "rejected" });
    await expect(access(join(cwd, "invalid.png"))).rejects.toThrow();
  });

  it("recognizes unsupported canonical document modes", async () => {
    const io = streams([
      "---",
      "chardesk: document/v1",
      "mode: slide",
      "---",
      "## Intro",
    ].join("\n"));

    expect(await runCli([
      "check", "-", "--input", "chardesk", "--json",
    ], io.value)).toBe(1);
    expect(JSON.parse(io.stdout())).toMatchObject({
      status: "error",
      code: "unsupported-document-mode",
    });
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
    expect(await readFile(join(cwd, "result.chardesk"), "utf8"))
      .toContain("chardesk: document/v1");

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
