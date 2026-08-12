import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const SRC_ROOT = path.resolve("src");
const RAW_CANVAS_BINDINGS = new Set([
  "yMainGrid",
  "yStructuredScene",
  "yStructuredComponents",
]);
const FORBIDDEN_PUBLIC_CANVAS_EXPORTS = new Set([
  "applyFreeformSnapshotToYMaps",
  "forceHistorySave",
  "getActiveCanvasDocument",
  "getCanvasDocument",
  "undoManager",
]);

function collect(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return collect(absolute);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [absolute] : [];
  });
}

const violations = [];
for (const absolute of collect(SRC_ROOT)) {
  const sourcePath = path.relative(SRC_ROOT, absolute).replaceAll("\\", "/");
  if (/\.(?:test|spec)\.[tj]sx?$/.test(sourcePath)) continue;
  const sourceText = fs.readFileSync(absolute, "utf8");
  const sourceFile = ts.createSourceFile(
    sourcePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    sourcePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  function report(node, message) {
    const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    violations.push(`${sourcePath}:${location.line + 1}: ${message}`);
  }
  function inspect(node) {
    if (
      sourcePath !== "domains/canvas/state/canvasDocument.ts" &&
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ["set", "delete", "clear"].includes(node.expression.name.text) &&
      ts.isIdentifier(node.expression.expression) &&
      RAW_CANVAS_BINDINGS.has(node.expression.expression.text)
    ) {
      report(node, `raw canvas map mutation via ${node.expression.expression.text}`);
    }
    if (
      sourcePath === "domains/canvas/public.ts" &&
      ts.isExportDeclaration(node) &&
      node.exportClause &&
      ts.isNamedExports(node.exportClause)
    ) {
      for (const element of node.exportClause.elements) {
        if (FORBIDDEN_PUBLIC_CANVAS_EXPORTS.has(element.name.text)) {
          report(element, `low-level canvas export ${element.name.text}`);
        }
      }
    }
    ts.forEachChild(node, inspect);
  }
  inspect(sourceFile);
}

if (violations.length > 0) {
  console.error("State ownership violations:\n" + violations.join("\n"));
  process.exit(1);
}
console.log("Canvas state ownership is valid.");
