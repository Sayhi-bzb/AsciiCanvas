#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { createCharDeskGeometrySnapshot } from "@chardesk/protocol";
import {
  publishCanvasFiles,
  seedCanvasFiles,
  validateStyledCanvas,
} from "./authoring.js";
import { handlePostToolUse } from "./hook.js";
import { evaluateCanvasRun, type CanvasEvalCase } from "./evaluator.js";
import { resolveWorkspacePath } from "./paths.js";

const usage = () => {
  console.error(
    "Usage:\n" +
      "  chardesk-canvas inspect <plain-file>\n" +
      "  chardesk-canvas validate <plain-file> <styled-file>\n" +
      "  chardesk-canvas seed <plain-file> <styled-file>\n" +
      "  chardesk-canvas publish <plain-file> <styled-file> <output.chardesk>\n" +
      "  chardesk-canvas evaluate <case.json> <run-directory>\n" +
      "  chardesk-canvas hook"
  );
  process.exitCode = 2;
};

const readUtf8 = (path: string) => readFile(path, "utf8");
const print = (value: unknown) => console.log(JSON.stringify(value));
const [, , command, ...paths] = process.argv;

if (command === "inspect" && paths.length === 1) {
  const plainPath = await resolveWorkspacePath(process.cwd(), paths[0]!);
  const snapshot = createCharDeskGeometrySnapshot(await readUtf8(plainPath), { syntax: "plain" });
  print({ width: snapshot.width, height: snapshot.height });
} else if (command === "validate" && paths.length === 2) {
  const [plainPath, styledPath] = await Promise.all(
    paths.map((path) => resolveWorkspacePath(process.cwd(), path))
  );
  const [plainText, ansiText] = await Promise.all([readUtf8(plainPath!), readUtf8(styledPath!)]);
  const validation = validateStyledCanvas(plainText, ansiText);
  print(validation.accepted ? { status: "accepted" } : validation);
  if (!validation.accepted) process.exitCode = 1;
} else if (command === "seed" && paths.length === 2) {
  const plainPath = await resolveWorkspacePath(process.cwd(), paths[0]!);
  const styledPath = await resolveWorkspacePath(process.cwd(), paths[1]!, { output: true });
  const seeded = await seedCanvasFiles(plainPath, styledPath);
  print({ status: seeded.status });
} else if (command === "publish" && paths.length === 3) {
  if (!paths[2]!.endsWith(".chardesk")) throw new Error("Output must use the .chardesk suffix.");
  const [plainPath, styledPath] = await Promise.all([
    resolveWorkspacePath(process.cwd(), paths[0]!),
    resolveWorkspacePath(process.cwd(), paths[1]!),
  ]);
  const outputPath = await resolveWorkspacePath(process.cwd(), paths[2]!, { output: true });
  const published = await publishCanvasFiles(plainPath, styledPath, outputPath);
  print(published.accepted ? { status: "accepted" } : published);
  if (!published.accepted) process.exitCode = 1;
} else if (command === "evaluate" && paths.length === 2) {
  const [casePath, runPath] = await Promise.all(
    paths.map((path) => resolveWorkspacePath(process.cwd(), path))
  );
  const testCase = JSON.parse(await readUtf8(casePath!)) as CanvasEvalCase;
  print(await evaluateCanvasRun(testCase, runPath!));
} else if (command === "hook" && paths.length === 0) {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  const output = await handlePostToolUse(JSON.parse(raw) as object);
  if (output) print(output);
} else {
  usage();
}
