import {
  layoutCharDeskTextRuns,
  type CharDeskTextAttributes,
  type CharDeskTextStyle,
} from "@chardesk/protocol";
import type { Node, Root } from "mdast";
import type { BundledLanguage } from "shiki";
import { renderMermaidUnicode } from "./mermaid";
import type {
  MarkdownColorSlotId,
  MarkdownRenderRuleId,
  MarkdownRenderRule,
  MarkdownRenderColors,
  MarkdownRenderRules,
  TextRenderTheme,
  TextRenderThemeTokenId,
  TextRenderDiagnostic,
  TextRenderFragment,
} from "./types";

type LocatedNode = Node & {
  value?: string;
  url?: string;
  identifier?: string;
  depth?: number;
  ordered?: boolean;
  start?: number | null;
  spread?: boolean;
  checked?: boolean | null;
  lang?: string | null;
  align?: Array<"left" | "right" | "center" | null>;
  children?: LocatedNode[];
  position?: {
    start: { offset?: number };
    end: { offset?: number };
  };
};

type RunState = CharDeskTextStyle & { href?: string };
type StyledLine = TextRenderFragment[];
type DefinitionMap = Map<string, string>;

type RenderEnvironment = {
  source: string;
  rules: MarkdownRenderRules;
  colors: MarkdownRenderColors;
  theme: TextRenderTheme;
  definitions: DefinitionMap;
  diagnostics: TextRenderDiagnostic[];
  recognized: boolean;
  customRuleByNodeType: ReadonlyMap<string, MarkdownRenderRule>;
};

const sameAttrs = (left?: CharDeskTextAttributes, right?: CharDeskTextAttributes) =>
  left?.bold === right?.bold &&
  left?.italic === right?.italic &&
  left?.strike === right?.strike &&
  left?.underline === right?.underline &&
  left?.inverse === right?.inverse;

const pushRun = (
  runs: StyledLine,
  text: string,
  state: RunState = {},
  origin?: { from: number; to: number }
) => {
  if (!text) return;
  const previous = runs.at(-1);
  if (
    previous &&
    previous.color === state.color &&
    previous.bgColor === state.bgColor &&
    previous.href === state.href &&
    sameAttrs(previous.attrs, state.attrs) &&
    ((!previous.origin && !origin) || previous.origin?.to === origin?.from)
  ) {
    previous.text += text;
    if (previous.origin && origin) previous.origin.to = origin.to;
    return;
  }
  runs.push({
    text,
    ...(state.color ? { color: state.color } : {}),
    ...(state.bgColor ? { bgColor: state.bgColor } : {}),
    ...(state.attrs ? { attrs: { ...state.attrs } } : {}),
    ...(state.href ? { href: state.href } : {}),
    ...(origin ? { origin: { ...origin } } : {}),
  });
};

const mergeState = (base: RunState, decoration: RunState): RunState => ({
  ...(decoration.color ?? base.color
    ? { color: decoration.color ?? base.color }
    : {}),
  ...(decoration.bgColor ?? base.bgColor
    ? { bgColor: decoration.bgColor ?? base.bgColor }
    : {}),
  ...(base.attrs || decoration.attrs
    ? { attrs: { ...(base.attrs ?? {}), ...(decoration.attrs ?? {}) } }
    : {}),
  ...(decoration.href ?? base.href ? { href: decoration.href ?? base.href } : {}),
});

const overrideLineStyle = (line: StyledLine, state: RunState): StyledLine => {
  const styled: StyledLine = [];
  line.forEach((run) =>
    pushRun(styled, run.text, mergeState(run, state), run.origin)
  );
  return styled;
};

const nodeRange = (node: LocatedNode) => {
  const from = node.position?.start.offset;
  const to = node.position?.end.offset;
  return from === undefined || to === undefined ? undefined : { from, to };
};

const nodeSource = (environment: RenderEnvironment, node: LocatedNode) => {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return start === undefined || end === undefined
    ? (node.value ?? "")
    : environment.source.slice(start, end);
};

