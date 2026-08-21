import {
  getGraphemeCellWidth,
  getTextCellWidth,
  splitGraphemes,
} from "@chardesk/protocol";
import { SaxesParser } from "saxes";
import temml from "temml";
import { createCharGraphFragment } from "./fragments.js";
import { defineCharGraphRenderer } from "./model.js";
import type { CharGraphDiagnostic, CharGraphRenderResult } from "./model.js";

export type MathRenderLayout = "inline" | "block";

export type MathRenderOptions = {
  layout: MathRenderLayout;
};

type MathMlNode = {
  name: string;
  attributes: Readonly<Record<string, string>>;
  children: MathMlNode[];
  text: string;
};

type Cell = string | null | undefined;

type MathBox = {
  rows: Cell[][];
  width: number;
  height: number;
  baseline: number;
};

const MAX_SOURCE_LENGTH = 20_000;
const MAX_TREE_DEPTH = 128;
const MAX_TREE_NODES = 50_000;
const MAX_OUTPUT_CELLS = 100_000;

const SUPER = new Map(Object.entries({
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾",
  n: "ⁿ", i: "ⁱ",
}));

const SUB = new Map(Object.entries({
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
  "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎",
  a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ", k: "ₖ", l: "ₗ",
  m: "ₘ", n: "ₙ", o: "ₒ", p: "ₚ", r: "ᵣ", s: "ₛ", t: "ₜ",
  u: "ᵤ", v: "ᵥ", x: "ₓ",
}));

const SPACED_OPERATORS = new Set([
  "+", "−", "-", "=", "≠", "≈", "≃", "≅", "<", ">", "≤", "≥",
  "∈", "∉", "⊂", "⊃", "⊆", "⊇", "→", "←", "↔", "⇒", "⇐", "⇔",
  "∧", "∨", "×", "÷", "·", "∝",
]);

const SUPPORTED_MATHML_NODES = new Set([
  "math", "mrow", "mstyle", "mpadded", "menclose", "semantics",
  "annotation", "annotation-xml", "mphantom", "mi", "mn", "mtext", "ms",
  "mo", "mspace", "mfrac", "msqrt", "mroot", "msup", "msub", "msubsup",
  "mover", "munder", "munderover", "mtable", "mtr", "mtd",
]);

const diagnostic = (code: string, message: string): CharGraphDiagnostic => ({
  code,
  message,
  offset: 0,
});

const parseMathMl = (source: string) => {
  let root: MathMlNode | null = null;
  const stack: MathMlNode[] = [];
  let nodeCount = 0;
  let error: Error | null = null;
  const parser = new SaxesParser({ xmlns: true });
  parser.on("doctype", () => {
    error = new Error("MathML document types are not supported.");
  });
  parser.on("error", (value) => {
    error = value;
  });
  parser.on("opentag", (tag) => {
    nodeCount += 1;
    if (nodeCount > MAX_TREE_NODES) {
      error = new Error("MathML exceeds the node limit.");
      return;
    }
    if (stack.length >= MAX_TREE_DEPTH) {
      error = new Error("MathML exceeds the nesting limit.");
      return;
    }
    const attributes = Object.fromEntries(
      Object.values(tag.attributes).map((attribute) => [
        attribute.local,
        attribute.value,
      ])
    );
    const node: MathMlNode = {
      name: tag.local,
      attributes,
      children: [],
      text: "",
    };
    const parent = stack.at(-1);
    if (parent) parent.children.push(node);
    else root = node;
    stack.push(node);
  });
  parser.on("text", (text) => {
    const node = stack.at(-1);
    if (node) node.text += text;
  });
  parser.on("closetag", () => {
    stack.pop();
  });
  parser.write(source).close();
  if (error) throw error;
  const parsedRoot = root as MathMlNode | null;
  if (!parsedRoot || parsedRoot.name !== "math") {
    throw new Error("Temml did not produce a MathML root element.");
  }
  return parsedRoot;
};

const mapScript = (value: string, characters: ReadonlyMap<string, string>) => {
  const mapped = Array.from(value, (character) => characters.get(character));
  return mapped.every((character): character is string => Boolean(character))
    ? mapped.join("")
    : null;
};

