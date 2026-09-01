import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { CharDeskCliCommandError } from "./input.js";

const manifest = (title: string) => `chardesk: blackboard/v1
title: ${JSON.stringify(title)}
panels:
  main:
    source: main.panel
layout:
  areas:
    - [main]
  gap:
    column: 2
    row: 1
`;

export const initializeCharDeskWorkspace = async ({
  cwd,
  directory,
  title,
}: {
  cwd: string;
  directory: string;
  title?: string;
}) => {
  const root = resolve(cwd, directory);
  try {
    const existing = await stat(root);
    if (!existing.isDirectory() || (await readdir(root)).length > 0) {
      throw new CharDeskCliCommandError(
        "init-conflict",
        `Refusing to replace non-empty path: ${root}`,
      );
    }
  } catch (error) {
    if (error instanceof CharDeskCliCommandError) throw error;
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await mkdir(root, { recursive: true });
  }
  const workspaceTitle = title?.trim() || basename(root) || "CharDesk";
  await Promise.all([
    writeFile(resolve(root, "blackboard.yaml"), manifest(workspaceTitle), { flag: "wx" }),
    writeFile(resolve(root, "main.panel"), `# ${workspaceTitle}\n`, { flag: "wx" }),
  ]);
  return root;
};