const linesFromRuns = (runs: StyledLine): StyledLine[] => {
  const lines: StyledLine[] = [[]];
  for (const run of runs) {
    const parts = run.text.split(/\r\n?|\n/);
    let consumed = 0;
    parts.forEach((part, index) => {
      if (index > 0) lines.push([]);
      const origin = run.origin && part.length > 0
        ? {
            from: run.origin.from + consumed,
            to: run.origin.from + consumed + part.length,
          }
        : undefined;
      pushRun(lines.at(-1)!, part, run, origin);
      consumed += part.length;
      if (index < parts.length - 1) consumed += 1;
    });
  }
  return lines;
};

const rawLines = (
  environment: RenderEnvironment,
  node: LocatedNode,
  state: RunState
) => {
  const line: StyledLine = [];
  pushRun(line, nodeSource(environment, node), state, nodeRange(node));
  return linesFromRuns(line);
};

const markRecognized = (environment: RenderEnvironment) => {
  environment.recognized = true;
};

const ruleColor = (environment: RenderEnvironment, id: MarkdownColorSlotId) =>
  environment.colors[id];

const themedColor = (
  environment: RenderEnvironment,
  id: MarkdownColorSlotId,
  token: TextRenderThemeTokenId
) => ruleColor(environment, id) ?? environment.theme[token];

const FOREGROUND_SLOT_BY_RULE = {
  strong: "strong.foreground",
  emphasis: "emphasis.foreground",
  strikethrough: "strikethrough.foreground",
  link: "link.foreground",
  "inline-code": "inline-code.foreground",
  "thematic-break": "thematic-break.foreground",
  mermaid: "mermaid.foreground",
} as const satisfies Partial<Record<MarkdownRenderRuleId, MarkdownColorSlotId>>;

const withRuleColor = (
  environment: RenderEnvironment,
  id: MarkdownRenderRuleId,
  decoration: RunState
): RunState => {
  const slot = FOREGROUND_SLOT_BY_RULE[id as keyof typeof FOREGROUND_SLOT_BY_RULE];
  const color = slot ? ruleColor(environment, slot) : undefined;
  return color ? { ...decoration, color } : decoration;
};

const inlineRuleState = (
  environment: RenderEnvironment,
  id: MarkdownRenderRuleId,
  state: RunState,
  decoration: RunState
) => {
  markRecognized(environment);
  return environment.rules[id]
    ? mergeState(
        state,
        withRuleColor(environment, id, decoration)
      )
    : state;
};

