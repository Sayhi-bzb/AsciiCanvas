import { CharScene, type StrokePrimitive } from "../vendor/ascii/scene.js";
import { cropSurface, surfaceToString } from "../vendor/ascii/surface.js";
import type { Canvas } from "../vendor/ascii/types.js";
import type { CharRole, MermaidStyleRole } from "../vendor/ascii/types.js";
import { getDefaultGraphLayoutEngine } from "./elk.js";
import type {
  GraphLayoutEngine,
  GridLayout,
  LayoutGraph,
  PositionedEdgeEndpoint,
  PositionedLayoutEdge,
  PositionedLayoutGroup,
  PositionedLayoutNode,
} from "./model.js";
import { validateGridLayout } from "./validate.js";

export interface LayeredRenderContext {
  useAscii: boolean;
}

export interface LayeredEndpointMarkerContext extends LayeredRenderContext {
  edge: PositionedLayoutEdge;
  endpoint: PositionedEdgeEndpoint;
  end: "source" | "target";
}

export type LayeredEndpointPainter = (
  scene: CharScene,
  context: LayeredEndpointMarkerContext,
) => void;

export interface LayeredEndpointPresentation {
  trimAnchor: boolean;
  paint: LayeredEndpointPainter;
}

export interface LayeredEdgePresentation {
  stroke: {
    style: NonNullable<StrokePrimitive["style"]>;
    role?: NonNullable<StrokePrimitive["role"]>;
    rounded?: boolean;
  };
  sourceEndpoint?: LayeredEndpointPresentation;
  targetEndpoint?: LayeredEndpointPresentation;
}

export interface LayeredDiagramPresentation {
  drawGroup(
    scene: CharScene,
    group: PositionedLayoutGroup,
    context: LayeredRenderContext,
  ): void;
  drawNode(
    scene: CharScene,
    node: PositionedLayoutNode,
    context: LayeredRenderContext,
  ): void;
  edge(edge: PositionedLayoutEdge): LayeredEdgePresentation;
}

export interface LayeredDiagramRenderOptions extends LayeredRenderContext {
  engine?: GraphLayoutEngine;
}

export const endpointCell = (
  endpoint: PositionedEdgeEndpoint,
  distance: number,
) => ({
  x: endpoint.anchor.x + endpoint.outward.x * distance,
  y: endpoint.anchor.y + endpoint.outward.y * distance,
});

export const writeCanvasFragment = (
  scene: CharScene,
  canvas: Canvas,
  origin: { x: number; y: number },
  owner: string,
  classify: (x: number, y: number, char: string) => CharRole,
  classifyStyle?: (x: number, y: number, char: string) => MermaidStyleRole,
) => {
  for (let x = 0; x < canvas.length; x += 1) {
    for (let y = 0; y < (canvas[0]?.length ?? 0); y += 1) {
      const char = canvas[x]?.[y] ?? " ";
      const styleRole = classifyStyle?.(x, y, char);
      if (char === " " && styleRole !== "node.background") continue;
      scene.write(origin.x + x, origin.y + y, char, classify(x, y, char), {
        owner,
        styleRole,
        reserve: char === " ",
      });
    }
  }
};

const drawEdge = (
  scene: CharScene,
  edge: PositionedLayoutEdge,
  presentation: LayeredEdgePresentation,
  context: LayeredRenderContext,
) => {
  if (edge.points.length < 2) return;
  let points = edge.points;

  if (presentation.sourceEndpoint) {
    presentation.sourceEndpoint.paint(scene, {
      ...context,
      edge,
      endpoint: edge.sourceEndpoint,
      end: "source",
    });
    if (presentation.sourceEndpoint.trimAnchor) {
      points = [edge.sourceEndpoint.marker, ...points.slice(1)];
    }
  }
  if (presentation.targetEndpoint) {
    presentation.targetEndpoint.paint(scene, {
      ...context,
      edge,
      endpoint: edge.targetEndpoint,
      end: "target",
    });
    if (presentation.targetEndpoint.trimAnchor) {
      points = [...points.slice(0, -1), edge.targetEndpoint.marker];
    }
  }

  scene.add({
    kind: "stroke",
    owner: edge.id,
    points,
    role: presentation.stroke.role,
    style: presentation.stroke.style,
    rounded: presentation.stroke.rounded,
    connections: [edge.source, edge.target],
    styleRole: "edge.line",
    topology: edge.routing?.topology,
  });

  if (edge.label && edge.labelPosition) {
    for (const [index, line] of edge.label.text.split("\n").entries()) {
      scene.add({
        kind: "label",
        owner: `${edge.id}:label:${index}`,
        at: { x: edge.labelPosition.x, y: edge.labelPosition.y + index },
        text: line,
        width: edge.label.width,
        styleRole: "edge.label",
      });
    }
  }
};

export const renderGridLayoutSurface = (
  layout: GridLayout,
  presentation: LayeredDiagramPresentation,
  context: LayeredRenderContext,
) => {
  const scene = new CharScene(layout.width + 1, layout.height + 1, context.useAscii);

  for (const group of layout.groups) {
    presentation.drawGroup(scene, group, context);
  }
  for (const edge of layout.edges) {
    drawEdge(scene, edge, presentation.edge(edge), context);
  }
  for (const node of layout.nodes) {
    presentation.drawNode(scene, node, context);
  }

  const composed = scene.compose();
  return cropSurface({
    canvas: composed.canvas,
    styleRoleCanvas: composed.styleRoleCanvas,
  });
};

export const renderGridLayout = (
  layout: GridLayout,
  presentation: LayeredDiagramPresentation,
  context: LayeredRenderContext,
) => surfaceToString(renderGridLayoutSurface(layout, presentation, context));

export const renderLayeredDiagram = async (
  graph: LayoutGraph,
  presentation: LayeredDiagramPresentation,
  options: LayeredDiagramRenderOptions,
) => {
  const layout = await (options.engine ?? getDefaultGraphLayoutEngine()).layout(graph);
  const errors = validateGridLayout(layout);
  if (errors.length > 0) throw new Error(errors[0]);
  return renderGridLayout(layout, presentation, options);
};

export const renderLayeredDiagramSurface = async (
  graph: LayoutGraph,
  presentation: LayeredDiagramPresentation,
  options: LayeredDiagramRenderOptions,
) => {
  const layout = await (options.engine ?? getDefaultGraphLayoutEngine()).layout(graph);
  const errors = validateGridLayout(layout);
  if (errors.length > 0) throw new Error(errors[0]);
  return renderGridLayoutSurface(layout, presentation, options);
};
