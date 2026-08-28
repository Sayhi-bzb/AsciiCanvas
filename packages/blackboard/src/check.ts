import { readFile } from "node:fs/promises";
import {
  CharDeskTextCompileError,
  compileCharDeskText,
} from "@chardesk/chargraph";
import {
  isBlackboardManifestPath,
  resolveReadableBoardPath,
  type WorkspaceBoardPath,
} from "./paths.js";
import { resolveBlackboardSource } from "./document.js";
import { BlackboardPackageError, compileBlackboardPackage } from "./package.js";

type BlackboardCheckResult =
  | { accepted: true; warnings?: string[] }
  | {
      accepted: false;
      issue: {
        code:
          | "invalid-utf8"
          | "unsupported-document-mode"
          | "terminal-escape"
          | "protocol-diagnostic"
          | "invalid-manifest"
          | "invalid-panel-path"
          | "missing-panel"
          | "invalid-panel";
        message: string;
        offset?: number;
      };
    };

const utf8 = new TextDecoder("utf-8", { fatal: true });

export const checkBlackboardBytes = async (
  bytes: Uint8Array
): Promise<BlackboardCheckResult> => {
  let source: string;
  try {
    source = utf8.decode(bytes);
  } catch {
    return {
      accepted: false,
      issue: { code: "invalid-utf8", message: "Blackboard source must be valid UTF-8." },
    };
  }
  try {
    source = resolveBlackboardSource(source);
  } catch (error) {
    return {
      accepted: false,
      issue: {
        code: "unsupported-document-mode",
        message: error instanceof Error ? error.message : "Unsupported CharDesk document mode.",
      },
    };
  }
  let compiled;
  try {
    compiled = await compileCharDeskText(source, { sourceKind: "chardesk" });
  } catch (error) {
    if (!(error instanceof CharDeskTextCompileError)) throw error;
    return {
      accepted: false,
      issue: {
        code: "terminal-escape",
        message: "CharDesk files use visible ESC-less ANSI controls.",
        offset: source.indexOf("\u001b"),
      },
    };
  }
  const issue = compiled.diagnostics[0];
  if (issue) {
    return {
      accepted: false,
      issue: {
        code: "protocol-diagnostic",
        message: issue.message,
        offset: issue.offset,
      },
    };
  }
  return { accepted: true };
};

export const checkBlackboardFile = async (
  board: WorkspaceBoardPath,
): Promise<BlackboardCheckResult> => {
  const readable = await resolveReadableBoardPath(board);
  if (!isBlackboardManifestPath(readable)) {
    return checkBlackboardBytes(await readFile(readable));
  }
  try {
    const compiled = await compileBlackboardPackage(readable);
    return {
      accepted: true,
      ...(compiled.warnings.length === 0
        ? {}
        : { warnings: compiled.warnings.map((warning) => warning.message) }),
    };
  } catch (error) {
    if (!(error instanceof BlackboardPackageError)) throw error;
    return {
      accepted: false,
      issue: { code: error.code, message: error.message },
    };
  }
};
