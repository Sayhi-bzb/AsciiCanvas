import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

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
  {
    name: "No legacy uiClass style API",
    pattern: /\buiClass\b/g,
    allow: [],
  },
  {
    name: "No legacy shared style components import",
    pattern: /["']@\/shared\/styles\/components["']/g,
    allow: [],
  },
  {
    name: "No raw viewport overlay tiers",
    pattern: /\bz-(?:40|50|\[100\])\b/g,
    allow: [],
  },
  {
    name: "No component-local dark theme branches",
    pattern: /\bdark:/g,
    productionOnly: true,
    allow: [],
  },
  {
    name: "No raw Tailwind palette colors",
    pattern:
      /\b(?:bg|text|border|ring|fill|stroke)-(?:black|white|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)(?:-|\/|\b)/g,
    productionOnly: true,
    allow: [],
  },
  {
    name: "No space-x/space-y layout utilities",
    pattern: /\bspace-[xy]-/g,
    productionOnly: true,
    allow: [],
  },
  {
    name: "Widgets must compose semantic surfaces through Surface",
    pattern:
      /\b(?:bg-(?:host|overlay|dialog)-surface|shadow-(?:host|overlay|dialog)|rx\.surface)\b/g,
    file: /^src\/widgets\/.*\.tsx$/,
    productionOnly: true,
    allow: [],
  },
  {
    name: "Widgets must consume shared primitives instead of rx recipes",
    pattern: /["']@\/shared\/styles\/recipes["']/g,
    file: /^src\/widgets\/.*\.tsx$/,
    productionOnly: true,
    allow: [],
  },
  {
    name: "No retired surface and item recipes",
    pattern:
      /\brx\.(?:floatingHost|overlayPanel|hostSurface|hostContainer|toolbarShell|iconRail|iconRailItem|hostControl|hostIconControl|hostControlActive|dialogClose|quietInput|searchInput|thumbnailSurface|panelLabel|item)\b/g,
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

const behaviorOwnedComponents = new Set([
  "Button",
  "IconButton",
  "SelectableItem",
  "SwatchButton",
  "TabsTrigger",
  "ToggleGroupItem",
  "DropdownMenuItem",
  "DropdownMenuRadioItem",
  "DropdownMenuSubTrigger",
  "ContextMenuItem",
  "ContextMenuSubTrigger",
  "SelectItem",
  "SelectTrigger",
]);

const forbiddenBehaviorClass =
  /\b(?:bg-(?!transparent\b)|hover:(?:bg|text|ring|border|shadow|opacity)-|focus(?:-visible)?:(?:bg|text|ring|border|shadow)-|rounded-(?:none|xs|sm|md|lg|xl|full|control|item|surface|\[)|ring-(?:[0-9]|primary|ring)|shadow-(?:none|xs|sm|md|lg|xl)|transition-all|disabled:opacity-|data-\[(?:state|active|pressed|open|selected)[^\]]*\]:(?:bg|text|ring|border|shadow|opacity)-)/;

const forbiddenSquareGeometryClass =
  /\b(?:(?:size|h|w)-(?:\d|full|\[)|p[xy]?-(?:\d|\[))/;
const forbiddenDirectIconClass = /\b(?:size-|m[lr]-)/;

const getJsxTagName = (node, sourceFile) => node.tagName.getText(sourceFile);

const getJsxAttribute = (node, name) =>
  node.attributes.properties.find(
    (attribute) =>
      ts.isJsxAttribute(attribute) && attribute.name.getText() === name
  );

const getLiteralAttributeValue = (node, name) => {
  const attribute = getJsxAttribute(node, name);
  return attribute?.initializer && ts.isStringLiteral(attribute.initializer)
    ? attribute.initializer.text
    : undefined;
};

const checkDirectIconSizing = (element, sourceFile, relFile, parentTagName) => {
  if (parentTagName === "SwatchButton") return;
  const visitChild = (child) => {
    if (ts.isJsxElement(child)) return;
    if (ts.isJsxSelfClosingElement(child)) {
      const childTagName = getJsxTagName(child, sourceFile);
      if (!/^[A-Z]|\./.test(childTagName)) return;
      if (childTagName === "ColorSwatch") return;
      const className = getJsxAttribute(child, "className");
      const classText = className?.initializer?.getText(sourceFile) ?? "";
      if (!forbiddenDirectIconClass.test(classText)) return;
      const line = sourceFile.getLineAndCharacterOfPosition(child.getStart()).line + 1;
      violations.push({
        check: "Behavior primitives own direct icon size and spacing",
        file: relFile,
        line,
      });
      return;
    }
    ts.forEachChild(child, visitChild);
  };

  element.children.forEach(visitChild);
};

const hasPresentationEscape = (node) => {
  const attribute = getJsxAttribute(node, "data-visual-contract");
  return Boolean(
    attribute &&
      attribute.initializer &&
      ts.isStringLiteral(attribute.initializer) &&
      attribute.initializer.text === "presentation"
  );
};

const checkWidgetBehaviorOwnership = (content, relFile) => {
  if (!/^src\/widgets\/.*\.tsx$/.test(relFile)) return;
  if (/\.(?:test|spec)\.tsx$/.test(relFile)) return;

  const sourceFile = ts.createSourceFile(
    relFile,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = getJsxTagName(node, sourceFile);
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

      if (tagName === "button") {
        violations.push({
          check: "Widgets must use shared interactive primitives instead of raw buttons",
          file: relFile,
          line,
        });
      }

      if (behaviorOwnedComponents.has(tagName)) {
        const className = getJsxAttribute(node, "className");
        const classText = className?.initializer?.getText(sourceFile) ?? "";
        const presentationEscape = hasPresentationEscape(node);

        if (presentationEscape && relFile !== "src/widgets/toolbar/slide-playback.tsx") {
          violations.push({
            check: "Presentation visual override is confined to slide playback",
            file: relFile,
            line,
          });
        } else if (!presentationEscape && forbiddenBehaviorClass.test(classText)) {
          violations.push({
            check: "Widget className must not override shared interaction behavior",
            file: relFile,
            line,
          });
        }

        const squareControl =
          tagName === "IconButton" ||
          (tagName === "Button" && getLiteralAttributeValue(node, "shape") === "square");
        if (
          !presentationEscape &&
          squareControl &&
          forbiddenSquareGeometryClass.test(classText)
        ) {
          violations.push({
            check: "Square controls own their fixed geometry",
            file: relFile,
            line,
          });
        }

        if (ts.isJsxElement(node.parent) && node.parent.openingElement === node) {
          checkDirectIconSizing(node.parent, sourceFile, relFile, tagName);
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
};

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
    if (check.file && !check.file.test(relFile)) continue;
    if (check.productionOnly && /\.(?:test|spec)\.[^.]+$/.test(relFile)) continue;
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

  checkWidgetBehaviorOwnership(content, relFile);
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
