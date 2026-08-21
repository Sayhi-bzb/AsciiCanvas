import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const appDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(appDirectory, "../..");

export default defineConfig({
  base: "/chargraph/",
  resolve: {
    alias: [
      {
        find: /^@chardesk\/chargraph\/mermaid$/,
        replacement: path.join(repositoryRoot, "packages/chargraph/src/mermaid.ts"),
      },
      {
        find: /^@chardesk\/chargraph$/,
        replacement: path.join(repositoryRoot, "packages/chargraph/src/index.ts"),
      },
      {
        find: /^@chardesk\/protocol$/,
        replacement: path.join(repositoryRoot, "packages/protocol/src/index.ts"),
      },
    ],
  },
});