const isAtomic = (value: string) =>
  splitGraphemes(value.trim()).length <= 1 || /^[\p{L}\p{N}]+$/u.test(value.trim());

const grouped = (value: string) => isAtomic(value) ? value : `(${value})`;

const compactChildren = (node: MathMlNode) =>
  node.children.map(renderCompact).join("").replace(/ {2,}/g, " ").trim();

const renderCompact = (node: MathMlNode): string => {
  const values = node.children.map(renderCompact);
  switch (node.name) {
    case "math":
    case "mrow":
    case "mstyle":
    case "mpadded":
    case "menclose":
    case "semantics":
      return compactChildren(node);
    case "annotation":
    case "annotation-xml":
    case "mphantom":
      return "";
    case "mi":
    case "mn":
    case "mtext":
    case "ms":
      return `${node.text}${values.join("")}`;
    case "mo": {
      const value = `${node.text}${values.join("")}`.trim();
      return SPACED_OPERATORS.has(value) ? ` ${value} ` : value;
    }
    case "mspace":
      return " ";
    case "mfrac": {
      const numerator = values[0] ?? "";
      const denominator = values[1] ?? "";
      return `${grouped(numerator)}/${grouped(denominator)}`;
    }
    case "msqrt":
      return `√(${values.join("")})`;
    case "mroot": {
      const radicand = values[0] ?? "";
      const index = values[1] ?? "";
      return `${mapScript(index, SUPER) ?? `[${index}]`}√(${radicand})`;
    }
    case "msup": {
      const base = values[0] ?? "";
      const exponent = values[1] ?? "";
      return `${base}${mapScript(exponent, SUPER) ?? `^(${exponent})`}`;
    }
    case "msub": {
      const base = values[0] ?? "";
      const subscript = values[1] ?? "";
      return `${base}${mapScript(subscript, SUB) ?? `_(${subscript})`}`;
    }
    case "msubsup": {
      const base = values[0] ?? "";
      const subscript = values[1] ?? "";
      const exponent = values[2] ?? "";
      return `${base}${mapScript(subscript, SUB) ?? `_(${subscript})`}${mapScript(exponent, SUPER) ?? `^(${exponent})`}`;
    }
    case "mover":
      return `${values[0] ?? ""}${values[1] ?? ""}`;
    case "munder":
      return `${values[0] ?? ""}_(${values[1] ?? ""})`;
    case "munderover":
      return `${values[0] ?? ""}_(${values[1] ?? ""})^(${values[2] ?? ""})`;
    case "mtable":
      return `[${node.children.map((row) => row.children.map(renderCompact).join(", ")).join("; ")}]`;
    case "mtr":
    case "mtd":
      return values.join("");
    default:
      return `${node.text}${values.join("")}`;
  }
};

const blankBox = (width: number, height: number, baseline: number): MathBox => ({
  rows: Array.from(
    { length: height },
    () => Array.from({ length: width }, (): Cell => undefined)
  ),
  width,
  height,
  baseline,
});

const textBox = (text: string): MathBox => {
  const width = getTextCellWidth(text);
  const box = blankBox(width, 1, 0);
  let x = 0;
  for (const grapheme of splitGraphemes(text)) {
    box.rows[0]![x] = grapheme;
    const cellWidth = getGraphemeCellWidth(grapheme);
    for (let offset = 1; offset < cellWidth; offset += 1) {
      box.rows[0]![x + offset] = null;
    }
    x += cellWidth;
  }
  return box;
};

const place = (target: MathBox, source: MathBox, left: number, top: number) => {
  source.rows.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell !== undefined) target.rows[top + y]![left + x] = cell;
    });
  });
};

const horizontal = (boxes: readonly MathBox[], gap = 0): MathBox => {
  if (boxes.length === 0) return textBox("");
  const baseline = Math.max(...boxes.map((box) => box.baseline));
  const below = Math.max(...boxes.map((box) => box.height - box.baseline - 1));
  const width = boxes.reduce((sum, box) => sum + box.width, 0)
    + gap * Math.max(0, boxes.length - 1);
  const output = blankBox(width, baseline + below + 1, baseline);
  let x = 0;
  boxes.forEach((box) => {
    place(output, box, x, baseline - box.baseline);
    x += box.width + gap;
  });
  return output;
};

