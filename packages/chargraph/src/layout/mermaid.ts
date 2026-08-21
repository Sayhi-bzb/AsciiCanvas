import type { MermaidGraph, MermaidSubgraph } from "../vendor/types.js";
import { canvasToString } from "../vendor/ascii/canvas.js";
import { getBoxGlyphTopology } from "../vendor/ascii/box-drawing.js";
import { CharScene } from "../vendor/ascii/scene.js";
import {
  getShapeDimensions,
  renderShape,
} from "../vendor/ascii/shapes/index.js";
import type { Canvas, CharRole } from "../vendor/ascii/types.js";
import { getDefaultGraphLayoutEngine } from "./elk.js";
import type {
  GridLayout,
  GridPoint,
  LayoutGraph,
  LayoutGroup,
  LayoutNode,
  PositionedLayoutEdge,
} from "./model.js";
import { validateGridLayout } from "./validate.js";

export interface LayeredMermaidRenderOptions {
  useAscii: boolean;
  paddingX: number;
  paddingY: number;
  boxBorderPadding: number;
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

const toLayoutGraph = (
  parsed: MermaidGraph,
  options: LayeredMermaidRenderOptions,
): LayoutGraph => {
  const groups: LayoutGroup[] = [];
  const owners = new Map<string, string>();
  flattenGroups(parsed.subgraphs, undefined, groups, owners);

  const nodes: LayoutNode[] = [...parsed.nodes].map(([id, node]) => {
    const dimensions = getShapeDimensions(node.shape, node.label, {
      useAscii: options.useAscii,
      padding: options.boxBorderPadding,
    });
    return {
      id: nodeId(id),
      label: node.label,
      shape: node.shape,
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

  return {
    direction: parsed.direction,
    spacing: parsed.direction === "LR" || parsed.direction === "RL"
      ? {
          nodeNode: Math.max(1, options.paddingY),
          nodeNodeBetweenLayers: Math.max(2, options.paddingX),
        }
      : {
          nodeNode: Math.max(1, options.paddingX),
          nodeNodeBetweenLayers: Math.max(2, options.paddingY),
        },
    nodes,
    groups,
    edges: parsed.edges.map((edge, index) => ({
      id: `edge:${index}`,
      source: nodeId(edge.source),
      target: nodeId(edge.target),
      label: edge.label,
      labelWidth: edge.label?.length ?? 0,
      style: edge.style,
      hasArrowStart: edge.hasArrowStart,
      hasArrowEnd: edge.hasArrowEnd,
    })),
  };
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

const writeShape = (
  scene: CharScene,
  canvas: Canvas,
  origin: GridPoint,
  owner: string,
  labelArea: { x: number; y: number; width: number; height: number },
) => {
  for (let x = 0; x < canvas.length; x += 1) {
    for (let y = 0; y < (canvas[0]?.length ?? 0); y += 1) {
      const char = canvas[x]?.[y] ?? " ";
      if (char === " ") continue;
      scene.write(
        origin.x + x,
        origin.y + y,
        char,
        roleForShapeCell(x, y, char, labelArea),
        { owner },
      );
    }
  }
};

const direction = (from: GridPoint, to: GridPoint) => ({
  x: Math.sign(to.x - from.x),
  y: Math.sign(to.y - from.y),
});

const offset = (point: GridPoint, amount: GridPoint): GridPoint => ({
  x: point.x + amount.x,
  y: point.y + amount.y,
});

const arrowCharacter = (travel: GridPoint, useAscii: boolean) => {
  if (travel.x > 0) return ">";
  if (travel.x < 0) return "<";
  if (travel.y > 0) return "v";
  if (travel.y < 0) return "^";
  return useAscii ? ">" : ">";
};

const replaceEndpoint = (
  points: GridPoint[],
  index: number,
  replacement: GridPoint,
) => points.map((point, pointIndex) => pointIndex === index ? replacement : point);

const lineCharacters = (
  style: PositionedLayoutEdge["style"],
  useAscii: boolean,
) => style === "dotted"
  ? { horizontal: useAscii ? "." : "┄", vertical: useAscii ? ":" : "┆" }
  : { horizontal: useAscii ? "=" : "━", vertical: useAscii ? "‖" : "┃" };

const writeStyledEdge = (
  scene: CharScene,
  edge: PositionedLayoutEdge,
  points: GridPoint[],
  useAscii: boolean,
) => {
  const chars = lineCharacters(edge.style, useAscii);
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!;
    const to = points[index]!;
    const step = direction(from, to);
    let current = { ...from };
    while (current.x !== to.x || current.y !== to.y) {
      scene.write(
        current.x,
        current.y,
        step.x === 0 ? chars.vertical : chars.horizontal,
        "line",
        { owner: edge.id },
      );
      current = offset(current, step);
    }
    scene.write(
      to.x,
      to.y,
      step.x === 0 ? chars.vertical : chars.horizontal,
      "line",
      { owner: edge.id },
    );
  }
};

const drawEdge = (
  scene: CharScene,
  edge: PositionedLayoutEdge,
  useAscii: boolean,
) => {
  if (edge.points.length < 2) return;
  let points = edge.points;
  const firstTravel = direction(points[0]!, points[1]!);
  const lastTravel = direction(points.at(-2)!, points.at(-1)!);

  if (edge.hasArrowStart) {
    const marker = offset(points[0]!, firstTravel);
    scene.add({
      kind: "marker",
      owner: `${edge.id}:start-arrow`,
      at: marker,
      char: arrowCharacter({ x: -firstTravel.x, y: -firstTravel.y }, useAscii),
    });
    points = replaceEndpoint(points, 0, marker);
  }
  if (edge.hasArrowEnd) {
    const marker = offset(points.at(-1)!, { x: -lastTravel.x, y: -lastTravel.y });
    scene.add({
      kind: "marker",
      owner: `${edge.id}:end-arrow`,
      at: marker,
      char: arrowCharacter(lastTravel, useAscii),
    });
    points = replaceEndpoint(points, points.length - 1, marker);
  }

  if (edge.style === "solid") {
    scene.add({ kind: "stroke", owner: edge.id, points, role: "border" });
  } else {
    writeStyledEdge(scene, edge, points, useAscii);
  }

  if (edge.label && edge.labelPosition) {
    scene.add({
      kind: "label",
      owner: `${edge.id}:label`,
      at: edge.labelPosition,
      text: edge.label,
      width: edge.labelWidth,
    });
  }
};

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
    Array.from({ length: maxY - minY + 1 }, (_, y) => canvas[minX + x]![minY + y]!),
  );
};

const renderLayout = (
  layout: GridLayout,
  options: LayeredMermaidRenderOptions,
) => {
  const scene = new CharScene(layout.width + 1, layout.height + 1, options.useAscii);

  for (const group of layout.groups) {
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
  }

  for (const edge of layout.edges) drawEdge(scene, edge, options.useAscii);

  for (const node of layout.nodes) {
    const shapeOptions = {
      useAscii: options.useAscii,
      padding: options.boxBorderPadding,
    };
    const dimensions = getShapeDimensions(node.shape, node.label, shapeOptions);
    writeShape(
      scene,
      renderShape(node.shape, node.label, shapeOptions),
      node,
      node.id,
      dimensions.labelArea,
    );
  }

  return canvasToString(cropCanvas(scene.compose().canvas));
};

export const renderLayeredMermaid = async (
  parsed: MermaidGraph,
  options: LayeredMermaidRenderOptions,
) => {
  const graph = toLayoutGraph(parsed, options);
  const layout = await getDefaultGraphLayoutEngine().layout(graph);
  const errors = validateGridLayout(layout);
  if (errors.length > 0) throw new Error(errors[0]);
  return renderLayout(layout, options);
};
