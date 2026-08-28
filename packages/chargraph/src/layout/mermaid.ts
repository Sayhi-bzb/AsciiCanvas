import { getBoxGlyphTopology } from "../vendor/ascii/box-drawing.js";
import {
  createFlowCardPresentation,
  getShapeDimensions,
  renderShape,
  type FlowCardPresentation,
} from "../vendor/ascii/shapes/index.js";
import type { CharRole } from "../vendor/ascii/types.js";
import type { MermaidStyleRole } from "../mermaid-style.js";
import type {
  EdgeStyle,
  EdgeMarker,
  MermaidGraph,
  MermaidSubgraph,
} from "../vendor/types.js";
import type {
  GridPoint,
  LayoutGraph,
  LayoutGroup,
  LayoutNode,
} from "./model.js";
import { createLayoutLabel } from "./presentation.js";
import {
  renderLayeredDiagramSurface,
  type LayeredDiagramPresentation,
  type LayeredEndpointPainter,
  writeCanvasFragment,
} from "./render.js";

interface LayeredMermaidRenderOptions {
  useAscii: boolean;
  paddingX: number;
  paddingY: number;
  boxBorderPadding: number;
  boxBorderPaddingX?: number;
  boxBorderPaddingY?: number;
}

interface MermaidNodePresentation {
  canvas: FlowCardPresentation["canvas"];
  dimensions: FlowCardPresentation["dimensions"];
  marker?: FlowCardPresentation["marker"];
  semanticStyleRole?: MermaidStyleRole;
  borderStyleRole: MermaidStyleRole;
}

interface MermaidEdgePresentation {
  style: EdgeStyle;
  hasArrowStart: boolean;
  hasArrowEnd: boolean;
  startMarker?: EdgeMarker;
  endMarker?: EdgeMarker;
  borderStyleRole: MermaidStyleRole;
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

const endpointMarker = (
  marker: EdgeMarker,
  borderStyleRole: MermaidStyleRole,
): LayeredEndpointPainter =>
  (scene, context) => {
    const travel = {
      x: -context.endpoint.outward.x,
      y: -context.endpoint.outward.y,
    };
    scene.add({
      kind: "marker",
      owner: `${context.edge.id}:${context.end}-${marker}`,
      at: context.endpoint.marker,
      char: marker === "arrow"
        ? arrowCharacter(travel)
        : marker === "circle"
          ? (context.useAscii ? "o" : "○")
          : (context.useAscii ? "x" : "×"),
      styleRole: borderStyleRole,
      bundleId: context.edge.routing?.bundleId,
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
  const isStateDiagram = parsed.diagramType === "state";
  const minimumLayerSpacing = isStateDiagram ? 2 : 3;
  flattenGroups(parsed.subgraphs, undefined, groups, owners);

  const nodes: LayoutNode[] = [...parsed.nodes].map(([id, node]) => {
    const idForLayout = nodeId(id);
    const shapeOptions = {
      useAscii: options.useAscii,
      padding: options.boxBorderPadding,
      paddingX: options.boxBorderPaddingX,
      paddingY: options.boxBorderPaddingY,
    };
    const flowCard = !isStateDiagram
      ? createFlowCardPresentation(node.shape, node.label, shapeOptions)
      : undefined;
    const dimensions = flowCard?.dimensions
      ?? getShapeDimensions(node.shape, node.label, shapeOptions);
    nodePresentations.set(idForLayout, {
      canvas: flowCard?.canvas ?? renderShape(node.shape, node.label, shapeOptions),
      dimensions,
      marker: flowCard?.marker,
      semanticStyleRole: node.shape === "state-start"
        ? "state.start"
        : node.shape === "state-end"
          ? "state.end"
          : undefined,
      borderStyleRole: "node.border",
    });
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
      portPlacement: "adaptive" as const,
    };
  });

  const edges = parsed.edges.map((edge, index) => {
    const id = `edge:${index}`;
    const sourcePresentation = nodePresentations.get(nodeId(edge.source));
    if (!sourcePresentation) {
      throw new Error(`Missing presentation for edge source ${edge.source}`);
    }
    edgePresentations.set(id, {
      style: edge.style,
      hasArrowStart: edge.hasArrowStart,
      hasArrowEnd: edge.hasArrowEnd,
      startMarker: edge.startMarker,
      endMarker: edge.endMarker,
      borderStyleRole: sourcePresentation.borderStyleRole,
    });
    return {
      id,
      source: nodeId(edge.source),
      target: nodeId(edge.target),
      label: createLayoutLabel(edge.label),
      labelLayout: edge.label ? "route" as const : undefined,
      routing: {
        quality: "readable" as const,
        ...(!isStateDiagram
          ? { bundle: "structured" as const, bundleKey: edge.style }
          : {}),
        ...(edge.startMarker || edge.hasArrowStart ? { sourceClearance: 1 } : {}),
        ...(edge.endMarker || edge.hasArrowEnd ? { targetClearance: 1 } : {}),
      },
    };
  });

  const graph: LayoutGraph = {
    direction: parsed.direction,
    cycleBreaking: isStateDiagram ? "depth-first" : undefined,
    nodeAlignment: "balanced",
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
        styleRole: "container.border",
        layer: "container",
      });
      scene.add({
        kind: "label",
        owner: `${group.id}:label`,
        at: { x: group.x + 1, y: group.y },
        text: group.label,
        styleRole: "container.title",
      });
    },
    drawNode(scene, node) {
      const visual = nodePresentations.get(node.id);
      if (!visual) throw new Error(`Missing presentation for node ${node.id}`);
      const cellRole = (x: number, y: number, char: string) =>
        roleForShapeCell(x, y, char, visual.dimensions.labelArea);
      writeCanvasFragment(
        scene,
        visual.canvas,
        node,
        node.id,
        cellRole,
        (x, y, char) => {
          if (char === " ") return "node.background";
          if (visual.semanticStyleRole) return visual.semanticStyleRole;
          if (visual.marker?.x === x && visual.marker.y === y) {
            return "flow.node.marker";
          }
          if (cellRole(x, y, char) === "border") {
            return visual.borderStyleRole;
          }
          return "node.text";
        },
      );
    },
    edge(edge) {
      const visual = edgePresentations.get(edge.id);
      if (!visual) throw new Error(`Missing presentation for edge ${edge.id}`);
      return {
        stroke: {
          style: visual.style,
          role: "line",
          rounded: true,
          styleRole: visual.borderStyleRole,
        },
        sourceEndpoint: visual.startMarker || visual.hasArrowStart
          ? {
              trimAnchor: true,
              paint: endpointMarker(
                visual.startMarker ?? "arrow",
                visual.borderStyleRole,
              ),
            }
          : undefined,
        targetEndpoint: visual.endMarker || visual.hasArrowEnd
          ? {
              trimAnchor: true,
              paint: endpointMarker(
                visual.endMarker ?? "arrow",
                visual.borderStyleRole,
              ),
            }
          : undefined,
      };
    },
  };

  return { graph, presentation };
};

export const renderLayeredMermaidSurface = async (
  parsed: MermaidGraph,
  options: LayeredMermaidRenderOptions,
) => {
  const diagram = createLayeredMermaidDiagram(parsed, options);
  return renderLayeredDiagramSurface(diagram.graph, diagram.presentation, options);
};
