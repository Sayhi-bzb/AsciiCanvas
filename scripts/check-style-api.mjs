import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC_DIR = join(ROOT, "src");
const TARGET_EXTENSIONS = new Set([".ts", ".tsx"]);

const checks = [
  {
    name: "No local cva() usage in src/",
    pattern: /\bcva\s*\(/g,
    allow: [],
  },
  {
    name: "No legacy <Button variant=...> usage",
    pattern: /<Button(?=[\s>])[\s\S]{0,400}?\bvariant\s*=/g,
    allow: [],
  },
  {
    name: "No legacy buttonVariants({ variant: ... }) usage",
    pattern: /buttonVariants\s*\(\s*\{[\s\S]{0,200}?\bvariant\s*:/g,
    allow: [],
  },
  {
    name: "No legacy icon Button sizes",
    pattern: /<Button(?=[\s>])[\s\S]{0,400}?\bsize\s*=\s*"(icon|icon-sm|icon-lg)"/g,
    allow: [],
  },
];

const importPattern =
  /\b(?:import|export)\b(?:[\s\S]*?\bfrom\s*)?["']([^"']+)["']/g;

const boundaryChecks = [
  {
    name: "shared must not import domains",
    file: /^src\/shared\//,
    forbiddenImport: /^@\/domains\//,
  },
  {
    name: "domain code must not import legacy feature/store/component paths",
    file: /^src\/domains\//,
    forbiddenImport: /^@\/(?:features|store|components|lib|utils|services|types|styles)(?:\/|$)/,
  },
  {
    name: "domain state must not import UI components",
    file: /^src\/domains\/[^/]+\/(?:state|model|logic)\//,
    forbiddenImport: /^@\/(?:domains\/[^/]+\/components|shared\/ui)\//,
  },
];

const walk = (dir) => {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    if (TARGET_EXTENSIONS.has(fullPath.slice(fullPath.lastIndexOf(".")))) {
      files.push(fullPath);
    }
  }
  return files;
};

const lineFromIndex = (content, index) => {
  return content.slice(0, index).split("\n").length;
};

const isAllowedPath = (filePath, allowList) => {
  const rel = relative(ROOT, filePath).replace(/\\/g, "/");
  return allowList.some((allow) => rel.startsWith(allow));
};

const violations = [];
const files = walk(SRC_DIR);

for (const filePath of files) {
  const content = readFileSync(filePath, "utf8");
  const relFile = relative(ROOT, filePath).replace(/\\/g, "/");
  for (const check of checks) {
    if (isAllowedPath(filePath, check.allow)) continue;

    for (const match of content.matchAll(check.pattern)) {
      violations.push({
        check: check.name,
        file: relative(ROOT, filePath).replace(/\\/g, "/"),
        line: lineFromIndex(content, match.index ?? 0),
      });
    }
  }

  for (const check of boundaryChecks) {
    if (!check.file.test(relFile)) continue;

    for (const match of content.matchAll(importPattern)) {
      const specifier = match[1];
      if (!check.forbiddenImport.test(specifier)) continue;

      violations.push({
        check: check.name,
        file: relFile,
        line: lineFromIndex(content, match.index ?? 0),
      });
    }
  }
}

if (violations.length > 0) {
  console.error("Style API guard failed:\n");
  for (const violation of violations) {
    console.error(
      `- ${violation.check}\n  at ${violation.file}:${violation.line}`
    );
  }
  process.exit(1);
}

console.log("Style API guard passed.");
