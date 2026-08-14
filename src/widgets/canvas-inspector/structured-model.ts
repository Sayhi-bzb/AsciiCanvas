import { splitGraphemes } from "@/shared/metrics";
import {
  canReorderStructuredNodes,
  getStructuredTextSelectionRange,
  getStructuredTextStylesInRange,
  type StructuredNode,
  type StructuredTextSelection,
} from "@/domains/structured-content/public";

type InspectorValue<T> =
  | { kind: "value"; value: T }
  | { kind: "mixed" }
  | { kind: "unavailable" };

type StructuredInspectorModel = {
  target: "defaults" | "text-range" | "nodes";
  targetLabel: "defaults" | "text-range" | "node" | "nodes";
  count: number;
  primaryColor: InspectorValue<string | null>;
  arrange: {
    forward: boolean;
    backward: boolean;
    front: boolean;
    back: boolean;
    duplicate: boolean;
    delete: boolean;
  };
};

type ModelInput = {
  brushColor: string;
  scene: StructuredNode[];
  selectedIds: string[];
  textSelection: StructuredTextSelection | null;
};

const sharedValue = <T,>(values: T[]): InspectorValue<T> => {
  if (values.length === 0) return { kind: "unavailable" };
  return values.every((value) => Object.is(value, values[0]))
    ? { kind: "value", value: values[0] }
    : { kind: "mixed" };
};

const getNodePrimaryColors = (node: StructuredNode): Array<string | null> => {
  if (node.type === "bg") return [node.style.bgColor ?? null];
  if (node.type !== "text") return [node.style.color];
  const length = splitGraphemes(node.text).length;
  if (length === 0) return [node.style.color];
  return getStructuredTextStylesInRange(node, 0, length).map(
    (style) => style.color
  );
};

export const deriveStructuredInspectorModel = ({
  brushColor,
  scene,
  selectedIds,
  textSelection,
}: ModelInput): StructuredInspectorModel => {
  const range = getStructuredTextSelectionRange(textSelection);
  const rangeNode =
    range && textSelection
      ? scene.find(
          (node) => node.id === textSelection.nodeId && node.type === "text"
        )
      : null;
  if (range && rangeNode?.type === "text") {
    const styles = getStructuredTextStylesInRange(rangeNode, range.start, range.end);
    return {
      target: "text-range",
      targetLabel: "text-range",
      count: range.end - range.start,
      primaryColor: sharedValue(styles.map((style) => style.color)),
      arrange: {
        forward: false,
        backward: false,
        front: false,
        back: false,
        duplicate: false,
        delete: false,
      },
    };
  }

  const selected = scene.filter((node) => selectedIds.includes(node.id));
  if (selected.length > 0) {
    const primaryColors = selected.flatMap(getNodePrimaryColors);
    return {
      target: "nodes",
      targetLabel: selected.length === 1 ? "node" : "nodes",
      count: selected.length,
      primaryColor: sharedValue(primaryColors),
      arrange: {
        forward: canReorderStructuredNodes(scene, selectedIds, "forward"),
        backward: canReorderStructuredNodes(scene, selectedIds, "backward"),
        front: canReorderStructuredNodes(scene, selectedIds, "front"),
        back: canReorderStructuredNodes(scene, selectedIds, "back"),
        duplicate: true,
        delete: true,
      },
    };
  }

  return {
    target: "defaults",
    targetLabel: "defaults",
    count: 0,
    primaryColor: { kind: "value", value: brushColor },
    arrange: {
      forward: false,
      backward: false,
      front: false,
      back: false,
      duplicate: false,
      delete: false,
    },
  };
};
