import { randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import type { Writable } from "node:stream";
import { parseArgs } from "node:util";
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

type InputModeOption = "auto" | CharDeskCliInputMode;

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

type CliCommand = RenderCommand | CheckCommand;

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
  "",
  "Options:",
  "  -o, --output <path|->              Render output (required)",
  "      --format <png|chardesk|ansi|text>",
  "      --input <auto|chargraph|chardesk>",
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
  if (!("auto,chargraph,chardesk".split(",") as InputModeOption[]).includes(
    inputMode as InputModeOption
  )) {
    throw new CliUsageError("--input must be auto, chargraph, or chardesk.");
  }
  return inputMode as InputModeOption;
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
  if (kind !== "render" && kind !== "check") {
    throw new CliUsageError("The first argument must be render or check.");
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
      parsed.values.strict
    ) {
      throw new CliUsageError("check accepts only --input and --json options.");
    }
    return { help: false, command: { kind, ...common } };
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
  : command.inputMode;

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
  ) {
    return error.code;
  }
  return "render-failed";
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "CharDesk command failed.";

const readSource = async (command: CommonCommand, streams: CliStreams, cwd: string) =>
  command.input === "-"
    ? readStdin(streams.stdin)
    : decodeUtf8(await readFile(resolve(cwd, command.input)));

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
  source: string,
  streams: CliStreams
) => {
  const compiled = await compileSource({
    source,
    inputMode: resolveInputMode(command),
  });
  const status = compiled.diagnostics.length === 0 ? "valid" : "invalid";
  const result = { status, ...compilationResult(compiled) };
  if (command.json) streams.stdout.write(`${JSON.stringify(result)}\n`);
  else if (status === "valid") streams.stdout.write("valid\n");
  else compiled.diagnostics.forEach((item) => streams.stderr.write(warning(item)));
  return status === "valid" ? 0 : 1;
};

const runRender = async (
  command: RenderCommand,
  source: string,
  streams: CliStreams,
  cwd: string
) => {
  const inputMode = resolveInputMode(command);
  const rendered = command.format === "png"
    ? await renderSourceInRasterProcess({
        source,
        inputMode,
        scale: command.scale,
        padding: command.padding,
      })
    : await renderSource({
        source,
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
  if (output === "-") streams.stdout.write(rendered.bytes);
  else await writeAtomically(output, rendered.bytes);
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
  }
  return 0;
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
    const source = await readSource(command, streams, cwd);
    return command.kind === "check"
      ? await runCheck(command, source, streams)
      : await runRender(command, source, streams, cwd);
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
