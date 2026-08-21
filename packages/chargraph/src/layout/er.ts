import { parseErDiagram } from "../vendor/er/parser.js";
import type {
  Cardinality,
  ErAttribute,
  ErRelationship,
} from "../vendor/er/types.js";
import { splitLines } from "../vendor/ascii/multiline-utils.js";
import type { AsciiConfig, Canvas } from "../vendor/ascii/types.js";
import type { GridSide, LayoutGraph } from "./model.js";
import {
  createLayoutLabel,
  createMultiBoxCanvas,
  drawMultiBoxFragment,
} from "./presentation.js";
import {
  endpointCell,
  renderLayeredDiagram,
  type LayeredDiagramPresentation,
  type LayeredEndpointPresentation,
} from "./render.js";

interface ErEdgeVisual {
  relationship: ErRelationship;
}

const entityId = (id: string) => `entity:${id}`;

const attributeLines = (attribute: ErAttribute) => {
  const keys = attribute.keys.length > 0
    ? `${attribute.keys.join(",")} `
    : "   ";
  const base = `${keys}${attribute.type} ${attribute.name}`;
  if (attribute.comment === undefined) return [base];
  const comments = splitLines(attribute.comment);
  const indent = " ".repeat(base.length + 1);
  return comments.map((comment, index) =>
    `${index === 0 ? `${base} ` : indent}"${comment}"`
  );
};

const entitySections = (
  entity: ReturnType<typeof parseErDiagram>["entities"][number],
) => {
  const attributes = entity.attributes.flatMap(attributeLines);
  const header = splitLines(entity.label);
  return attributes.length === 0 ? [header] : [header, attributes];
};

const exactlyOneGlyph = (side: GridSide, useAscii: boolean) => {
  const verticalSide = side === "left" || side === "right";
  if (useAscii) return verticalSide ? "|" : "-";
  return verticalSide ? "│" : "─";
};

const manyGlyph = (side: GridSide, useAscii: boolean) => {
  if (useAscii) {
    if (side === "right") return ">";
    if (side === "left") return "<";
    return side === "bottom" ? "v" : "^";
  }
  if (side === "right") return "╢";
  if (side === "left") return "╟";
  return side === "bottom" ? "╨" : "╥";
};

/** Returns marker cells ordered from the entity outward along the route. */
export const getErEndpointGlyphs = (
  cardinality: Cardinality,
  side: GridSide,
  useAscii: boolean,
) => {
  const one = exactlyOneGlyph(side, useAscii);
  const many = manyGlyph(side, useAscii);
  const zero = useAscii ? "o" : "○";
  if (cardinality === "one") return [one];
  if (cardinality === "zero-one") return [one, zero];
  if (cardinality === "many") return [many];
  return [many, zero];
};

const cardinalityPresentation = (
  cardinality: Cardinality,
): LayeredEndpointPresentation => ({
  trimAnchor: true,
  paint(scene, context) {
    const glyphs = getErEndpointGlyphs(
      cardinality,
      context.endpoint.side,
      context.useAscii,
    );
    for (const [index, char] of glyphs.entries()) {
      scene.add({
        kind: "marker",
        owner: `${context.edge.id}:${context.end}-cardinality:${index}`,
        at: endpointCell(context.endpoint, index + 1),
        char,
      });
    }
  },
});

export const createLayeredErDiagram = (
  text: string,
  config: AsciiConfig,
): { graph: LayoutGraph; presentation: LayeredDiagramPresentation } | undefined => {
  const lines = text.split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("%%"));
  const diagram = parseErDiagram(lines);
  if (diagram.entities.length === 0) return undefined;

  const nodeVisuals = new Map<string, Canvas>();
  const nodes = diagram.entities.map((entity) => {
    const id = entityId(entity.id);
    const canvas = createMultiBoxCanvas(entitySections(entity), config.useAscii);
    nodeVisuals.set(id, canvas);
    return {
      id,
      label: entity.label,
      width: canvas.length,
      height: canvas[0]?.length ?? 1,
      portPlacement: "distributed" as const,
    };
  });

  const edgeVisuals = new Map<string, ErEdgeVisual>();
  const edges = diagram.relationships.map((relationship, index) => {
    const id = `er-edge:${index}`;
    edgeVisuals.set(id, { relationship });
    return {
      id,
      source: entityId(relationship.entity1),
      target: entityId(relationship.entity2),
      label: createLayoutLabel(relationship.label),
    };
  });

  const graph: LayoutGraph = {
    direction: "LR",
    spacing: {
      nodeNode: Math.max(2, config.paddingY),
      nodeNodeBetweenLayers: Math.max(6, config.paddingX),
    },
    nodes,
    edges,
    groups: [],
  };
  const presentation: LayeredDiagramPresentation = {
    drawGroup() {},
    drawNode(scene, node) {
      const canvas = nodeVisuals.get(node.id);
      if (!canvas) throw new Error(`Missing presentation for ER entity ${node.id}`);
      drawMultiBoxFragment(scene, canvas, node, node.id, config.useAscii);
    },
    edge(edge) {
      const visual = edgeVisuals.get(edge.id);
      if (!visual) throw new Error(`Missing presentation for ER edge ${edge.id}`);
      return {
        stroke: {
          style: visual.relationship.identifying ? "solid" : "dotted",
          role: visual.relationship.identifying ? "border" : "line",
          rounded: true,
        },
        sourceEndpoint: cardinalityPresentation(
          visual.relationship.cardinality1,
        ),
        targetEndpoint: cardinalityPresentation(
          visual.relationship.cardinality2,
        ),
      };
    },
  };
  return { graph, presentation };
};

export const renderLayeredEr = async (text: string, config: AsciiConfig) => {
  const diagram = createLayeredErDiagram(text, config);
  if (!diagram) return "";
  return renderLayeredDiagram(diagram.graph, diagram.presentation, config);
};