const renderInlineNodes = (
  nodes: readonly LocatedNode[],
  environment: RenderEnvironment,
  state: RunState
): StyledLine => {
  const runs: StyledLine = [];
  const render = (node: LocatedNode, current: RunState) => {
    const customRule = environment.customRuleByNodeType.get(node.type);
    if (customRule && !["strong", "emphasis", "delete", "link"].includes(node.type)) {
      markRecognized(environment);
      const decoration = customRule.decorate(node);
      const next = environment.rules[customRule.id]
        ? mergeState(
            current,
            withRuleColor(environment, customRule.id, decoration)
          )
        : current;
      node.children?.forEach((child) => render(child, next));
      return;
    }
    switch (node.type) {
      case "text":
        pushRun(runs, node.value ?? "", current, nodeRange(node));
        return;
      case "strong":
        node.children?.forEach((child) =>
          render(
            child,
            inlineRuleState(environment, "strong", current, { attrs: { bold: true } })
          )
        );
        return;
      case "emphasis":
        node.children?.forEach((child) =>
          render(
            child,
            inlineRuleState(environment, "emphasis", current, {
              attrs: { italic: true },
            })
          )
        );
        return;
      case "delete":
        node.children?.forEach((child) =>
          render(
            child,
            inlineRuleState(environment, "strikethrough", current, {
              attrs: { strike: true },
            })
          )
        );
        return;
      case "inlineCode": {
        const next = inlineRuleState(environment, "inline-code", current, {
          color: themedColor(environment, "inline-code.foreground", "info"),
          bgColor: themedColor(environment, "inline-code.background", "surface"),
        });
        const value = node.value ?? "";
        const range = nodeRange(node);
        const raw = range ? environment.source.slice(range.from, range.to) : "";
        const valueOffset = raw.indexOf(value);
        const origin = range && valueOffset >= 0
          ? {
              from: range.from + valueOffset,
              to: range.from + valueOffset + value.length,
            }
          : undefined;
        pushRun(runs, value, next, origin);
        return;
      }
      case "link": {
        const next = inlineRuleState(environment, "link", current, {
          color: themedColor(environment, "link.foreground", "info"),
          attrs: { underline: true },
          ...(node.url ? { href: node.url } : {}),
        });
        node.children?.forEach((child) => render(child, next));
        return;
      }
      case "linkReference": {
        const url = environment.definitions.get(node.identifier?.toLowerCase() ?? "");
        const next = inlineRuleState(environment, "link", current, {
          color: themedColor(environment, "link.foreground", "info"),
          attrs: { underline: true },
          ...(url ? { href: url } : {}),
        });
        node.children?.forEach((child) => render(child, next));
        return;
      }
      case "break":
        pushRun(runs, "\n", current);
        return;
      case "html":
        pushRun(runs, node.value ?? "", current, nodeRange(node));
        return;
      default:
        if (node.children?.length) {
          node.children.forEach((child) => render(child, current));
        } else {
          pushRun(runs, nodeSource(environment, node), current, nodeRange(node));
        }
    }
  };
  nodes.forEach((node) => render(node, state));
  return runs;
};

const measureLine = (line: StyledLine) => layoutCharDeskTextRuns(line).width;

const padLine = (
  line: StyledLine,
  width: number,
  alignment: "left" | "right" | "center" | null | undefined
) => {
  const remaining = Math.max(0, width - measureLine(line));
  const left = alignment === "right"
    ? remaining
    : alignment === "center"
      ? Math.floor(remaining / 2)
      : 0;
  const right = remaining - left;
  const padded: StyledLine = [];
  pushRun(padded, " ".repeat(left + 1));
  line.forEach((run) => pushRun(padded, run.text, run, run.origin));
  pushRun(padded, " ".repeat(right + 1));
  return padded;
};

const renderTable = async (
  node: LocatedNode,
  environment: RenderEnvironment,
  state: RunState
): Promise<StyledLine[]> => {
  markRecognized(environment);
  if (!environment.rules.table) return rawLines(environment, node, state);
  const rows = node.children ?? [];
  if (rows.length === 0) return [];
  const headerForeground = themedColor(
    environment,
    "table.header.foreground",
    "accent-foreground"
  );
  const headerBackground = themedColor(
    environment,
    "table.header.background",
    "accent"
  );
  const separatorColor = themedColor(environment, "table.separator", "muted");
  const alignments = node.align ?? [];
  const renderedRows = rows.map((row) =>
    (row.children ?? []).map((cell) => {
      return linesFromRuns(renderInlineNodes(cell.children ?? [], environment, state));
    })
  );
  const columnCount = Math.max(alignments.length, ...renderedRows.map((row) => row.length));
  const widths = Array.from({ length: columnCount }, (_, column) =>
    Math.max(
      1,
      ...renderedRows.flatMap((row) =>
        (row[column] ?? [[]]).map((line) => measureLine(line))
      )
    )
  );
  const separator = (char: string) => {
    const line: StyledLine = [];
    widths.forEach((width, index) => {
      if (index > 0) {
        pushRun(line, "  ", { color: separatorColor });
      }
      pushRun(line, char.repeat(width + 2), {
        color: separatorColor,
      });
    });
    return line;
  };
  const output: StyledLine[] = [];
  renderedRows.forEach((row, rowIndex) => {
    const rowHeight = Math.max(1, ...row.map((cell) => cell.length));
    for (let lineIndex = 0; lineIndex < rowHeight; lineIndex++) {
      const line: StyledLine = [];
      widths.forEach((width, column) => {
        if (column > 0) pushRun(line, "  ");
        const padded = padLine(
          row[column]?.[lineIndex] ?? [],
          width,
          alignments[column]
        );
        const cellRuns = rowIndex === 0
          ? overrideLineStyle(padded, {
              color: headerForeground,
              bgColor: headerBackground,
              attrs: { bold: true },
            })
          : padded;
        cellRuns.forEach((run) => pushRun(line, run.text, run, run.origin));
      });
      output.push(line);
    }
    if (rowIndex < renderedRows.length - 1) {
      output.push(separator(rowIndex === 0 ? "━" : "─"));
    }
  });
  return output;
};

