import { realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";

export type WorkspaceBoardPath = {
  root: string;
  path: string;
};

const isInside = (root: string, candidate: string) => {
  const child = relative(root, candidate);
  return child === "" || (!child.startsWith("..") && !isAbsolute(child));
};

export const resolveWorkspaceBoardPath = async (
  cwd: string,
  input: string
): Promise<WorkspaceBoardPath> => {
  if (!input.endsWith(".chardesk")) {
    throw new Error("Blackboard paths must use the .chardesk suffix.");
  }
  const root = await realpath(cwd);
  const candidate = resolve(root, input);
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
