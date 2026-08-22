import {
  parseTree,
  printParseErrorCode,
  type Node as JsonNode,
  type ParseError,
} from "jsonc-parser";
import {
  isAlias,
  isMap,
  isScalar,
  isSeq,
  parseAllDocuments,
  type Node as YamlNode,
} from "yaml";
import { createCharGraphFragment } from "./fragments.js";
import type { CharGraphDiagnostic, CharGraphFragment, CharGraphSourceRange } from "./model.js";
import type { CharDeskTextStyle } from "@chardesk/protocol";

export const DATA_TREE_LIMITS = {
  sourceLength: 20_000,
  sourceLines: 400,
  nodes: 2_000,
  depth: 64,
} as const;

export type DataTreeStyleRole =
  | "connector"
  | "key"
  | "string"
  | "number"
  | "keyword";

export type DataTreeStyles = Partial<Record<DataTreeStyleRole, CharDeskTextStyle>>;

type DataTreeRange = { from: number; to: number };
type DataTreeValueKind = "string" | "number" | "keyword";

type DataTreeNode = {
  label?: string;
  labelRange?: DataTreeRange;
  anchor?: string;
  tag?: string;
  value?: string;
  valueKind?: DataTreeValueKind;
  valueRange?: DataTreeRange;
  children: DataTreeNode[];
  range: DataTreeRange;
};

type DataTreeDocument = {
  root: DataTreeNode;
  range: DataTreeRange;
};

export type DataTreeParseResult =
  | { documents: DataTreeDocument[]; diagnostics: [] }
  | { documents: null; diagnostics: CharGraphDiagnostic[] };

type BuildState = { nodes: number };

class DataTreeBuildError extends Error {
  readonly offset: number;
  readonly length: number;

  constructor(message: string, range: DataTreeRange) {
    super(message);
    this.offset = range.from;
    this.length = Math.max(1, range.to - range.from);
  }
}

const range = (from: number, length: number): DataTreeRange => ({
  from,
  to: from + length,
});

const yamlRange = (node: unknown): DataTreeRange => {
  const candidate = node && typeof node === "object" && "range" in node
    ? (node as { range?: readonly number[] | null }).range
    : undefined;
  return {
    from: candidate?.[0] ?? 0,
    to: candidate?.[1] ?? candidate?.[0] ?? 0,
  };
};

const countNode = (state: BuildState, depth: number, nodeRange: DataTreeRange) => {
  state.nodes += 1;
  if (state.nodes > DATA_TREE_LIMITS.nodes) {
    throw new DataTreeBuildError(
      `Data tree exceeds the ${DATA_TREE_LIMITS.nodes}-node limit.`,
      nodeRange
    );
  }
  if (depth > DATA_TREE_LIMITS.depth) {
    throw new DataTreeBuildError(
      `Data tree exceeds the ${DATA_TREE_LIMITS.depth}-level depth limit.`,
      nodeRange
    );
  }
};

const formatKey = (value: unknown) => {
  const text = String(value);
  return text === "<<" || /^[\p{L}\p{N}_$.-]+$/u.test(text)
    ? text
    : JSON.stringify(text);
};

const scalarValue = (value: unknown): Pick<DataTreeNode, "value" | "valueKind"> => {
  if (typeof value === "string") {
    return { value: JSON.stringify(value), valueKind: "string" };
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return { value: String(value), valueKind: "number" };
  }
  if (typeof value === "boolean") {
    return { value: String(value), valueKind: "keyword" };
  }
  if (value == null) return { value: "null", valueKind: "keyword" };
  return { value: JSON.stringify(String(value)), valueKind: "string" };
};

const jsonValueNode = (
  node: JsonNode,
  state: BuildState,
  depth: number,
  label?: string,
  labelRange?: DataTreeRange
): DataTreeNode => {
  const nodeRange = range(node.offset, node.length);
  countNode(state, depth, nodeRange);
  if (node.type === "object") {
    const children = (node.children ?? []).map((property) => {
      const key = property.children?.[0];
      const value = property.children?.[1];
      if (!key || !value) {
        throw new DataTreeBuildError("JSON property is missing a key or value.", nodeRange);
      }
      return jsonValueNode(
        value,
        state,
        depth + 1,
        formatKey(key.value),
        range(key.offset, key.length)
      );
    });
    return {
      ...(label === undefined ? {} : { label, labelRange }),
      ...(children.length === 0 ? { value: "{}", valueKind: "keyword" as const } : {}),
      children,
      range: nodeRange,
      valueRange: nodeRange,
    };
  }
  if (node.type === "array") {
    const children = (node.children ?? []).map((child, index) =>
      jsonValueNode(child, state, depth + 1, `[${index}]`, range(child.offset, child.length))
    );
    return {
      ...(label === undefined ? {} : { label, labelRange }),
      ...(children.length === 0 ? { value: "[]", valueKind: "keyword" as const } : {}),
      children,
      range: nodeRange,
      valueRange: nodeRange,
    };
  }
  return {
    ...(label === undefined ? {} : { label, labelRange }),
    ...scalarValue(node.value),
    children: [],
    range: nodeRange,
    valueRange: nodeRange,
  };
};

