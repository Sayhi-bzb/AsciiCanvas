import { getBoxGlyphTopology } from "../vendor/ascii/box-drawing.js";
import {
  getShapeDimensions,
  renderShape,
} from "../vendor/ascii/shapes/index.js";
import type { CharRole } from "../vendor/ascii/types.js";
import type {
  EdgeStyle,
  MermaidGraph,
  MermaidSubgraph,
  NodeShape,
} from "../vendor/types.js";
import type {
  GridPoint,
  LayoutGraph,
  LayoutGroup,
  LayoutNode,
} from "./model.js";
import { createLayoutLabel } from "./presentation.js";
import {
  renderLayeredDiagram,
  type LayeredDiagramPresentation,
  type LayeredEndpointPainter,
  writeCanvasFragment,
} from "./render.js";

export interface LayeredMermaidRenderOptions {
  useAscii: boolean;
  paddingX: number;
  paddingY: number;
  boxBorderPadding: number;
  boxBorderPaddingX?: number;
  boxBorderPaddingY?: number;
}

interface MermaidNodePresentation {
  label: string;
  shape: NodeShape;
}

interface MermaidEdgePresentation {
  style: EdgeStyle;
  hasArrowStart: boolean;
  hasArrowEnd: boolean;
}

const nodeId = (id: string) => `node:${id}`;
const groupId = (id: string) => `group:${id}`;

const flattenGroups = (
  groups: MermaidSubgraph[],
  parentId: string | undefined,
  result: LayoutGroup[],
  owners: Map<string, string>,
) => {
  for (const group of groups) {
    const id = groupId(group.id);
    result.push({ id, label: group.label, parentId });
    for (const member of group.nodeIds) owners.set(member, id);
    flattenGroups(group.children, id, result, owners);
  }
};

const roleForShapeCell = (
  x: number,
  y: number,
  char: string,
  labelArea: { x: number; y: number; width: number; height: number },
): CharRole => {
  if (
    x >= labelArea.x &&
    x < labelArea.x + labelArea.width &&
    y >= labelArea.y &&
    y < labelArea.y + labelArea.height
  ) return "text";
  return getBoxGlyphTopology(char) || /[◇◆●◎○△▽◁▷]/u.test(char)
    ? "border"
    : "text";
};

const arrowCharacter = (travel: GridPoint) => {
  if (travel.x > 0) return ">";
  if (travel.x < 0) return "<";
  if (travel.y > 0) return "v";
  if (travel.y < 0) return "^";
  return ">";
};

const arrowMarker: LayeredEndpointPainter = (scene, context) => {
  scene.add({
    kind: "marker",
    owner: `${context.edge.id}:${context.end}-arrow`,
    at: context.endpoint.marker,
    char: arrowCharacter({
      x: -context.endpoint.outward.x,
      y: -context.endpoint.outward.y,
    }),
  });
};

const createLayeredMermaidDiagram = (
  parsed: MermaidGraph,
  options: LayeredMermaidRenderOptions,
): { graph: LayoutGraph; presentation: LayeredDiagramPresentation } => {
  const groups: LayoutGroup[] = [];
  const owners = new Map<string, string>();
  const nodePresentations = new Map<string, MermaidNodePresentation>();
  const edgePresentations = new Map<string, MermaidEdgePresentation>();
  const hasBidirectionalEdge = parsed.edges.some((edge) =>
    edge.hasArrowStart && edge.hasArrowEnd
  );
  const minimumLayerSpacing = hasBidirectionalEdge ? 3 : 2;
  flattenGroups(parsed.subgraphs, undefined, groups, owners);

  const nodes: LayoutNode[] = [...parsed.nodes].map(([id, node]) => {
    const idForLayout = nodeId(id);
    const dimensions = getShapeDimensions(node.shape, node.label, {
      useAscii: options.useAscii,
      padding: options.boxBorderPadding,
      paddingX: options.boxBorderPaddingX,
      paddingY: options.boxBorderPaddingY,
    });
    nodePresentations.set(idForLayout, { label: node.label, shape: node.shape });
    return {
      id: idForLayout,
      label: node.label,
      width: dimensions.width,
      height: dimensions.height,
      parentId: owners.get(id),
      rankConstraint: node.shape === "state-start"
        ? "first"
        : node.shape === "state-end"
          ? "last"
          : undefined,
    };
  });

  const edges = parsed.edges.map((edge, index) => {
    const id = `edge:${index}`;
    edgePresentations.set(id, {
      style: edge.style,
      hasArrowStart: edge.hasArrowStart,
      hasArrowEnd: edge.hasArrowEnd,
    });
    return {
      id,
      source: nodeId(edge.source),
      target: nodeId(edge.target),
      label: createLayoutLabel(edge.label),
    };
  });

  const graph: LayoutGraph = {
    direction: parsed.direction,
    spacing: parsed.direction === "LR" || parsed.direction === "RL"
      ? {
          nodeNode: Math.max(2, options.paddingY),
          nodeNodeBetweenLayers: Math.max(
            minimumLayerSpacing,
            options.paddingX,
          ),
        }
      : {
          nodeNode: Math.max(2, options.paddingX),
          nodeNodeBetweenLayers: Math.max(
            minimumLayerSpacing,
            options.paddingY,
          ),
        },
    nodes,
    groups,
    edges,
  };

  const presentation: LayeredDiagramPresentation = {
    drawGroup(scene, group) {
      scene.add({
        kind: "box",
        owner: group.id,
        x: group.x,
        y: group.y,
        width: group.width,
        height: group.height,
      });
      scene.add({
        kind: "label",
        owner: `${group.id}:label`,
        at: { x: group.x + 1, y: group.y },
        text: group.label,
      });
    },
    drawNode(scene, node, context) {
      const visual = nodePresentations.get(node.id);
      if (!visual) throw new Error(`Missing presentation for node ${node.id}`);
      const shapeOptions = {
        useAscii: context.useAscii,
        padding: options.boxBorderPadding,
        paddingX: options.boxBorderPaddingX,
        paddingY: options.boxBorderPaddingY,
      };
      const dimensions = getShapeDimensions(
        visual.shape,
        visual.label,
        shapeOptions,
      );
      writeCanvasFragment(
        scene,
        renderShape(visual.shape, visual.label, shapeOptions),
        node,
        node.id,
        (x, y, char) => roleForShapeCell(x, y, char, dimensions.labelArea),
      );
    },
    edge(edge) {
      const visual = edgePresentations.get(edge.id);
      if (!visual) throw new Error(`Missing presentation for edge ${edge.id}`);
      return {
        stroke: {
          style: visual.style,
          role: visual.style === "solid" ? "border" : "line",
          rounded: true,
        },
        sourceEndpoint: visual.hasArrowStart
          ? { trimAnchor: true, paint: arrowMarker }
          : undefined,
        targetEndpoint: visual.hasArrowEnd
          ? { trimAnchor: true, paint: arrowMarker }
          : undefined,
      };
    },
  };

  return { graph, presentation };
};

export const renderLayeredMermaid = async (
  parsed: MermaidGraph,
  options: LayeredMermaidRenderOptions,
) => {
  const diagram = createLayeredMermaidDiagram(parsed, options);
  return renderLayeredDiagram(diagram.graph, diagram.presentation, options);
};
