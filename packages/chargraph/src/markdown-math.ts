import type { MarkedExtension, Token } from "marked";
import type { CharDeskTextStyle } from "@chardesk/protocol";
import {
  createCharGraphFragment,
  mergeCharGraphStyle,
} from "./fragments.js";
import type {
  MarkdownExtensionRenderRequest,
  MarkdownSyntaxExtension,
} from "./markdown-extension.js";
import { renderMath } from "./math.js";

type MathToken = Token & {
  type: "inlineMath" | "blockMath";
  raw: string;
  text: string;
};

export const MARKDOWN_MATH_STYLE_ROLES = [
  "inline-math",
  "block-math",
  "math-content",
  "math-operator",
  "math-structure",
  "math-error",
] as const;
type MarkdownMathStyleRole =
  typeof MARKDOWN_MATH_STYLE_ROLES[number];

const findClosingDelimiter = (
  source: string,
  delimiter: "$" | "\\)"
) => {
  for (let index = delimiter === "$" ? 1 : 2; index < source.length; index += 1) {
    if (source[index] === "\n") return -1;
    if (!source.startsWith(delimiter, index)) continue;
    let slashCount = 0;
    for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) {
      slashCount += 1;
    }
    if (slashCount % 2 === 0) return index;
  }
  return -1;
};

const blockRule = (
  source: string,
  opening: "$$" | "\\[",
  closing: "$$" | "\\]"
) => {
  if (!source.startsWith(opening)) return null;
  const end = source.indexOf(closing, opening.length);
  if (end < 0) return null;
  const after = end + closing.length;
  if (source[after] && source[after] !== "\n") return null;
  const rawEnd = source[after] === "\n" ? after + 1 : after;
  return {
    raw: source.slice(0, rawEnd),
    text: source.slice(opening.length, end).replace(/^\n|\n$/g, ""),
  };
};

const mathMarkedExtension: MarkedExtension = {
  extensions: [
    {
      name: "blockMath",
      level: "block",
      start(source) {
        const dollar = source.search(/^\$\$/m);
        const bracket = source.search(/^\\\[/m);
        return [dollar, bracket]
          .filter((index) => index >= 0)
          .sort((left, right) => left - right)[0];
      },
      tokenizer(source) {
        const match = blockRule(source, "$$", "$$")
          ?? blockRule(source, "\\[", "\\]");
        if (!match || !match.text.trim()) return undefined;
        return {
          type: "blockMath",
          raw: match.raw,
          text: match.text,
        } satisfies MathToken;
      },
    },
    {
      name: "inlineMath",
      level: "inline",
      start(source) {
        const dollar = source.search(/\$(?!\$)/);
        const parenthesis = source.indexOf("\\(");
        return [dollar, parenthesis]
          .filter((index) => index >= 0)
          .sort((left, right) => left - right)[0];
      },
      tokenizer(source) {
        if (source.startsWith("$$")) return undefined;
        if (source.startsWith("$")) {
          const end = findClosingDelimiter(source, "$");
          if (end < 0) return undefined;
          const text = source.slice(1, end);
          if (!text || /^\s|\s$/.test(text)) return undefined;
          return {
            type: "inlineMath",
            raw: source.slice(0, end + 1),
            text,
          } satisfies MathToken;
        }
        if (source.startsWith("\\(")) {
          const end = findClosingDelimiter(source, "\\)");
          if (end < 0) return undefined;
          const text = source.slice(2, end);
          if (!text.trim()) return undefined;
          return {
            type: "inlineMath",
            raw: source.slice(0, end + 2),
            text,
          } satisfies MathToken;
        }
        return undefined;
      },
    },
  ],
};

const fallback = (
  request: MarkdownExtensionRenderRequest,
  message: string,
  style?: CharDeskTextStyle
) => {
  const source = request.kind === "fenced-code"
    ? request.rawSource.replace(/\n$/, "")
    : request.source.replace(/\n$/, "");
  const origin = request.kind === "fenced-code"
    ? request.rawOrigin
    : request.sourceOrigin;
  return {
    fragments: [createCharGraphFragment(source, style ?? {}, origin)],
    recognized: true,
    diagnostics: [{
      code: "markdown-math-render-failed",
      message,
      offset: origin.from,
      length: origin.to - origin.from,
    }],
  };
};

export const markdownMathExtension: MarkdownSyntaxExtension<
  MarkdownMathStyleRole
> = {
  id: "math",
  marked: mathMarkedExtension,
  tokenTypes: ["inlineMath", "blockMath"],
  fencedLanguages: ["math", "tex", "latex"],
  render(request, context) {
    const token = request.kind === "token" ? request.token as MathToken : null;
    const layout = token?.type === "inlineMath" ? "inline" : "block";
    const rule = layout === "inline" ? "inline-math" : "block-math";
    if (!context.enabled(rule)) {
      const source = request.kind === "fenced-code"
        ? request.source
        : layout === "inline"
          ? token?.text ?? ""
          : request.source.replace(/\n$/, "");
      return {
        fragments: [createCharGraphFragment(source, {}, request.sourceOrigin)],
        recognized: true,
        diagnostics: [],
      };
    }
    const source = request.kind === "fenced-code"
      ? request.source
      : token?.text ?? "";
    const rendered = renderMath(source, {
      layout,
      styles: {
        content: mergeCharGraphStyle(
          context.style(rule) ?? {},
          context.style("math-content")
        ),
        operator: context.style("math-operator"),
        structure: context.style("math-structure"),
        error: context.style("math-error"),
      },
    });
    const failure = rendered.diagnostics.find(
      (item) => item.code === "math-render-failed"
    );
    if (failure) {
      return fallback(request, failure.message, context.style("math-error"));
    }
    return {
      fragments: rendered.fragments.map((fragment) => ({
        ...fragment,
        origin: request.sourceOrigin,
      })),
      recognized: true,
      diagnostics: rendered.diagnostics.map((item) => ({
        ...item,
        offset: request.sourceOrigin.from + (item.offset ?? 0),
      })),
    };
  },
};