const fontStyleAttrs = (fontStyle?: number): CharDeskTextAttributes | undefined => {
  if (!fontStyle || fontStyle < 0) return undefined;
  return {
    ...(fontStyle & 1 ? { italic: true } : {}),
    ...(fontStyle & 2 ? { bold: true } : {}),
    ...(fontStyle & 4 ? { underline: true } : {}),
  };
};

const renderCodeBlock = async (
  node: LocatedNode,
  environment: RenderEnvironment,
  state: RunState
): Promise<StyledLine[]> => {
  markRecognized(environment);
  if (!environment.rules["code-block"]) return rawLines(environment, node, state);
  const code = node.value ?? "";
  const range = nodeRange(node);
  const raw = range ? environment.source.slice(range.from, range.to) : "";
  const relativeCodeStart = raw.indexOf(code);
  const codeStart = range && relativeCodeStart >= 0
    ? range.from + relativeCodeStart
    : undefined;
  const language = node.lang?.split(/[\s,]/, 1)[0];
  if (!language) {
    return linesFromRuns([{
      text: code,
      ...state,
      ...(codeStart !== undefined
        ? { origin: { from: codeStart, to: codeStart + code.length } }
        : {}),
    }]);
  }
  if (language.toLowerCase() === "mermaid") {
    if (!environment.rules.mermaid) {
      return linesFromRuns([{
        text: code,
        ...state,
        ...(codeStart !== undefined
          ? { origin: { from: codeStart, to: codeStart + code.length } }
          : {}),
      }]);
    }
    try {
      const diagram = await renderMermaidUnicode(code);
      const color = ruleColor(environment, "mermaid.foreground");
      return linesFromRuns([{
        text: diagram,
        ...state,
        ...(color ? { color } : {}),
      }]);
    } catch (error) {
      environment.diagnostics.push({
        code: "markdown-mermaid-render-failed",
        message: error instanceof Error
          ? `Could not render Mermaid diagram: ${error.message}`
          : "Could not render Mermaid diagram.",
        ...(node.position?.start.offset !== undefined
          ? { offset: node.position.start.offset }
          : {}),
      });
      return rawLines(environment, node, state);
    }
  }
  try {
    const { codeToTokens } = await import("shiki");
    const highlighted = await codeToTokens(code, {
      lang: language as BundledLanguage,
      theme: "github-light",
    });
    let codeOffset = 0;
    return highlighted.tokens.map((tokens, lineIndex) => {
      const line: StyledLine = [];
      tokens.forEach((token) => {
        const origin = codeStart === undefined
          ? undefined
          : {
              from: codeStart + codeOffset,
              to: codeStart + codeOffset + token.content.length,
            };
        pushRun(line, token.content, mergeState(state, {
          color: token.color ?? highlighted.fg,
          ...(fontStyleAttrs(token.fontStyle)
            ? { attrs: fontStyleAttrs(token.fontStyle) }
            : {}),
        }), origin);
        codeOffset += token.content.length;
      });
      if (lineIndex < highlighted.tokens.length - 1) codeOffset += 1;
      return line;
    });
  } catch (error) {
    environment.diagnostics.push({
      code: "markdown-highlight-failed",
      message: error instanceof Error
        ? `Could not highlight ${language}: ${error.message}`
        : `Could not highlight ${language}.`,
      ...(node.position?.start.offset !== undefined
        ? { offset: node.position.start.offset }
        : {}),
    });
    return linesFromRuns([{
      text: code,
      ...state,
      ...(codeStart !== undefined
        ? { origin: { from: codeStart, to: codeStart + code.length } }
        : {}),
    }]);
  }
};

