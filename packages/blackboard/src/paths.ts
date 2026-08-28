import { realpath, stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";

export type WorkspaceBoardPath = {
  root: string;
  path: string;
};

const isInside = (root: string, candidate: string) => {
  const child = relative(root, candidate);
  return child === "" || (!child.startsWith("..") && !isAbsolute(child));
};

export const isBlackboardManifestPath = (path: string) =>
  basename(path) === "blackboard.yaml";

export const resolveWorkspaceBoardPath = async (
  cwd: string,
  input: string
): Promise<WorkspaceBoardPath> => {
  const root = await realpath(cwd);
  const requested = resolve(root, input);
  let candidate = requested;
  try {
    if ((await stat(requested)).isDirectory()) {
      candidate = resolve(requested, "blackboard.yaml");
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (!candidate.endsWith(".chardesk") && !isBlackboardManifestPath(candidate)) {
    throw new Error(
      "Blackboard paths must be a .chardesk file, blackboard.yaml, or a directory containing blackboard.yaml."
    );
  }
  const parent = await realpath(dirname(candidate));
  const checked = resolve(parent, basename(candidate));
  if (!isInside(root, checked)) {
    throw new Error("Blackboard paths must stay inside the current workspace.");
  }
  return { root, path: candidate };
};

export const resolveReadableBoardPath = async ({
  root,
  path,
}: WorkspaceBoardPath) => {
  const checked = await realpath(path);
  if (!isInside(root, checked)) {
    throw new Error("Blackboard paths must stay inside the current workspace.");
  }
  return checked;
};