const centered = (box: MathBox, width: number) => {
  if (box.width >= width) return box;
  const output = blankBox(width, box.height, box.baseline);
  place(output, box, Math.floor((width - box.width) / 2), 0);
  return output;
};

const fractionBox = (numerator: MathBox, denominator: MathBox) => {
  const width = Math.max(numerator.width, denominator.width, 1) + 2;
  const top = centered(numerator, width);
  const bottom = centered(denominator, width);
  const output = blankBox(width, top.height + 1 + bottom.height, top.height,);
  place(output, top, 0, 0);
  place(output, textBox("─".repeat(width)), 0, top.height);
  place(output, bottom, 0, top.height + 1);
  return output;
};

const scriptsBox = (
  base: MathBox,
  subscript?: MathBox,
  superscript?: MathBox
) => {
  const scriptWidth = Math.max(subscript?.width ?? 0, superscript?.width ?? 0);
  const above = superscript?.height ?? 0;
  const below = subscript?.height ?? 0;
  const output = blankBox(
    base.width + scriptWidth,
    above + base.height + below,
    above + base.baseline
  );
  place(output, base, 0, above);
  if (superscript) place(output, superscript, base.width, 0);
  if (subscript) place(output, subscript, base.width, above + base.height);
  return output;
};

const radicalBox = (radicand: MathBox, index?: MathBox) => {
  const roof = textBox("─".repeat(Math.max(1, radicand.width)));
  const leftWidth = Math.max(1, index?.width ?? 0) + 1;
  const output = blankBox(
    leftWidth + radicand.width,
    radicand.height + 1,
    radicand.baseline + 1
  );
  if (index) place(output, index, 0, 0);
  place(output, roof, leftWidth, 0);
  place(output, textBox("√"), leftWidth - 1, Math.min(output.height - 1, output.baseline));
  place(output, radicand, leftWidth, 1);
  return output;
};

const fencedBox = (body: MathBox, left: string, right: string) => {
  if (body.height === 1) return horizontal([textBox(left), body, textBox(right)]);
  const leftLines = Array.from({ length: body.height }, (_, index) =>
    index === 0 ? "⎡" : index === body.height - 1 ? "⎣" : "⎢"
  );
  const rightLines = Array.from({ length: body.height }, (_, index) =>
    index === 0 ? "⎤" : index === body.height - 1 ? "⎦" : "⎥"
  );
  const output = blankBox(body.width + 2, body.height, body.baseline);
  leftLines.forEach((value, y) => place(output, textBox(value), 0, y));
  place(output, body, 1, 0);
  rightLines.forEach((value, y) => place(output, textBox(value), body.width + 1, y));
  return output;
};

const tableBox = (node: MathMlNode) => {
  const rows = node.children.map((row) => row.children.map(renderBlock));
  const columns = Math.max(0, ...rows.map((row) => row.length));
  const widths = Array.from({ length: columns }, (_, column) =>
    Math.max(0, ...rows.map((row) => row[column]?.width ?? 0))
  );
  const rowBoxes = rows.map((row) => horizontal(
    widths.map((width, column) => centered(row[column] ?? textBox(""), width)),
    2
  ));
  if (rowBoxes.length === 0) return textBox("");
  const width = Math.max(...rowBoxes.map((row) => row.width));
  const height = rowBoxes.reduce((sum, row) => sum + row.height, 0);
  const body = blankBox(width, height, Math.floor((height - 1) / 2));
  let y = 0;
  rowBoxes.forEach((row) => {
    place(body, row, 0, y);
    y += row.height;
  });
  return fencedBox(body, "[", "]");
};

const overUnderBox = (
  base: MathBox,
  under?: MathBox,
  over?: MathBox
) => {
  const width = Math.max(base.width, under?.width ?? 0, over?.width ?? 0);
  const overHeight = over?.height ?? 0;
  const underHeight = under?.height ?? 0;
  const output = blankBox(
    width,
    overHeight + base.height + underHeight,
    overHeight + base.baseline
  );
  if (over) place(output, centered(over, width), 0, 0);
  place(output, centered(base, width), 0, overHeight);
  if (under) place(output, centered(under, width), 0, overHeight + base.height);
  return output;
};

