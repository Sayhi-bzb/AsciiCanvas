import { access, cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
const docsBuild = path.join(repositoryRoot, "apps/docs/build/client");
const docsPages = path.join(docsBuild, "docs");
const docsAssets = path.join(docsBuild, "assets");
const docsOutput = path.join(repositoryRoot, "dist/docs");
const appAssets = path.join(repositoryRoot, "dist/assets");

await access(path.join(docsPages, "index.html"));
await access(docsAssets);
await rm(docsOutput, { recursive: true, force: true });
await mkdir(docsOutput, { recursive: true });
await mkdir(appAssets, { recursive: true });
await cp(docsPages, docsOutput, { recursive: true });
await cp(docsAssets, appAssets, { recursive: true });
await cp(path.join(docsBuild, "index.html"), path.join(docsOutput, "404.html"));
