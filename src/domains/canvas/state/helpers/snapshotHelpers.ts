import type {
  GridCell,
  StructuredComponentInstance,
  StructuredNode,
  StructuredSplitBoxNode,
  StructuredSplitBoxTreeNode,
} from "@/shared/types";
import { COLOR_PRIMARY_TEXT } from "@/shared/lib/constants";
import { normalizeScene } from "@/shared/utils/structured";
import {
  cloneTextAttributes,
  isSameTextAttributes,
  normalizeCellHref,
} from "@/shared/utils/ansi";
import { cloneStructuredTextStyleRanges } from "@/shared/utils/structuredTextRanges";
import { normalizeSplitBoxRoot } from "@/shared/utils/shapes";

const cloneSplitBoxRoot = (
  root: StructuredSplitBoxTreeNode
): StructuredSplitBoxTreeNode =>
  root.type === "leaf"
    ? { ...root }
    : {
        ...root,
        first: cloneSplitBoxRoot(root.first),
        second: cloneSplitBoxRoot(root.second),
      };

const isComponentMetadata = (
  component: unknown
): component is NonNullable<StructuredNode["component"]> =>
  !!component &&
  typeof component === "object" &&
  typeof (component as { instanceId?: unknown }).instanceId === "string" &&
  typeof (component as { templateId?: unknown }).templateId === "string" &&
  typeof (component as { role?: unknown }).role === "string";

const cloneComponentMetadata = (component: StructuredNode["component"]) =>
  isComponentMetadata(component)
    ? {
        component: {
          instanceId: component.instanceId,
          templateId: component.templateId,
          role: component.role,
        },
      }
    : {};

export const cloneStructuredNode = (node: StructuredNode): StructuredNode => {
  if (node.type === "text") {
    return {
      ...node,
      position: { ...node.position },
      style: { ...node.style },
      ...(cloneStructuredTextStyleRanges(node.styleRanges)
        ? { styleRanges: cloneStructuredTextStyleRanges(node.styleRanges) }
        : {}),
      ...cloneComponentMetadata(node.component),
    };
  }
  if (node.type === "splitBox") {
    return {
      ...node,
      start: { ...node.start },
      end: { ...node.end },
      style: { ...node.style },
      root: cloneSplitBoxRoot(
        normalizeSplitBoxRoot(node.root, {
          verticalSplitRatio: node.verticalSplitRatio,
          topSplitRatio: node.topSplitRatio,
          bottomSplitRatio: node.bottomSplitRatio,
        })
      ),
      ...cloneComponentMetadata(node.component),
    };
  }
  return {
    ...node,
    start: { ...node.start },
    end: { ...node.end },
    style: { ...node.style },
    ...cloneComponentMetadata(node.component),
  };
};

export const cloneScene = (scene: StructuredNode[]) => {
  return scene.map((node) => cloneStructuredNode(node));
};

export const cloneStructuredComponent = (
  component: StructuredComponentInstance
): StructuredComponentInstance => ({
  id: component.id,
  templateId: component.templateId,
  label: component.label,
  atomIds: [...component.atomIds],
  roles: Object.fromEntries(
    Object.entries(component.roles).map(([role, atomIds]) => [role, [...atomIds]])
  ),
});

export const deriveStructuredComponentsFromScene = (
  scene: StructuredNode[]
): StructuredComponentInstance[] => {
  const byInstanceId = new Map<string, StructuredComponentInstance>();
  scene.forEach((node) => {
    const component = node.component;
    if (!isComponentMetadata(component)) return;
    const current =
      byInstanceId.get(component.instanceId) ??
      ({
        id: component.instanceId,
        templateId: component.templateId,
        label: component.templateId,
        atomIds: [],
        roles: {},
      } satisfies StructuredComponentInstance);
    current.atomIds.push(node.id);
    current.roles[component.role] = [
      ...(current.roles[component.role] ?? []),
      node.id,
    ];
    byInstanceId.set(component.instanceId, current);
  });
  return [...byInstanceId.values()];
};

export const normalizeStructuredComponents = (
  components: StructuredComponentInstance[] | undefined,
  scene: StructuredNode[]
) => {
  const nodeIds = new Set(scene.map((node) => node.id));
  const source =
    components && components.length > 0
      ? components
      : deriveStructuredComponentsFromScene(scene);
  const normalized = source
    .map((component) => {
      const atomIds = component.atomIds.filter((id) => nodeIds.has(id));
      const roles = Object.fromEntries(
        Object.entries(component.roles)
          .map(([role, ids]) => [
            role,
            ids.filter((id) => nodeIds.has(id)),
          ])
          .filter(([, ids]) => ids.length > 0)
      );
      return {
        id: component.id,
        templateId: component.templateId,
        label: component.label,
        atomIds,
        roles,
      };
    })
    .filter((component) => component.atomIds.length > 0);

  return normalized.map(cloneStructuredComponent);
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

  if (raw.type === "box" || raw.type === "line" || raw.type === "bg" || raw.type === "splitBox") {
    if (!isPoint(raw.start) || !isPoint(raw.end)) return null;
    if (raw.type === "box" && raw.name !== undefined && typeof raw.name !== "string") {
      return null;
    }
    if (raw.type === "splitBox") {
      const splitBox = raw as Partial<StructuredSplitBoxNode>;
      return cloneStructuredNode({
        ...(raw as StructuredSplitBoxNode),
        verticalSplitRatio:
          typeof splitBox.verticalSplitRatio === "number"
            ? splitBox.verticalSplitRatio
            : 0.36,
        topSplitRatio:
          typeof splitBox.topSplitRatio === "number" ? splitBox.topSplitRatio : 0.25,
        bottomSplitRatio:
          typeof splitBox.bottomSplitRatio === "number"
            ? splitBox.bottomSplitRatio
            : 0.75,
        root: normalizeSplitBoxRoot(splitBox.root, {
          verticalSplitRatio:
            typeof splitBox.verticalSplitRatio === "number"
              ? splitBox.verticalSplitRatio
              : 0.36,
          topSplitRatio:
            typeof splitBox.topSplitRatio === "number"
              ? splitBox.topSplitRatio
              : 0.25,
          bottomSplitRatio:
            typeof splitBox.bottomSplitRatio === "number"
              ? splitBox.bottomSplitRatio
              : 0.75,
        }),
      });
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
