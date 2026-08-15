import { readFile } from "node:fs/promises";
import { parseCharDeskText } from "@chardesk/protocol";
import { resolveReadableBoardPath, type WorkspaceBoardPath } from "./paths.js";

type BlackboardCheckResult =
  | { accepted: true }
  | {
      accepted: false;
      issue: {
        code: "invalid-utf8" | "terminal-escape" | "protocol-diagnostic";
        message: string;
        offset?: number;
      };
    };

const utf8 = new TextDecoder("utf-8", { fatal: true });

export const checkBlackboardBytes = (bytes: Uint8Array): BlackboardCheckResult => {
  let source: string;
  try {
    source = utf8.decode(bytes);
  } catch {
    return {
      accepted: false,
      issue: { code: "invalid-utf8", message: "Blackboard source must be valid UTF-8." },
    };
  }
  if (source.includes("\u001b")) {
    return {
      accepted: false,
      issue: {
        code: "terminal-escape",
        message: "CharDesk files use visible ESC-less ANSI controls.",
        offset: source.indexOf("\u001b"),
      },
    };
  }
  const parsed = parseCharDeskText(source, { syntax: "ansi" });
  const issue = parsed.diagnostics[0];
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

export const checkBlackboardFile = async (board: WorkspaceBoardPath) =>
  checkBlackboardBytes(await readFile(await resolveReadableBoardPath(board)));