const blockRuleEnabled = (
  environment: RenderEnvironment,
  id: MarkdownRenderRuleId,
  node: LocatedNode,
  state: RunState
) => {
  markRecognized(environment);
  return environment.rules[id] ? null : rawLines(environment, node, state);
};

const renderBlocks = async (
  nodes: readonly LocatedNode[],
  environment: RenderEnvironment,
  state: RunState,
  separate: boolean | "source" = true
): Promise<StyledLine[]> => {
  const output: StyledLine[] = [];
  let previousNode: LocatedNode | null = null;
  for (const node of nodes) {
    if (node.type === "definition") continue;
    let lines: StyledLine[];
    switch (node.type) {
      case "paragraph":
        lines = linesFromRuns(renderInlineNodes(node.children ?? [], environment, state));
        break;
      case "heading": {
        const raw = blockRuleEnabled(environment, "heading", node, state);
        if (raw) {
          lines = raw;
          break;
        }
        const depth = Math.min(6, Math.max(1, node.depth ?? 1));
        const headingAttrs: RunState = depth === 1
          ? { attrs: { bold: true, underline: true } }
          : depth === 2
            ? { attrs: { bold: true } }
            : depth === 3
              ? { attrs: { bold: true, italic: true } }
              : { attrs: { italic: true } };
        const headingState = headingAttrs;
        const markerState = mergeState(state, {
          color: themedColor(environment, "heading.marker", "accent"),
        });
        const line: StyledLine = [];
        const marker = `${"#".repeat(depth)} `;
        const start = node.position?.start.offset;
        pushRun(
          line,
          marker,
          markerState,
          start === undefined ? undefined : { from: start, to: start + marker.length }
        );
        renderInlineNodes(node.children ?? [], environment, mergeState(state, headingState))
          .forEach((run) => pushRun(line, run.text, run, run.origin));
        lines = linesFromRuns(line);
        break;
      }
      case "blockquote": {
        const raw = blockRuleEnabled(environment, "blockquote", node, state);
        if (raw) {
          lines = raw;
          break;
        }
        const markerState = mergeState(state, {
          color: themedColor(environment, "blockquote.marker", "success"),
        });
        const content = await renderBlocks(
          node.children ?? [],
          environment,
          state,
          "source"
        );
        lines = content.map((contentLine) => {
          const line: StyledLine = [];
          pushRun(line, "│ ", markerState);
          contentLine.forEach((run) => pushRun(line, run.text, run, run.origin));
          return line;
        });
        break;
      }
      case "list":
        lines = await renderList(node, environment, state, 0);
        break;
      case "code":
        lines = await renderCodeBlock(node, environment, state);
        break;
      case "table":
        lines = await renderTable(node, environment, state);
        break;
      case "thematicBreak": {
        const raw = blockRuleEnabled(environment, "thematic-break", node, state);
        const color = ruleColor(environment, "thematic-break.foreground");
        lines = raw ?? [[{ text: "———", ...state, ...(color ? { color } : {}) }]];
        break;
      }
      case "html":
        lines = rawLines(environment, node, state);
        break;
      default:
        lines = node.children?.length
          ? await renderBlocks(node.children, environment, state, false)
          : rawLines(environment, node, state);
    }
    if (lines.length === 0) continue;
    const sourceGapHasBlankLine = previousNode
      ? (() => {
          const previousEnd = previousNode.position?.end.offset;
          const nextStart = node.position?.start.offset;
          if (previousEnd === undefined || nextStart === undefined) return false;
          return (environment.source.slice(previousEnd, nextStart).match(/\n/g)?.length ?? 0) >= 2;
        })()
      : false;
    if (
      output.length > 0 &&
      output.at(-1)?.length !== 0 &&
      (separate === true || (separate === "source" && sourceGapHasBlankLine))
    ) {
      output.push([]);
    }
    output.push(...lines);
    previousNode = node;
  }
  return output;
};

