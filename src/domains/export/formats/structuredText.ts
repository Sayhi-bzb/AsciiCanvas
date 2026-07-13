import {
  normalizeStructuredComponents,
} from "@/domains/structured-content/public";
import type { StructuredComponentInstance, StructuredNode } from "@/domains/structured-content/public";
import { cloneTextAttributes } from "@/shared/utils/ansi";
import {
  buildStructuredTree,
  getStructuredNodeBounds,
} from "@/domains/structured-content/public";
const escapeAttr = (value: string) => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
};

const formatBounds = (node: StructuredNode) => {
  const bounds = getStructuredNodeBounds(node);
  return `${bounds.x},${bounds.y},${bounds.width},${bounds.height}`;
};

const formatStyle = (style: StructuredNode["style"]) => {
  const parts = [`color:${escapeAttr(style.color)}`];
  if (style.bgColor) parts.push(`bgColor:${escapeAttr(style.bgColor)}`);
  const attrs = cloneTextAttributes(style.attrs);
  if (attrs) {
    parts.push(
      `attrs:${Object.keys(attrs)
        .filter((key) => attrs[key as keyof typeof attrs])
        .join(",")}`
    );
  }
  return parts.join(";");
};

const formatComponentAttrs = (node: StructuredNode): Array<[string, string]> => {
  if (!node.component) return [];
  return [
    ["component", escapeAttr(node.component.templateId)],
    ["role", escapeAttr(node.component.role)],
  ];
};

const emitTag = (
  lines: string[],
  tag: string,
  attrs: Array<[string, string]>,
  indent: string,
  selfClose: boolean
) => {
  lines.push(`${indent}<${tag}`);
  attrs.forEach(([name, value]) => {
    lines.push(`${indent}  ${name}="${value}"`);
  });
  lines.push(`${indent}${selfClose ? "/>" : ">"}`);
};

export const exportStructuredF12Text = (
  scene: StructuredNode[],
  components?: StructuredComponentInstance[]
) => {
  const { roots, childrenById } = buildStructuredTree(scene);
  const componentRegistry = normalizeStructuredComponents(components, scene);
  const lines: string[] = [];

  const emitNode = (node: StructuredNode, depth: number) => {
    const indent = "  ".repeat(depth);
    const commonAttrs: Array<[string, string]> = [
      ["id", escapeAttr(node.id)],
      ["bounds", formatBounds(node)],
      ["style", formatStyle(node.style)],
      ...formatComponentAttrs(node),
    ];

    if (node.type === "box") {
      const boxAttrs =
        node.name && node.name.trim()
          ? [...commonAttrs, ["name", escapeAttr(node.name)] as [string, string]]
          : commonAttrs;
      emitTag(lines, "box", boxAttrs, indent, false);
      const children = childrenById.get(node.id) || [];
      children.forEach((child) => emitNode(child, depth + 1));
      lines.push(`${indent}</box>`);
      return;
    }

    if (node.type === "splitBox") {
      emitTag(
        lines,
        "splitBox",
        [
          ...commonAttrs,
          ["verticalSplitRatio", String(node.verticalSplitRatio)],
          ["topSplitRatio", String(node.topSplitRatio)],
          ["bottomSplitRatio", String(node.bottomSplitRatio)],
        ],
        indent,
        false
      );
      const children = childrenById.get(node.id) || [];
      children.forEach((child) => emitNode(child, depth + 1));
      lines.push(`${indent}</splitBox>`);
      return;
    }

    if (node.type === "line") {
      emitTag(
        lines,
        "line",
        [
          ...commonAttrs,
          ["from", `${node.start.x},${node.start.y}`],
          ["to", `${node.end.x},${node.end.y}`],
          ["axis", node.axis],
        ],
        indent,
        true
      );
      return;
    }

    if (node.type === "bg") {
      emitTag(lines, "bg", commonAttrs, indent, true);
      return;
    }

    emitTag(
      lines,
      "text",
      [
        ...commonAttrs,
        ["at", `${node.position.x},${node.position.y}`],
        ["text", escapeAttr(node.text)],
      ],
      indent,
      true
    );
  };

  emitTag(
    lines,
    "canvas",
    [
      ["mode", "structured"],
      ["nodes", String(scene.length)],
      ["components", String(componentRegistry.length)],
    ],
    "",
    false
  );
  roots.forEach((node) => emitNode(node, 1));
  lines.push("</canvas>");
  return lines.join("\n");
};