const renderBlock = (node: MathMlNode): MathBox => {
  const boxes = node.children.map(renderBlock);
  switch (node.name) {
    case "math":
    case "mrow":
    case "mstyle":
    case "mpadded":
    case "menclose":
    case "semantics":
      return horizontal(boxes);
    case "annotation":
    case "annotation-xml":
    case "mphantom":
      return textBox("");
    case "mi":
    case "mn":
    case "mtext":
    case "ms":
      return horizontal([textBox(node.text), ...boxes]);
    case "mo": {
      const value = `${node.text}${node.children.map(renderCompact).join("")}`.trim();
      return textBox(SPACED_OPERATORS.has(value) ? ` ${value} ` : value);
    }
    case "mspace":
      return textBox(" ");
    case "mfrac":
      return fractionBox(boxes[0] ?? textBox(""), boxes[1] ?? textBox(""));
    case "msqrt":
      return radicalBox(horizontal(boxes));
    case "mroot":
      return radicalBox(boxes[0] ?? textBox(""), boxes[1]);
    case "msup":
      return scriptsBox(boxes[0] ?? textBox(""), undefined, boxes[1]);
    case "msub":
      return scriptsBox(boxes[0] ?? textBox(""), boxes[1]);
    case "msubsup":
      return scriptsBox(boxes[0] ?? textBox(""), boxes[1], boxes[2]);
    case "mover":
      return overUnderBox(boxes[0] ?? textBox(""), undefined, boxes[1]);
    case "munder":
      return overUnderBox(boxes[0] ?? textBox(""), boxes[1]);
    case "munderover":
      return overUnderBox(boxes[0] ?? textBox(""), boxes[1], boxes[2]);
    case "mtable":
      return tableBox(node);
    case "mtr":
    case "mtd":
      return horizontal(boxes);
    default:
      return horizontal([textBox(node.text), ...boxes]);
  }
};

const mathBoxText = (box: MathBox) => box.rows.map((row) => {
  let value = row.map((cell) => cell === undefined ? " " : cell ?? "").join("");
  value = value.replace(/ +$/g, "");
  return value;
}).join("\n");

const fallback = (source: string, message: string): CharGraphRenderResult => ({
  fragments: [createCharGraphFragment(source, {}, { from: 0, to: source.length })],
  recognized: true,
  diagnostics: [diagnostic("math-render-failed", message)],
});

const unsupportedMathMlNodes = (root: MathMlNode) => {
  const names = new Set<string>();
  const visit = (node: MathMlNode) => {
    if (!SUPPORTED_MATHML_NODES.has(node.name)) names.add(node.name);
    node.children.forEach(visit);
  };
  visit(root);
  return [...names].sort();
};

export const renderMath = (
  source: string,
  options: MathRenderOptions
): CharGraphRenderResult => {
  if (source.length > MAX_SOURCE_LENGTH) {
    return fallback(source, "Could not render math: formula exceeds the 20000-character limit.");
  }
  try {
    const mathMl = temml.renderToString(source, {
      annotate: false,
      displayMode: options.layout === "block",
      maxExpand: 1000,
      maxSize: [20, 200],
      strict: false,
      throwOnError: true,
      trust: false,
      xml: true,
    });
    const tree = parseMathMl(mathMl);
    const unsupported = unsupportedMathMlNodes(tree);
    const text = options.layout === "inline"
      ? renderCompact(tree)
      : mathBoxText(renderBlock(tree));
    const cellCount = text.split("\n").reduce(
      (total, line) => total + getTextCellWidth(line),
      0
    );
    if (cellCount > MAX_OUTPUT_CELLS) {
      return fallback(source, "Could not render math: rendered formula exceeds the cell limit.");
    }
    return {
      fragments: [createCharGraphFragment(text, {}, { from: 0, to: source.length })],
      recognized: true,
      diagnostics: unsupported.length > 0
        ? [diagnostic(
            "math-unsupported-node",
            `MathML elements were rendered through their contents: ${unsupported.join(", ")}.`
          )]
        : [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fallback(source, `Could not render math: ${message}`);
  }
};

export const mathRenderer = defineCharGraphRenderer<MathRenderOptions>({
  id: "math",
  render: renderMath,
});
