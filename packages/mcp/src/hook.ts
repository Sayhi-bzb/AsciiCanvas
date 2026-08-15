import { basename, dirname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import {
  publishCanvasFiles,
  seedCanvasFiles,
  sha256,
  writeJsonAtomic,
} from "./authoring.js";

type PostToolUseInput = {
  cwd?: unknown;
  tool_name?: unknown;
  tool_input?: unknown;
};

const PATCH_PATH = /^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm;
const MOVE_PATH = /^\*\*\* Move to: (.+)$/gm;

const patchPaths = (input: unknown) => {
  if (!input || typeof input !== "object") return [];
  const command = (input as { command?: unknown }).command;
  if (typeof command !== "string") return [];
  return [...command.matchAll(PATCH_PATH), ...command.matchAll(MOVE_PATH)]
    .map((match) => match[1]?.trim())
    .filter((path): path is string => Boolean(path));
};

type WorkChange = { directory: string; plain: boolean; styled: boolean };

const collectWorkChanges = (cwd: string, paths: string[]) => {
  const changes = new Map<string, WorkChange>();
  for (const path of paths) {
    const absolute = normalize(resolve(cwd, path));
    const fromRoot = relative(cwd, absolute);
    if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) continue;
    const name = basename(absolute);
    const directory = dirname(absolute);
    if (name !== "plain.txt" && name !== "styled.ans") continue;
    const parts = normalize(directory).split(sep);
    const workIndex = parts.lastIndexOf("work");
    if (workIndex < 1 || parts[workIndex - 1] !== ".chardesk") continue;
    const artifact = parts[workIndex + 1];
    if (!artifact || workIndex + 2 !== parts.length) continue;
    const current = changes.get(directory) ?? { directory, plain: false, styled: false };
    if (name === "plain.txt") current.plain = true;
    if (name === "styled.ans") current.styled = true;
    changes.set(directory, current);
  }
  return [...changes.values()];
};

const hookOutput = (message: string) => ({
  continue: true,
  suppressOutput: true,
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: message,
  },
});

const runForArtifact = async (cwd: string, change: WorkChange) => {
  const plainPath = join(change.directory, "plain.txt");
  const styledPath = join(change.directory, "styled.ans");
  const statePath = join(change.directory, "state.json");
  const artifact = basename(change.directory);
  const outputPath = join(cwd, `${artifact}.chardesk`);
  let publishedDefault = false;

  if (change.plain) {
    const seeded = await seedCanvasFiles(plainPath, styledPath);
    if (!change.styled) {
      if (seeded.status === "created") {
        publishedDefault = true;
      } else {
        await writeJsonAtomic(statePath, {
          version: 1,
          status: "stale",
          plain_sha256: sha256(seeded.canonicalPlainText),
        });
        return "Plain changed; styled.ans is stale and must be reconciled.";
      }
    }
  }

  if (!change.styled && !publishedDefault) return undefined;
  const published = await publishCanvasFiles(plainPath, styledPath, outputPath);
  if (!published.accepted) {
    await writeJsonAtomic(statePath, {
      version: 1,
      status: "rejected",
      code: published.code,
    });
    const issue = published.mismatch;
    return [
      `CharDesk rejected: ${published.code}.`,
      published.message,
      issue?.expected ? `Expected cell: ${JSON.stringify(issue.expected)}` : undefined,
      issue?.actual ? `Actual cell: ${JSON.stringify(issue.actual)}` : undefined,
    ].filter(Boolean).join("\n");
  }
  await writeJsonAtomic(statePath, {
    version: 1,
    status: "accepted",
    plain_sha256: published.plainHash,
    styled_sha256: published.styledHash,
    output: `${artifact}.chardesk`,
  });
  return publishedDefault
    ? "Prepared styled.ans; published default canvas."
    : "Accepted.";
};

export const handlePostToolUse = async (payload: PostToolUseInput) => {
  if (payload.tool_name !== "apply_patch" || typeof payload.cwd !== "string") return undefined;
  const changes = collectWorkChanges(payload.cwd, patchPaths(payload.tool_input));
  if (changes.length === 0) return undefined;
  const messages: string[] = [];
  for (const change of changes) {
    try {
      const message = await runForArtifact(payload.cwd, change);
      if (message) messages.push(message);
    } catch (error) {
      messages.push(`CharDesk rejected: ${error instanceof Error ? error.message : "validation failed"}`);
    }
  }
  return hookOutput(messages.join("\n"));
};
