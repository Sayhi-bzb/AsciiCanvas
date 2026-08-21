import type {
  ELK,
  ElkExtendedEdge,
  ElkGraphElement,
  ElkNode,
  ElkPoint,
} from "elkjs/lib/elk-api.js";
import { quantizeCoordinate, quantizeRoute } from "./quantize.js";
import type {
  GridLayout,
  GridPoint,
  LayoutDirection,
  LayoutGraph,
  LayoutNode,
  PositionedLayoutNode,
} from "./model.js";

const directionMap: Record<LayoutDirection, string> = {
  TD: "DOWN",
  TB: "DOWN",
  LR: "RIGHT",
  BT: "UP",
  RL: "LEFT",
};

const rootOptions = (
  direction: LayoutDirection,
  spacing: LayoutGraph["spacing"],
) => ({
  "elk.algorithm": "layered",
  "elk.direction": directionMap[direction],
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.hierarchyHandling": "INCLUDE_CHILDREN",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
  "elk.spacing.nodeNode": String(spacing.nodeNode),
  "elk.spacing.edgeNode": "1",
  "elk.spacing.edgeEdge": "1",
  "elk.spacing.componentComponent": "4",
  "elk.layered.spacing.edgeNodeBetweenLayers": "1",
  "elk.layered.spacing.edgeEdgeBetweenLayers": "1",
  "elk.layered.spacing.nodeNodeBetweenLayers": String(spacing.nodeNodeBetweenLayers),
  "elk.padding": "[top=1,left=1,bottom=1,right=1]",
  "elk.separateConnectedComponents": "true",
});

const rankOptions = (node: LayoutNode) => node.rankConstraint
  ? { "elk.layered.layering.layerConstraint": node.rankConstraint.toUpperCase() }
  : undefined;

const label = (id: string, text: string, width: number) => ({
  id,
  text,
  width,
  height: 1,
});

const toElkGraph = (graph: LayoutGraph): ElkNode => {
  const directNodes = new Map<string | undefined, LayoutNode[]>();
  for (const node of graph.nodes) {
    const siblings = directNodes.get(node.parentId) ?? [];
    siblings.push(node);
    directNodes.set(node.parentId, siblings);
  }

  const directGroups = new Map<string | undefined, typeof graph.groups>();
  for (const group of graph.groups) {
    const siblings = directGroups.get(group.parentId) ?? [];
    siblings.push(group);
    directGroups.set(group.parentId, siblings);
  }

  const groupParents = new Map(graph.groups.map((group) => [group.id, group.parentId]));
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const ancestors = (parentId: string | undefined) => {
    const result: Array<string | undefined> = [];
    let current = parentId;
    while (current !== undefined) {
      result.push(current);
      current = groupParents.get(current);
    }
    result.push(undefined);
    return result;
  };
  const edgeContainer = (source: string, target: string) => {
    const sourceAncestors = ancestors(nodesById.get(source)?.parentId);
    const targetAncestors = new Set(ancestors(nodesById.get(target)?.parentId));
    return sourceAncestors.find((candidate) => targetAncestors.has(candidate));
  };
  const directEdges = new Map<string | undefined, ElkExtendedEdge[]>();
  for (const edge of graph.edges) {
    const elkEdge: ElkExtendedEdge = {
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
      labels: edge.label
        ? [label(`${edge.id}:label`, edge.label, edge.labelWidth)]
        : undefined,
    };
    const container = edgeContainer(edge.source, edge.target);
    const siblings = directEdges.get(container) ?? [];
    siblings.push(elkEdge);
    directEdges.set(container, siblings);
  }

  const childrenFor = (parentId?: string): ElkNode[] => [
    ...(directGroups.get(parentId) ?? []).map((group): ElkNode => ({
      id: group.id,
      labels: [label(`${group.id}:label`, group.label, group.label.length)],
      children: childrenFor(group.id),
      edges: directEdges.get(group.id),
      layoutOptions: {
        ...rootOptions(graph.direction, graph.spacing),
        "elk.padding": "[top=2,left=2,bottom=2,right=2]",
      },
    })),
    ...(directNodes.get(parentId) ?? []).map((node): ElkNode => ({
      id: node.id,
      width: node.width,
      height: node.height,
      layoutOptions: rankOptions(node),
    })),
  ];

  return {
    id: "layout:root",
    children: childrenFor(undefined),
    edges: directEdges.get(undefined),
    layoutOptions: rootOptions(graph.direction, graph.spacing),
  };
};

const appendPoint = (points: GridPoint[], point: GridPoint) => {
  const previous = points.at(-1);
  if (!previous || previous.x !== point.x || previous.y !== point.y) points.push(point);
};

const appendOrthogonalPoint = (points: GridPoint[], point: GridPoint) => {
  const previous = points.at(-1);
  if (previous && previous.x !== point.x && previous.y !== point.y) {
    appendPoint(points, { x: point.x, y: previous.y });
  }
  appendPoint(points, point);
};

const attachmentPoint = (
  node: PositionedLayoutNode,
  travel: GridPoint,
  target: boolean,
): GridPoint => {
  const center = {
    x: node.x + Math.floor((node.width - 1) / 2),
    y: node.y + Math.floor((node.height - 1) / 2),
  };
  if (travel.x !== 0) {
    return {
      x: (travel.x > 0) !== target ? node.x + node.width - 1 : node.x,
      y: center.y,
    };
  }
  return {
    x: center.x,
    y: (travel.y > 0) !== target ? node.y + node.height - 1 : node.y,
  };
};

