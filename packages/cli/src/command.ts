import { randomUUID } from "node:crypto";
import { readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import type { Writable } from "node:stream";
import { parseArgs } from "node:util";
import {
  BlackboardPackageError,
  compileBlackboardPackage,
} from "@chardesk/blackboard/node";
import {
  parseCharDeskDocumentEnvelope,
  serializeCharDeskDocumentEnvelope,
} from "@chardesk/document";
import {
  CharDeskCliRenderError,
  compileSource,
  renderSource,
  type CharDeskCliDiagnostic,
  type CharDeskCliInputMode,
  type CharDeskCliOutputFormat,
} from "./render.js";
import {
  CharDeskCliRasterProcessError,
  renderSourceInRasterProcess,
} from "./raster-process.js";
import {
  projectCharDeskResult,
  type CharDeskResultRegion,
} from "./result.js";

type InputModeOption = "auto" | CharDeskCliInputMode | "blackboard";

type CommonCommand = {
  input: string;
  inputMode: InputModeOption;
  json: boolean;
};

type RenderCommand = CommonCommand & {
  kind: "render";
  output: string;
  format: CharDeskCliOutputFormat;
  scale: number;
  padding: number;
  strict: boolean;
};

type CheckCommand = CommonCommand & {
  kind: "check";
};

type ResultCommand = CommonCommand & {
  kind: "result";
  region?: CharDeskResultRegion;
  ruler: boolean;
  styles: boolean;
};

type CliCommand = RenderCommand | CheckCommand | ResultCommand;

type CliStreams = {
  stdin: AsyncIterable<Uint8Array | string>;
  stdout: Pick<Writable, "write">;
  stderr: Pick<Writable, "write">;
};

class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

class CliCommandError extends Error {
  constructor(readonly code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CliCommandError";
  }
}

const CLI_USAGE = [
  "Usage:",
  "  chardesk render <input|-> -o <output|-> [options]",
  "  chardesk check <input|-> [options]",
  "  chardesk result <input|-> [options]",
  "",
  "Options:",
  "  -o, --output <path|->              Render output (required)",
  "      --format <png|chardesk|ansi|text>",
  "      --input <auto|chargraph|chardesk|blackboard>",
  "      --region <x,y,columns,rows>      Result grid region",
  "      --no-ruler                      Hide result coordinates",
  "      --styles                        Include materialized style evidence",
  "      --scale <1..4>                  PNG raster scale (default: 2)",
  "      --padding <0..256>              PNG logical padding (default: 16)",
  "      --strict                        Reject render diagnostics",
  "      --json                          Print a machine-readable result",
  "  -h, --help                          Show this help",
].join("\n");

const parseRawArguments = (args: readonly string[]) => parseArgs({
  args: [...args],
  allowPositionals: true,
  strict: true,
  options: {
    output: { type: "string", short: "o" },
    format: { type: "string" },
    input: { type: "string" },
    scale: { type: "string" },
    padding: { type: "string" },
    region: { type: "string" },
    "no-ruler": { type: "boolean", default: false },
    styles: { type: "boolean", default: false },
    strict: { type: "boolean", default: false },
    json: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

const integerOption = (
  value: string | undefined,
  name: "scale" | "padding",
  fallback: number
) => {
  if (value === undefined) return fallback;
  if (!/^\d+$/u.test(value)) throw new CliUsageError(`--${name} must be an integer.`);
  const parsed = Number(value);
  const minimum = name === "scale" ? 1 : 0;
  const maximum = name === "scale" ? 4 : 256;
  if (parsed < minimum || parsed > maximum) {
    throw new CliUsageError(`--${name} must be from ${minimum} through ${maximum}.`);
  }
  return parsed;
};

const parseInputMode = (value: string | undefined): InputModeOption => {
  const inputMode = value ?? "auto";
  if (!("auto,chargraph,chardesk,blackboard".split(",") as InputModeOption[]).includes(
    inputMode as InputModeOption
  )) {
    throw new CliUsageError("--input must be auto, chargraph, chardesk, or blackboard.");
  }
  return inputMode as InputModeOption;
};

const parseRegion = (value: string | undefined): CharDeskResultRegion | undefined => {
  if (value === undefined) return undefined;
  const parts = value.split(",");
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/u.test(part))) {
    throw new CliUsageError("--region must be x,y,columns,rows using integers.");
  }
  const [x, y, columns, rows] = parts.map(Number);
  if (
    !Number.isSafeInteger(x) || !Number.isSafeInteger(y)
    || !Number.isSafeInteger(columns) || !Number.isSafeInteger(rows)
    || columns === 0 || rows === 0
  ) {
    throw new CliUsageError("--region columns and rows must be positive safe integers.");
  }
  return { x: x!, y: y!, columns: columns!, rows: rows! };
};

const FORMAT_BY_EXTENSION: Record<string, CharDeskCliOutputFormat> = {
  ".png": "png",
  ".chardesk": "chardesk",
  ".ans": "ansi",
  ".txt": "text",
};

const parseOutputFormat = (
  output: string,
  value: string | undefined
): CharDeskCliOutputFormat => {
  if (value !== undefined) {
    if (!("png,chardesk,ansi,text".split(",") as CharDeskCliOutputFormat[]).includes(
      value as CharDeskCliOutputFormat
    )) {
      throw new CliUsageError("--format must be png, chardesk, ansi, or text.");
    }
    return value as CharDeskCliOutputFormat;
  }
  if (output === "-") {
    throw new CliUsageError("rendering to stdout requires --format.");
  }
  const format = FORMAT_BY_EXTENSION[extname(output).toLowerCase()];
  if (!format) {
    throw new CliUsageError(
      "The output suffix must be .png, .chardesk, .ans, or .txt, or use --format."
    );
  }
  return format;
};

export const parseCliArguments = (
  args: readonly string[]
): { help: true } | { help: false; command: CliCommand } => {
  let parsed: ReturnType<typeof parseRawArguments>;
  try {
    parsed = parseRawArguments(args);
  } catch (error) {
    throw new CliUsageError(error instanceof Error ? error.message : "Invalid arguments.");
  }
  if (parsed.values.help) return { help: true };
  const [kind, input, ...extra] = parsed.positionals;
  if (kind !== "render" && kind !== "check" && kind !== "result") {
    throw new CliUsageError("The first argument must be render, check, or result.");
  }
  if (!input || extra.length > 0) {
    throw new CliUsageError(`${kind} requires exactly one input.`);
  }
  const common = {
    input,
    inputMode: parseInputMode(parsed.values.input),
    json: parsed.values.json ?? false,
  };
  if (kind === "check") {
    if (
      parsed.values.output !== undefined ||
      parsed.values.format !== undefined ||
      parsed.values.scale !== undefined ||
      parsed.values.padding !== undefined ||
      parsed.values.region !== undefined ||
      parsed.values["no-ruler"] ||
      parsed.values.styles ||
      parsed.values.strict
    ) {
      throw new CliUsageError("check accepts only --input and --json options.");
    }
    return { help: false, command: { kind, ...common } };
  }

  if (kind === "result") {
    if (
      parsed.values.output !== undefined
      || parsed.values.format !== undefined
      || parsed.values.scale !== undefined
      || parsed.values.padding !== undefined
      || parsed.values.strict
      || parsed.values.json
    ) {
      throw new CliUsageError(
        "result accepts only --input, --region, --no-ruler, and --styles options.",
      );
    }
    if (input === "-" && common.inputMode === "blackboard") {
      throw new CliUsageError("Blackboard input requires a file or directory path.");
    }
    return {
      help: false,
      command: {
        kind,
        ...common,
        region: parseRegion(parsed.values.region),
        ruler: !(parsed.values["no-ruler"] ?? false),
        styles: parsed.values.styles ?? false,
      },
    };
  }

  if (
    parsed.values.region !== undefined
    || parsed.values["no-ruler"]
    || parsed.values.styles
  ) {
    throw new CliUsageError("--region, --no-ruler, and --styles apply only to result output.");
  }

  const output = parsed.values.output;
  if (!output) throw new CliUsageError("render requires -o <output|->.");
  const format = parseOutputFormat(output, parsed.values.format);
  if (output === "-" && format === "png") {
    throw new CliUsageError("PNG output requires a file path.");
  }
  if (output === "-" && parsed.values.json) {
    throw new CliUsageError("--json cannot be combined with stdout artifact output.");
  }
  if (
    format !== "png" &&
    (parsed.values.scale !== undefined || parsed.values.padding !== undefined)
  ) {
    throw new CliUsageError("--scale and --padding apply only to PNG output.");
  }
  return {
    help: false,
    command: {
      kind,
      ...common,
      output,
      format,
      scale: integerOption(parsed.values.scale, "scale", 2),
      padding: integerOption(parsed.values.padding, "padding", 16),
      strict: parsed.values.strict ?? false,
    },
  };
};

const decodeUtf8 = (bytes: Uint8Array) => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new CliCommandError("invalid-utf8", "Input must be valid UTF-8.");
  }
};