const renderList = async (
  node: LocatedNode,
  environment: RenderEnvironment,
  state: RunState,
  depth: number
): Promise<StyledLine[]> => {
  const raw = blockRuleEnabled(environment, "list", node, state);
  if (raw) return raw;
  const output: StyledLine[] = [];
  const ordered = node.ordered === true;
  const customColor = ruleColor(environment, "list.marker");
  let index = node.start ?? 1;
  for (const item of node.children ?? []) {
    const baseMarker = ordered ? `${index}. ` : "- ";
    const isTask = item.checked !== null && item.checked !== undefined;
    const enhancedTask = isTask && environment.rules["task-list"];
    const task = !isTask
      ? ""
      : `[${item.checked ? "x" : " "}] `;
    const marker = enhancedTask
      ? `${item.checked ? "●" : "○"} `
      : `${baseMarker}${task}`;
    const taskColor = enhancedTask
      ? ruleColor(
          environment,
          item.checked ? "task-list.checked" : "task-list.unchecked"
        ) ?? (item.checked
          ? environment.theme.success
          : environment.theme.muted)
      : undefined;
    const indent = " ".repeat(depth * 4);
    let firstContentLine = true;
    for (const child of item.children ?? []) {
      if (child.type === "list") {
        output.push(...await renderList(child, environment, state, depth + 1));
        continue;
      }
      const childLines = await renderBlocks([child], environment, state, false);
      if (!firstContentLine && (item.spread || node.spread)) output.push([]);
      childLines.forEach((contentLine) => {
        const line: StyledLine = [];
        pushRun(line, indent);
        if (firstContentLine) {
          pushRun(line, marker, enhancedTask
            ? mergeState(state, { color: taskColor })
            : ordered
              ? { color: customColor ?? environment.theme.accent }
              : customColor
                ? mergeState(state, { color: customColor })
                : state);
        } else {
          pushRun(line, " ".repeat(marker.length));
        }
        contentLine.forEach((run) => pushRun(line, run.text, run, run.origin));
        output.push(line);
        firstContentLine = false;
      });
    }
    index += 1;
  }
  return output;
};

const flattenLines = (lines: readonly StyledLine[]) => {
  const runs: TextRenderFragment[] = [];
  lines.forEach((line, index) => {
    line.forEach((run) => pushRun(runs, run.text, run, run.origin));
    if (index < lines.length - 1) pushRun(runs, "\n");
  });
  return runs;
};

export const renderCodexMarkdownRuns = async (
  source: string,
  root: Root,
  rules: MarkdownRenderRules,
  colors: MarkdownRenderColors,
  theme: TextRenderTheme,
  customRules: readonly MarkdownRenderRule[] = []
) => {
  const rootNode = root as LocatedNode;
  const definitions: DefinitionMap = new Map();
  rootNode.children?.forEach((node) => {
    if (node.type === "definition" && node.identifier && node.url) {
      definitions.set(node.identifier.toLowerCase(), node.url);
    }
  });
  const environment: RenderEnvironment = {
    source,
    rules,
    colors,
    theme,
    definitions,
    diagnostics: [],
    recognized: false,
    customRuleByNodeType: new Map(
      customRules.flatMap((rule) =>
        rule.nodeTypes.map((nodeType) => [nodeType, rule] as const)
      )
    ),
  };
  const lines = await renderBlocks(rootNode.children ?? [], environment, {});
  return {
    fragments: flattenLines(lines),
    diagnostics: environment.diagnostics,
    recognized: environment.recognized,
  };
};
