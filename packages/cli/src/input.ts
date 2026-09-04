import { readFile, realpath, stat } from "node:fs/promises";
import { basename, extname, isAbsolute, join, relative, resolve } from "node:path";
import {
  compileBlackboardPackage,
} from "@chardesk/blackboard/node";
import { parseBlackboardManifest } from "@chardesk/blackboard";
import { parseCharDeskDocumentEnvelope } from "@chardesk/document";
import type { CharDeskCliInputMode } from "./render.js";

export type CharDeskInputModeOption = "auto" | CharDeskCliInputMode | "blackboard";

export type CharDeskInputRequest = {
  input: string;
  inputMode: CharDeskInputModeOption;
  panel?: string;
};

export type ResolvedCharDeskInput = {
  source: string;
  sourceName: string;
  inputMode: CharDeskCliInputMode;
  warnings: string[];
  dependencies: string[];
};

export class CharDeskCliCommandError extends Error {
  constructor(readonly code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CharDeskCliCommandError";
  }
}

export const decodeUtf8 = (bytes: Uint8Array) => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new CharDeskCliCommandError("invalid-utf8", "Input must be valid UTF-8.");
  }
};

const readUtf8Stream = async (
  stream: AsyncIterable<Uint8Array | string>,
) => {
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
  request: CharDeskInputRequest,
): CharDeskCliInputMode => request.inputMode === "auto"
  ? request.input !== "-" && extname(request.input).toLowerCase() === ".chardesk"
    ? "chardesk"
    : "chargraph"
  : request.inputMode === "blackboard" ? "chardesk" : request.inputMode;

const resolveDocumentInput = (
  request: CharDeskInputRequest,
  source: string,
) => {
  const document = parseCharDeskDocumentEnvelope(source);
  if (!document) return { source, inputMode: resolveInputMode(request) };
  if (document.mode !== "freeform") {
    throw new CharDeskCliCommandError(
      "unsupported-document-mode",
      `CharDesk CLI does not render ${document.mode} documents yet.`,
    );
  }
  return { source: document.body, inputMode: "chardesk" as const };
};

export const resolveCharDeskInput = async ({
  request,
  cwd,
  stdin,
}: {
  request: CharDeskInputRequest;
  cwd: string;
  stdin?: AsyncIterable<Uint8Array | string>;
}): Promise<ResolvedCharDeskInput> => {
  if (request.input === "-") {
    if (!stdin) {
      throw new CharDeskCliCommandError(
        "invalid-live-input",
        "This command requires a file or directory path.",
      );
    }
    if (request.inputMode === "blackboard") {
      throw new CharDeskCliCommandError(
        "invalid-blackboard-input",
        "Blackboard input requires a file or directory path.",
      );
    }
    return {
      ...resolveDocumentInput(request, await readUtf8Stream(stdin)),
      sourceName: "stdin",
      warnings: [],
      dependencies: [],
    };
  }

  const requested = resolve(cwd, request.input);
  let directory = false;
  try {
    directory = (await stat(requested)).isDirectory();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const blackboard = request.inputMode === "blackboard"
    || (request.inputMode === "auto" && (directory || basename(requested) === "blackboard.yaml"));
  if (blackboard) {
    const manifest = directory ? join(requested, "blackboard.yaml") : requested;
    if (basename(manifest) !== "blackboard.yaml") {
      throw new CharDeskCliCommandError(
        "invalid-blackboard-input",
        "Blackboard input must be blackboard.yaml or a directory containing it.",
      );
    }
    if (request.panel) {
      const manifestSource = decodeUtf8(await readFile(manifest));
      const definition = parseBlackboardManifest(manifestSource).manifest.panels[request.panel];
      if (!definition) {
        throw new CharDeskCliCommandError(
          "unknown-panel",
          `Blackboard panel does not exist: ${request.panel}`,
        );
      }
      const root = await realpath(resolve(manifest, ".."));
      const panelPath = await realpath(resolve(root, definition.source));
      const child = relative(root, panelPath);
      if (child.startsWith("..") || isAbsolute(child) || child === "") {
        throw new CharDeskCliCommandError("invalid-panel-path", "Panel path escapes the Blackboard package.");
      }
      return {
        source: decodeUtf8(await readFile(panelPath)),
        sourceName: `${request.panel}.panel`,
        inputMode: "chargraph",
        warnings: [],
        dependencies: [manifest, panelPath],
      };
    }
    const compiled = await compileBlackboardPackage(manifest);
    if (compiled.mode === "slide") {
      throw new CharDeskCliCommandError(
        "unsupported-document-mode",
        "CharDesk CLI opens Slide packages as decks; inspect one panel with --panel.",
      );
    }
    return {
      source: compiled.source,
      sourceName: `${compiled.title || basename(resolve(manifest, ".."))}.chardesk`,
      inputMode: "chardesk",
      warnings: compiled.warnings.map((item) => item.message),
      dependencies: compiled.dependencies,
    };
  }

  const source = decodeUtf8(await readFile(requested));
  return {
    ...resolveDocumentInput(request, source),
    sourceName: basename(requested),
    warnings: [],
    dependencies: [requested],
  };
};
