import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
const siteOutput = path.join(repositoryRoot, "dist/chargraph");
const html = await readFile(path.join(siteOutput, "index.html"), "utf8");

if (!html.includes("https://chardesk.com/chargraph/")) {
  throw new Error("CharGraph build is missing its canonical URL.");
}
if (!html.includes("/chargraph/assets/")) {
  throw new Error("CharGraph build assets are not scoped to /chargraph/.");
}

const assetNames = await readdir(path.join(siteOutput, "assets"));
const scriptNames = assetNames.filter((name) => name.endsWith(".js"));
if (scriptNames.length === 0) {
  throw new Error("CharGraph build emitted no JavaScript entry.");
}
if (!scriptNames.some((name) => name.startsWith("elk-worker-"))) {
  throw new Error("CharGraph build emitted no ELK worker asset.");
}

const scripts = await Promise.all(
  scriptNames.map((name) => readFile(path.join(siteOutput, "assets", name), "utf8"))
);
const bundledSource = scripts.join("\n");
for (const expected of [
  "同一份结构，两种阅读方式",
  "flowchart LR",
  "sequenceDiagram",
  "xychart-beta",
  "刷新会话",
  "/fonts/fonts.css",
]) {
  if (!bundledSource.includes(expected)) {
    throw new Error(`CharGraph build is missing showcase content: ${expected}`);
  }
}

await access(path.join(siteOutput, "assets"));