const parseJson = (source: string, jsonc: boolean): DataTreeParseResult => {
  const errors: ParseError[] = [];
  const root = parseTree(source, errors, {
    allowEmptyContent: false,
    allowTrailingComma: jsonc,
    disallowComments: !jsonc,
  });
  if (!root || errors.length > 0) {
    const error = errors[0];
    return {
      documents: null,
      diagnostics: [{
        code: "markdown-data-tree-parse-failed",
        message: error
          ? `Could not parse ${jsonc ? "JSONC" : "JSON"}: ${printParseErrorCode(error.error)}.`
          : `Could not parse ${jsonc ? "JSONC" : "JSON"}.`,
        offset: error?.offset ?? 0,
        length: error?.length ?? Math.max(1, source.length),
      }],
    };
  }
  try {
    return {
      documents: [{
        root: jsonValueNode(root, { nodes: 0 }, 0),
        range: range(root.offset, root.length),
      }],
      diagnostics: [],
    };
  } catch (error) {
    return buildFailure(error);
  }
};

const yamlNode = (
  node: YamlNode | null,
  state: BuildState,
  depth: number,
  label?: string,
  labelRange?: DataTreeRange
): DataTreeNode => {
  const nodeRange = node ? yamlRange(node) : { from: 0, to: 0 };
  countNode(state, depth, nodeRange);
  const common = {
    ...(label === undefined ? {} : { label, labelRange }),
    ...(node?.anchor ? { anchor: node.anchor } : {}),
    ...(node?.tag ? { tag: node.tag } : {}),
    range: nodeRange,
  };
  if (!node) {
    return { ...common, value: "null", valueKind: "keyword", valueRange: nodeRange, children: [] };
  }
  if (isAlias(node)) {
    return {
      ...common,
      value: `*${node.source}`,
      valueKind: "keyword",
      valueRange: nodeRange,
      children: [],
    };
  }
  if (isMap(node)) {
    const children = node.items.map((pair) => {
      if (!isScalar(pair.key)) {
        throw new DataTreeBuildError(
          "YAML complex mapping keys cannot be represented as a compact data tree.",
          yamlRange(pair.key)
        );
      }
      return yamlNode(
        pair.value as YamlNode | null,
        state,
        depth + 1,
        formatKey(pair.key.value),
        yamlRange(pair.key)
      );
    });
    return {
      ...common,
      ...(children.length === 0 ? { value: "{}", valueKind: "keyword" as const } : {}),
      valueRange: nodeRange,
      children,
    };
  }
  if (isSeq(node)) {
    const children = node.items.map((item, index) =>
      yamlNode(item as YamlNode | null, state, depth + 1, `[${index}]`, yamlRange(item))
    );
    return {
      ...common,
      ...(children.length === 0 ? { value: "[]", valueKind: "keyword" as const } : {}),
      valueRange: nodeRange,
      children,
    };
  }
  if (isScalar(node)) {
    return {
      ...common,
      ...scalarValue(node.value),
      valueRange: nodeRange,
      children: [],
    };
  }
  throw new DataTreeBuildError("Unsupported YAML node.", nodeRange);
};

const buildFailure = (error: unknown): DataTreeParseResult => ({
  documents: null,
  diagnostics: [{
    code: "markdown-data-tree-render-failed",
    message: error instanceof Error ? error.message : "Could not build data tree.",
    offset: error instanceof DataTreeBuildError ? error.offset : 0,
    length: error instanceof DataTreeBuildError ? error.length : 1,
  }],
});

const parseYaml = (source: string): DataTreeParseResult => {
  const documents = parseAllDocuments(source, {
    intAsBigInt: true,
    prettyErrors: false,
    strict: true,
    uniqueKeys: true,
  });
  const error = documents.flatMap((document) => document.errors)[0];
  if (error) {
    return {
      documents: null,
      diagnostics: [{
        code: "markdown-data-tree-parse-failed",
        message: `Could not parse YAML: ${error.message}`,
        offset: error.pos[0],
        length: Math.max(1, error.pos[1] - error.pos[0]),
      }],
    };
  }
  try {
    const state = { nodes: 0 };
    return {
      documents: documents.map((document) => {
        const documentRange = yamlRange(document);
        return {
          root: yamlNode(document.contents as YamlNode | null, state, 0),
          range: documentRange,
        };
      }),
      diagnostics: [],
    };
  } catch (caught) {
    return buildFailure(caught);
  }
};