const simplifyOrthogonal = (points: GridPoint[]) => points.filter((point, index, values) => {
  if (index === 0 || index === values.length - 1) return true;
  const previous = values[index - 1]!;
  const next = values[index + 1]!;
  return !(
    (previous.x === point.x && point.x === next.x) ||
    (previous.y === point.y && point.y === next.y)
  );
});

const withNodeAttachments = (
  points: GridPoint[],
  source: PositionedLayoutNode,
  target: PositionedLayoutNode,
): GridPoint[] => {
  if (points.length < 2) return [];
  const firstTravel = {
    x: Math.sign(points[1]!.x - points[0]!.x),
    y: Math.sign(points[1]!.y - points[0]!.y),
  };
  const lastTravel = {
    x: Math.sign(points.at(-1)!.x - points.at(-2)!.x),
    y: Math.sign(points.at(-1)!.y - points.at(-2)!.y),
  };
  const routed = [...points];
  routed[0] = attachmentPoint(source, firstTravel, false);
  routed[routed.length - 1] = attachmentPoint(target, lastTravel, true);
  const result: GridPoint[] = [];
  for (const point of routed) appendOrthogonalPoint(result, point);
  return simplifyOrthogonal(result);
};

const routeLabelPosition = (
  points: GridPoint[],
  labelWidth: number,
): GridPoint | undefined => {
  let best: { from: GridPoint; to: GridPoint; length: number } | undefined;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!;
    const to = points[index]!;
    const length = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
    if (!best || length > best.length) best = { from, to, length };
  }
  if (!best) return undefined;
  if (best.from.y === best.to.y) {
    return {
      x: Math.floor((best.from.x + best.to.x - labelWidth) / 2),
      y: best.from.y,
    };
  }
  return {
    x: best.from.x - labelWidth - 1,
    y: Math.floor((best.from.y + best.to.y) / 2),
  };
};

const edgePoints = (edge: ElkExtendedEdge, offset: GridPoint): ElkPoint[] => {
  const section = edge.sections?.[0];
  if (!section) return [];
  return [section.startPoint, ...(section.bendPoints ?? []), section.endPoint]
    .map((point) => ({ x: point.x + offset.x, y: point.y + offset.y }));
};

const labelPosition = (
  edge: ElkGraphElement,
  offset: GridPoint,
): GridPoint | undefined => {
  const first = edge.labels?.[0];
  if (first?.x === undefined || first.y === undefined) return undefined;
  return {
    x: offset.x + quantizeCoordinate(first.x),
    y: offset.y + quantizeCoordinate(first.y),
  };
};

export const layoutWithElk = async (
  graph: LayoutGraph,
  elk: ELK,
): Promise<GridLayout> => {
  const laidOut = await elk.layout(toElkGraph(graph));
  const modelNodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const modelGroups = new Map(graph.groups.map((group) => [group.id, group]));
  const nodes: PositionedLayoutNode[] = [];
  const groups: GridLayout["groups"] = [];
  const positionedEdges: Array<{ edge: ElkExtendedEdge; offset: GridPoint }> =
    (laidOut.edges ?? []).map((edge) => ({ edge, offset: { x: 0, y: 0 } }));

  const visit = (children: ElkNode[] | undefined, offset: GridPoint) => {
    for (const child of children ?? []) {
      const x = offset.x + quantizeCoordinate(child.x);
      const y = offset.y + quantizeCoordinate(child.y);
      const modelNode = modelNodes.get(child.id);
      const modelGroup = modelGroups.get(child.id);
      if (modelNode) {
        nodes.push({ ...modelNode, x, y });
      } else if (modelGroup) {
        groups.push({
          ...modelGroup,
          x,
          y,
          width: Math.max(1, quantizeCoordinate(child.width)),
          height: Math.max(1, quantizeCoordinate(child.height)),
        });
      }
      for (const edge of child.edges ?? []) {
        positionedEdges.push({ edge, offset: { x, y } });
      }
      visit(child.children, { x, y });
    }
  };
  visit(laidOut.children, { x: 0, y: 0 });

  const positionedById = new Map(nodes.map((node) => [node.id, node]));
  const modelEdges = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const edges = positionedEdges.flatMap(({ edge, offset }) => {
    const modelEdge = modelEdges.get(edge.id);
    const source = modelEdge && positionedById.get(modelEdge.source);
    const target = modelEdge && positionedById.get(modelEdge.target);
    if (!modelEdge || !source || !target) return [];
    const points = withNodeAttachments(
      quantizeRoute(edgePoints(edge, offset)),
      source,
      target,
    );
    return [{
      ...modelEdge,
      points,
      labelPosition: modelEdge.label
        ? routeLabelPosition(points, modelEdge.labelWidth) ?? labelPosition(edge, offset)
        : undefined,
    }];
  });

  const maxX = Math.max(
    quantizeCoordinate(laidOut.width),
    ...nodes.map((node) => node.x + node.width),
    ...groups.map((group) => group.x + group.width),
    ...edges.flatMap((edge) => edge.points.map((point) => point.x + 1)),
  );
  const maxY = Math.max(
    quantizeCoordinate(laidOut.height),
    ...nodes.map((node) => node.y + node.height),
    ...groups.map((group) => group.y + group.height),
    ...edges.flatMap((edge) => edge.points.map((point) => point.y + 1)),
  );

  return { width: maxX, height: maxY, nodes, edges, groups };
};
