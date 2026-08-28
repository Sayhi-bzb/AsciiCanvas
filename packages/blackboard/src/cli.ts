#!/usr/bin/env node
import { checkBlackboardFile } from "./check.js";
import { resolveWorkspaceBoardPath } from "./paths.js";
import { startBlackboardServer } from "./server.js";

const usage = () => {
  console.error(
    "Usage:\n" +
      "  chardesk-blackboard serve [board.chardesk|blackboard.yaml|directory] [--port 7331]\n" +
      "  chardesk-blackboard check <board.chardesk|blackboard.yaml|directory>"
  );
  process.exitCode = 2;
};

const fail = (error: unknown) => {
  console.error(JSON.stringify({
    status: "error",
    message: error instanceof Error ? error.message : "Blackboard command failed.",
  }));
  process.exitCode = 1;
};

const parseServe = (args: string[]) => {
  let board = "blackboard.chardesk";
  let boardSet = false;
  let port = 7331;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]!;
    if (value === "--port") {
      const raw = args[index + 1];
      const parsed = Number(raw);
      if (!raw || !Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
        throw new Error("--port must be an integer from 1 through 65535.");
      }
      port = parsed;
      index += 1;
    } else if (!boardSet) {
      board = value;
      boardSet = true;
    } else {
      throw new Error(`Unexpected argument: ${value}`);
    }
  }
  return { board, port };
};

const [, , command, ...args] = process.argv;

try {
  if (command === "serve") {
    const parsed = parseServe(args);
    const board = await resolveWorkspaceBoardPath(process.cwd(), parsed.board);
    const running = await startBlackboardServer({ board, port: parsed.port });
    console.log(`Blackboard: ${board.path}\n${running.url}/blackboard`);
    const close = () => void running.close().finally(() => process.exit(0));
    process.once("SIGINT", close);
    process.once("SIGTERM", close);
  } else if (command === "check" && args.length === 1) {
    const board = await resolveWorkspaceBoardPath(process.cwd(), args[0]!);
    const result = await checkBlackboardFile(board);
    if (result.accepted) {
      console.log(JSON.stringify({
        status: "accepted",
        ...(result.warnings ? { warnings: result.warnings } : {}),
      }));
    } else {
      console.log(JSON.stringify({ status: "rejected", issue: result.issue }));
      process.exitCode = 1;
    }
  } else {
    usage();
  }
} catch (error) {
  fail(error);
}