const readStdin = async (stream: CliStreams["stdin"]) => {
  const chunks: Uint8Array[] = [];
  let length = 0;
  for await (const chunk of stream) {
    const bytes = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    chunks.push(bytes);
    length += bytes.length;
  }
  const joined = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  return decodeUtf8(joined);
};

const resolveInputMode = (
  command: CommonCommand
): CharDeskCliInputMode => command.inputMode === "auto"
  ? command.input !== "-" && extname(command.input).toLowerCase() === ".chardesk"
    ? "chardesk"
    : "chargraph"
  : command.inputMode === "blackboard" ? "chardesk" : command.inputMode;

const resolveDocumentInput = (command: CommonCommand, source: string) => {
  const document = parseCharDeskDocumentEnvelope(source);
  if (!document) return { source, inputMode: resolveInputMode(command) };
  if (document.mode !== "freeform") {
    throw new CliCommandError(
      "unsupported-document-mode",
      `CharDesk CLI does not render ${document.mode} documents yet.`
    );
  }
  return { source: document.body, inputMode: "chardesk" as const };
};

const writeAtomically = async (output: string, bytes: Uint8Array) => {
  const temporary = resolve(
    dirname(output),
    `.${basename(output)}.${process.pid}.${randomUUID()}.tmp`
  );
  try {
    await writeFile(temporary, bytes, { flag: "wx" });
    await rename(temporary, output);
  } catch (error) {
    throw new CliCommandError(
      "write-failed",
      `Could not write output: ${output}`,
      { cause: error }
    );
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
};

const warning = (diagnostic: CharDeskCliDiagnostic) => {
  const position = diagnostic.offset === undefined ? "" : ` at ${diagnostic.offset}`;
  return `warning ${diagnostic.code}${position}: ${diagnostic.message}\n`;
};

const errorCode = (error: unknown) => {
  if (
    error instanceof CliCommandError
    || error instanceof CharDeskCliRenderError
    || error instanceof CharDeskCliRasterProcessError
    || error instanceof BlackboardPackageError
  ) {
    return error.code;
  }
  return "render-failed";
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "CharDesk command failed.";

type ResolvedCommandInput = {
  source: string;
  inputMode: CharDeskCliInputMode;
  warnings: string[];
};

const resolveCommandInput = async (
  command: CommonCommand,
  streams: CliStreams,
  cwd: string,
): Promise<ResolvedCommandInput> => {
  if (command.input === "-") {
    if (command.inputMode === "blackboard") {
      throw new CliCommandError(
        "invalid-blackboard-input",
        "Blackboard input requires a file or directory path.",
      );
    }
    const source = await readStdin(streams.stdin);
    return { ...resolveDocumentInput(command, source), warnings: [] };
  }

  const requested = resolve(cwd, command.input);
  let directory = false;
  try {
    directory = (await stat(requested)).isDirectory();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const blackboard = command.inputMode === "blackboard"
    || (command.inputMode === "auto" && (directory || basename(requested) === "blackboard.yaml"));
  if (blackboard) {
    const manifest = directory ? join(requested, "blackboard.yaml") : requested;
    if (basename(manifest) !== "blackboard.yaml") {
      throw new CliCommandError(
        "invalid-blackboard-input",
        "Blackboard input must be blackboard.yaml or a directory containing it.",
      );
    }
    const compiled = await compileBlackboardPackage(manifest);
    return {
      source: compiled.source,
      inputMode: "chardesk",
      warnings: compiled.warnings.map((item) => item.message),
    };
  }

  const source = decodeUtf8(await readFile(requested));
  return { ...resolveDocumentInput(command, source), warnings: [] };
};

const compilationResult = (
  compiled: Awaited<ReturnType<typeof compileSource>>
) => ({
  inputMode: compiled.inputMode,
  renderer: compiled.renderer,
  pipeline: compiled.pipeline,
  columns: compiled.columns,
  rows: compiled.rows,
  diagnostics: compiled.diagnostics,
});

const runCheck = async (
  command: CheckCommand,
  input: ResolvedCommandInput,
  streams: CliStreams
) => {
  const compiled = await compileSource({
    source: input.source,
    inputMode: input.inputMode,
  });
  const status = compiled.diagnostics.length === 0 ? "valid" : "invalid";
  const result = { status, ...compilationResult(compiled) };
  if (command.json) streams.stdout.write(`${JSON.stringify(result)}\n`);
  else if (status === "valid") streams.stdout.write("valid\n");
  else compiled.diagnostics.forEach((item) => streams.stderr.write(warning(item)));
  if (!command.json) input.warnings.forEach((item) =>
    streams.stderr.write(`warning blackboard: ${item}\n`)
  );
  return status === "valid" ? 0 : 1;
};

const runRender = async (
  command: RenderCommand,
  input: ResolvedCommandInput,
  streams: CliStreams,
  cwd: string
) => {
  const inputMode = input.inputMode;
  const rendered = command.format === "png"
    ? await renderSourceInRasterProcess({
        source: input.source,
        inputMode,
        scale: command.scale,
        padding: command.padding,
      })
    : await renderSource({
        source: input.source,
        inputMode,
        format: command.format,
        scale: command.scale,
        padding: command.padding,
      });
  if (command.strict && rendered.diagnostics.length > 0) {
    const rejected = {
      status: "rejected",
      format: rendered.format,
      diagnostics: rendered.diagnostics,
    };
    if (command.json) streams.stdout.write(`${JSON.stringify(rejected)}\n`);
    else rendered.diagnostics.forEach((item) => streams.stderr.write(warning(item)));
    return 1;
  }

  const output = command.output === "-" ? "-" : resolve(cwd, command.output);
  const artifactBytes = command.format === "chardesk"
    ? new TextEncoder().encode(serializeCharDeskDocumentEnvelope({
        mode: "freeform",
        body: decodeUtf8(rendered.bytes),
      }))
    : rendered.bytes;
  if (output === "-") streams.stdout.write(artifactBytes);
  else await writeAtomically(output, artifactBytes);
  const result = {
    status: "rendered",
    output,
    format: rendered.format,
    inputMode: rendered.inputMode,
    renderer: rendered.renderer,
    pipeline: rendered.pipeline,
    columns: rendered.columns,
    rows: rendered.rows,
    ...(rendered.width === undefined ? {} : { width: rendered.width }),
    ...(rendered.height === undefined ? {} : { height: rendered.height }),
    diagnostics: rendered.diagnostics,
  };
  if (output !== "-") {
    if (command.json) streams.stdout.write(`${JSON.stringify(result)}\n`);
    else streams.stdout.write(`${output}\n`);
  }
  if (!command.json) {
    rendered.diagnostics.forEach((item) => streams.stderr.write(warning(item)));
    input.warnings.forEach((item) => streams.stderr.write(`warning blackboard: ${item}\n`));
  }
  return 0;
};

const omittedSummary = (
  omitted: ReturnType<typeof projectCharDeskResult>["omitted"],
) => {
  const parts = (Object.entries(omitted) as Array<[
    keyof typeof omitted,
    number,
  ]>).flatMap(([side, amount]) => amount === 0 ? [] : [`${side} ${amount}`]);
  return parts.length === 0 ? "none" : parts.join(" · ");
};

const runResult = async (
  command: ResultCommand,
  input: ResolvedCommandInput,
  streams: CliStreams,
) => {
  const compiled = await compileSource({
    source: input.source,
    inputMode: input.inputMode,
  });
  if (
    command.region
    && (command.region.x >= compiled.columns || command.region.y >= compiled.rows)
  ) {
    throw new CliCommandError(
      "region-out-of-bounds",
      `Region origin must be inside the ${compiled.columns}×${compiled.rows} grid.`,
    );
  }
  const projection = projectCharDeskResult(compiled.document, {
    region: command.region,
    ruler: command.ruler,
    styles: command.styles,
  });
  const status = compiled.diagnostics.length === 0 ? "valid" : "invalid";
  const endX = projection.view.x + projection.view.columns - 1;
  const endY = projection.view.y + projection.view.rows - 1;
  const output = [
    `result: ${status}`,
    `renderer: ${compiled.renderer}`,
    `pipeline: ${compiled.pipeline.join(" → ")}`,
    `grid: ${compiled.columns} cols × ${compiled.rows} rows`,
    `view: x=${projection.view.x}..${endX}, y=${projection.view.y}..${endY} · ${projection.view.columns}×${projection.view.rows} cells`,
    `omitted: ${omittedSummary(projection.omitted)}`,
    "",
    projection.text,
  ];
  if (projection.styleText) output.push("", projection.styleText);
  streams.stdout.write(`${output.join("\n")}\n`);
  compiled.diagnostics.forEach((item) => streams.stderr.write(warning(item)));
  input.warnings.forEach((item) => streams.stderr.write(`warning blackboard: ${item}\n`));
  return status === "valid" ? 0 : 1;
};

export const runCli = async (
  args: readonly string[],
  streams: CliStreams,
  cwd = process.cwd()
): Promise<number> => {
  let parsed: ReturnType<typeof parseCliArguments>;
  try {
    parsed = parseCliArguments(args);
  } catch (error) {
    streams.stderr.write(`${errorMessage(error)}\n\n${CLI_USAGE}\n`);
    return 2;
  }
  if (parsed.help) {
    streams.stdout.write(`${CLI_USAGE}\n`);
    return 0;
  }

  const command = parsed.command;
  try {
    const input = await resolveCommandInput(command, streams, cwd);
    if (command.kind === "check") return runCheck(command, input, streams);
    if (command.kind === "result") return runResult(command, input, streams);
    return runRender(command, input, streams, cwd);
  } catch (error) {
    const result = {
      status: "error",
      code: errorCode(error),
      message: errorMessage(error),
    };
    if (command.json) streams.stdout.write(`${JSON.stringify(result)}\n`);
    else streams.stderr.write(`${result.code}: ${result.message}\n`);
    return 1;
  }
};
