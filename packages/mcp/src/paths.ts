import { realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";

const isInside = (root: string, path: string) => {
  const child = relative(root, path);
  return child === "" || (!child.startsWith("..") && !isAbsolute(child));
};

export const resolveWorkspacePath = async (
  cwd: string,
  input: string,
  options: { output?: boolean } = {}
) => {
  const root = await realpath(cwd);
  const candidate = resolve(root, input);
  const checked = options.output
    ? resolve(await realpath(dirname(candidate)), basename(candidate))
    : await realpath(candidate);
  if (!isInside(root, checked)) {
    throw new Error("Canvas paths must stay inside the current workspace.");
  }
  return candidate;
};