const validateSourceSize = (source: string): CharGraphDiagnostic | null => {
  const lines = source === "" ? 0 : source.split("\n").length;
  if (source.length <= DATA_TREE_LIMITS.sourceLength && lines <= DATA_TREE_LIMITS.sourceLines) {
    return null;
  }
  return {
    code: "markdown-data-tree-limit-exceeded",
    message: `Data tree exceeds the ${DATA_TREE_LIMITS.sourceLength}-character or ${DATA_TREE_LIMITS.sourceLines}-line limit.`,
    offset: 0,
    length: Math.max(1, source.length),
  };
};

export const parseDataTree = (
  source: string,
  language: "json" | "jsonc" | "yaml"
): DataTreeParseResult => {
  const limit = validateSourceSize(source);
  if (limit) return { documents: null, diagnostics: [limit] };
  return language === "yaml" ? parseYaml(source) : parseJson(source, language === "jsonc");
};

const translatedRange = (sourceOrigin: CharGraphSourceRange, item: DataTreeRange) => ({
  from: sourceOrigin.from + item.from,
  to: sourceOrigin.from + item.to,
});

const renderNodeHead = (
  node: DataTreeNode,
  sourceOrigin: CharGraphSourceRange,
  styles: DataTreeStyles
) => {
  const output: CharGraphFragment[] = [];
  const nodeOrigin = translatedRange(sourceOrigin, node.range);
  if (node.label !== undefined) {
    output.push(createCharGraphFragment(
      node.label,
      styles.key,
      translatedRange(sourceOrigin, node.labelRange ?? node.range)
    ));
  }
  if (node.anchor) {
    output.push(createCharGraphFragment(` &${node.anchor}`, styles.keyword, nodeOrigin));
  }
  if (node.value !== undefined) {
    if (node.label !== undefined) {
      output.push(createCharGraphFragment(": ", styles.connector, nodeOrigin));
    }
    if (node.tag) {
      output.push(createCharGraphFragment(`${node.tag} `, styles.keyword, nodeOrigin));
    }
    output.push(createCharGraphFragment(
      node.value,
      styles[node.valueKind ?? "keyword"],
      translatedRange(sourceOrigin, node.valueRange ?? node.range)
    ));
  }
  return output;
};

const renderForest = (
  nodes: readonly DataTreeNode[],
  prefix: string,
  sourceOrigin: CharGraphSourceRange,
  styles: DataTreeStyles,
  output: CharGraphFragment[]
) => {
  nodes.forEach((node, index) => {
    const last = index === nodes.length - 1;
    const nodeOrigin = translatedRange(sourceOrigin, node.range);
    if (output.length > 0 && output.at(-1)?.text !== "\n") {
      output.push(createCharGraphFragment("\n", {}, nodeOrigin));
    }
    output.push(createCharGraphFragment(`${prefix}${last ? "└─ " : "├─ "}`, styles.connector, nodeOrigin));
    output.push(...renderNodeHead(node, sourceOrigin, styles));
    if (node.children.length > 0) {
      renderForest(
        node.children,
        `${prefix}${last ? "   " : "│  "}`,
        sourceOrigin,
        styles,
        output
      );
    }
  });
};

const documentNode = (document: DataTreeDocument, index: number): DataTreeNode => ({
  label: `document [${index + 1}]`,
  labelRange: document.range,
  ...(document.root.value === undefined ? {} : {
    value: document.root.value,
    valueKind: document.root.valueKind,
    valueRange: document.root.valueRange,
  }),
  children: document.root.children,
  range: document.range,
});

export const renderDataTree = (
  documents: readonly DataTreeDocument[],
  sourceOrigin: CharGraphSourceRange,
  styles: DataTreeStyles
) => {
  const output: CharGraphFragment[] = [];
  if (documents.length > 1) {
    renderForest(documents.map(documentNode), "", sourceOrigin, styles, output);
    return output;
  }
  const root = documents[0]?.root;
  if (!root) return output;
  if (root.children.length > 0) {
    renderForest(root.children, "", sourceOrigin, styles, output);
  } else {
    output.push(...renderNodeHead(root, sourceOrigin, styles));
  }
  return output;
};
