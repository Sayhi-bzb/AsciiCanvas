import type { GridCell, StructuredNode } from "@/shared/types";
import { COLOR_PRIMARY_TEXT } from "@/shared/lib/constants";
import { normalizeScene } from "@/shared/utils/structured";
import {
  cloneTextAttributes,
  isSameTextAttributes,
  normalizeCellHref,
} from "@/shared/utils/ansi";

export const cloneStructuredNode = (node: StructuredNode): StructuredNode => {
  if (node.type === "text") {
    return {
      ...node,
      position: { ...node.position },
      style: { ...node.style },
    };
  }
  return {
    ...node,
    start: { ...node.start },
    end: { ...node.end },
    style: { ...node.style },
  };
};

export const cloneScene = (scene: StructuredNode[]) => {
  return scene.map((node) => cloneStructuredNode(node));
};

export const normalizeAndCloneScene = (scene: StructuredNode[]) => {
  return cloneScene(normalizeScene(scene));
};

export const serializeGrid = (grid: Map<string, GridCell>) => {
  return Array.from(grid.entries());
};

export const normalizeGridEntries = (
  entries: unknown,
  fallbackColor = COLOR_PRIMARY_TEXT
) => {
  if (!Array.isArray(entries)) return [];

  return entries.reduce<[string, GridCell][]>((normalized, entry) => {
    if (!Array.isArray(entry) || typeof entry[0] !== "string") {
      return normalized;
    }

    const [key, rawCell] = entry;
    if (typeof rawCell === "string") {
      normalized.push([key, { char: rawCell, color: fallbackColor }]);
      return normalized;
    }

    if (
      rawCell &&
      typeof rawCell === "object" &&
      typeof (rawCell as Partial<GridCell>).char === "string"
    ) {
      const cell = rawCell as Partial<GridCell>;
      const char = (rawCell as { char: string }).char;
      normalized.push([
        key,
        {
          char,
          color: typeof cell.color === "string" ? cell.color : fallbackColor,
          ...(typeof cell.bgColor === "string" ? { bgColor: cell.bgColor } : {}),
          ...(cloneTextAttributes(cell.attrs)
            ? { attrs: cloneTextAttributes(cell.attrs) }
            : {}),
          ...(normalizeCellHref(cell.href) ? { href: normalizeCellHref(cell.href) } : {}),
        },
      ]);
    }

    return normalized;
  }, []);
};

export const createMapFromEntries = (entries: unknown) => {
  return new Map<string, GridCell>(normalizeGridEntries(entries));
};

export const isSameCell = (a?: GridCell, b?: GridCell) => {
  if (!a || !b) return false;
  return (
    a.char === b.char &&
    a.color === b.color &&
    a.bgColor === b.bgColor &&
    a.href === b.href &&
    isSameTextAttributes(a.attrs, b.attrs)
  );
};

export const isPoint = (value: unknown): value is { x: number; y: number } => {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<{ x: unknown; y: unknown }>;
  return typeof point.x === "number" && typeof point.y === "number";
};

export const toStructuredNode = (value: unknown): StructuredNode | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<StructuredNode>;
  if (typeof raw.id !== "string") return null;
  if (typeof raw.order !== "number") return null;
  if (
    !raw.style ||
    typeof raw.style !== "object" ||
    typeof (raw.style as { color?: unknown }).color !== "string"
  ) {
    return null;
  }

  if (raw.type === "box" || raw.type === "line") {
    if (!isPoint(raw.start) || !isPoint(raw.end)) return null;
    if (raw.type === "box" && raw.name !== undefined && typeof raw.name !== "string") {
      return null;
    }
    if (
      raw.type === "line" &&
      raw.axis !== "horizontal" &&
      raw.axis !== "vertical"
    ) {
      return null;
    }
    return cloneStructuredNode(raw as StructuredNode);
  }

  if (raw.type === "text") {
    if (!isPoint(raw.position) || typeof raw.text !== "string") return null;
    return cloneStructuredNode(raw as StructuredNode);
  }

  return null;
};
