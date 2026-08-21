import { canvasToString } from "../vendor/ascii/canvas.js";
import { CharScene, type StrokePrimitive } from "../vendor/ascii/scene.js";
import type { Canvas } from "../vendor/ascii/types.js";
import type { CharRole } from "../vendor/ascii/types.js";
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

const cropCanvas = (canvas: Canvas): Canvas => {
  let minX = canvas.length;
  let maxX = -1;
  let minY = canvas[0]?.length ?? 0;
  let maxY = -1;
  for (let x = 0; x < canvas.length; x += 1) {
    for (let y = 0; y < (canvas[0]?.length ?? 0); y += 1) {
      if ((canvas[x]?.[y] ?? " ") === " ") continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return [[" "]];
  return Array.from({ length: maxX - minX + 1 }, (_, x) =>
    Array.from(
      { length: maxY - minY + 1 },
      (_, y) => canvas[minX + x]![minY + y]!,
    ),
  );
};

export const writeCanvasFragment = (
  scene: CharScene,
  canvas: Canvas,
  origin: { x: number; y: number },
  owner: string,
  classify: (x: number, y: number, char: string) => CharRole,
) => {
  for (let x = 0; x < canvas.length; x += 1) {
    for (let y = 0; y < (canvas[0]?.length ?? 0); y += 1) {
      const char = canvas[x]?.[y] ?? " ";
      if (char === " ") continue;
      scene.write(origin.x + x, origin.y + y, char, classify(x, y, char), {
        owner,
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
    if (presentation.sourceEndpoint.trimAnchor) points = points.slice(1);
  }
  if (presentation.targetEndpoint) {
    presentation.targetEndpoint.paint(scene, {
      ...context,
      edge,
      endpoint: edge.targetEndpoint,
      end: "target",
    });
    if (presentation.targetEndpoint.trimAnchor) points = points.slice(0, -1);
  }

  scene.add({
    kind: "stroke",
    owner: edge.id,
    points,
    role: presentation.stroke.role,
    style: presentation.stroke.style,
    rounded: presentation.stroke.rounded,
    connections: [edge.source, edge.target],
  });

  if (edge.label && edge.labelPosition) {
    for (const [index, line] of edge.label.text.split("\n").entries()) {
      scene.add({
        kind: "label",
        owner: `${edge.id}:label:${index}`,
        at: { x: edge.labelPosition.x, y: edge.labelPosition.y + index },
        text: line,
        width: edge.label.width,
      });
    }
  }
};

export const renderGridLayout = (
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

  return canvasToString(cropCanvas(scene.compose().canvas));
};

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