export const exportStructuredHierarchyText = (
  scene: StructuredNode[],
  selectedNodeIds: string[] = [],
  components?: StructuredComponentInstance[]
) => {
  const { roots, childrenById } = buildStructuredTree(scene);
  const componentRegistry = normalizeStructuredComponents(components, scene);
  const componentByAtomId = new Map<string, StructuredComponentInstance>();
  componentRegistry.forEach((component) => {
    component.atomIds.forEach((atomId) => componentByAtomId.set(atomId, component));
  });
  const selectedIds = new Set(selectedNodeIds);
  const lines: string[] = [];
  const emittedComponentIds = new Set<string>();
  const nodeById = new Map(scene.map((node) => [node.id, node]));

  const emitNode = (node: StructuredNode, depth: number) => {
    const indent = "  ".repeat(depth);
    const component = componentByAtomId.get(node.id);
    if (component && !emittedComponentIds.has(component.id)) {
      emittedComponentIds.add(component.id);
      emitTag(
        lines,
        "component",
        [
          ["template", escapeAttr(component.templateId)],
          ["label", escapeAttr(component.label)],
        ],
        indent,
        false
      );
      Object.entries(component.roles).forEach(([role, atomIds]) => {
        const roleIndent = "  ".repeat(depth + 1);
        emitTag(lines, "role", [["name", escapeAttr(role)]], roleIndent, false);
        atomIds.forEach((atomId) => {
          const atom = nodeById.get(atomId);
          if (atom) emitAtom(atom, depth + 2);
        });
        lines.push(`${roleIndent}</role>`);
      });
      lines.push(`${indent}</component>`);
      return;
    }
    if (component) return;

    emitAtom(node, depth);
  };

  const emitAtom = (node: StructuredNode, depth: number) => {
    const indent = "  ".repeat(depth);

    if (node.type === "box") {
      const attrs =
        node.name && node.name.trim()
          ? [
              ...formatComponentAttrs(node),
              ["name", escapeAttr(node.name)] as [string, string],
            ]
          : formatComponentAttrs(node);
      emitTag(lines, "box", attrs, indent, false);
      const children = childrenById.get(node.id) || [];
      children.forEach((child) => emitNode(child, depth + 1));
      lines.push(`${indent}</box>`);
      return;
    }

    if (node.type === "splitBox") {
      emitTag(lines, "splitBox", formatComponentAttrs(node), indent, false);
      const children = childrenById.get(node.id) || [];
      children.forEach((child) => emitNode(child, depth + 1));
      lines.push(`${indent}</splitBox>`);
      return;
    }

    if (node.type === "line") {
      emitTag(
        lines,
        "line",
        [...formatComponentAttrs(node), ["axis", node.axis]],
        indent,
        true
      );
      return;
    }

    if (node.type === "bg") {
      emitTag(lines, "bg", formatComponentAttrs(node), indent, true);
      return;
    }

    emitTag(
      lines,
      "text",
      [...formatComponentAttrs(node), ["value", escapeAttr(node.text)]],
      indent,
      true
    );
  };

  const collectSelectedRoots = (
    node: StructuredNode,
    hasSelectedAncestor: boolean,
    out: StructuredNode[]
  ) => {
    const isSelected = selectedIds.has(node.id);
    if (isSelected && !hasSelectedAncestor) {
      out.push(node);
      return;
    }
    const children = childrenById.get(node.id) || [];
    children.forEach((child) =>
      collectSelectedRoots(child, hasSelectedAncestor || isSelected, out)
    );
  };

  const exportRoots =
    selectedIds.size === 0
      ? roots
      : roots.reduce<StructuredNode[]>((out, root) => {
          collectSelectedRoots(root, false, out);
          return out;
        }, []);

  emitTag(lines, "canvas", [["mode", "structured"]], "", false);
  exportRoots.forEach((node) => emitNode(node, 1));
  lines.push("</canvas>");
  return lines.join("\n");
};
