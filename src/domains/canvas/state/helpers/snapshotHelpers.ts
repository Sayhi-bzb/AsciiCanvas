import type { GridCell } from "@/shared/types";
import type { StructuredNode } from "@/domains/structured-content/public";
import {
  cloneStructuredNode,
  decodeStructuredNode,
  normalizeScene,
} from "@/domains/structured-content/public";
import {
  isSameTextAttributes,
} from "@/shared/utils/ansi";
import {
  createGridMap,
  decodeGridEntries,
} from "@/shared/utils/grid-codec";

export const cloneScene = (scene: StructuredNode[]) => {
  return scene.map((node) => cloneStructuredNode(node));
};
export const normalizeAndCloneScene = (scene: StructuredNode[]) => {
  return cloneScene(normalizeScene(scene));
};

export const serializeGrid = (grid: Map<string, GridCell>) => {
  return Array.from(grid.entries());
};

export const normalizeGridEntries = decodeGridEntries;
export const createMapFromEntries = createGridMap;

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

export const toStructuredNode = decodeStructuredNode;
