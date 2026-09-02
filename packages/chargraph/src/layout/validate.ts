import type {
  GridLayout,
  GridPoint,
  GridRect,
  LayoutLabel,
  PositionedEdgeEndpoint,
  PositionedLayoutEdge,
  PositionedLayoutNode,
} from "./model.js";

const containsInterior = (rect: GridRect, point: GridPoint) =>
  point.x > rect.x &&
  point.x < rect.x + rect.width - 1 &&
  point.y > rect.y &&
  point.y < rect.y + rect.height - 1;

const overlaps = (first: GridRect, second: GridRect) =>
  first.x < second.x + second.width &&
  first.x + first.width > second.x &&
  first.y < second.y + second.height &&
  first.y + first.height > second.y;

const containsRect = (parent: GridRect, child: GridRect) =>
  child.x >= parent.x &&
  child.y >= parent.y &&
  child.x + child.width <= parent.x + parent.width &&
  child.y + child.height <= parent.y + parent.height;

const groupInterior = (group: GridRect): GridRect => ({
  x: group.x + 1,
  y: group.y + 1,
  width: Math.max(0, group.width - 2),
  height: Math.max(0, group.height - 2),
});

const pointEquals = (left: GridPoint, right: GridPoint) =>
  left.x === right.x && left.y === right.y;

const containsPoint = (rect: GridRect, point: GridPoint) =>
  point.x >= rect.x &&
  point.x < rect.x + rect.width &&
  point.y >= rect.y &&
  point.y < rect.y + rect.height;

const onRectBoundary = (rect: GridRect, point: GridPoint) =>
  containsPoint(rect, point) && (
    point.x === rect.x ||
    point.x === rect.x + rect.width - 1 ||
    point.y === rect.y ||
    point.y === rect.y + rect.height - 1
  );

const onBoundary = (node: PositionedLayoutNode, point: GridPoint) => {
  const withinX = point.x >= node.x && point.x < node.x + node.width;
  const withinY = point.y >= node.y && point.y < node.y + node.height;
  return withinX && withinY && (
    point.x === node.x ||
    point.x === node.x + node.width - 1 ||
    point.y === node.y ||
    point.y === node.y + node.height - 1
  );
};

const validateEndpoint = (
  edgeId: string,
  endpoint: PositionedEdgeEndpoint,
  node: PositionedLayoutNode | undefined,
  neighbor: GridPoint | undefined,
) => {
  if (!node) return [`Edge ${edgeId} references a missing endpoint node`];
  const errors: string[] = [];
  if (!onBoundary(node, endpoint.anchor)) {
    errors.push(`Edge ${edgeId} anchor is not on node ${node.id}`);
  }
  const expectedMarker = {
    x: endpoint.anchor.x + endpoint.outward.x,
    y: endpoint.anchor.y + endpoint.outward.y,
  };
  if (!pointEquals(endpoint.marker, expectedMarker)) {
    errors.push(`Edge ${edgeId} marker is not adjacent to node ${node.id}`);
  }
  if (onBoundary(node, endpoint.marker) || containsInterior(node, endpoint.marker)) {
    errors.push(`Edge ${edgeId} marker overlaps node ${node.id}`);
  }
  if (neighbor) {
    const travel = {
      x: Math.sign(neighbor.x - endpoint.anchor.x),
      y: Math.sign(neighbor.y - endpoint.anchor.y),
    };
    if (!pointEquals(travel, endpoint.outward)) {
      errors.push(`Edge ${edgeId} terminal segment is not perpendicular to node ${node.id}`);
    }
  }
  return errors;
};

const segmentPoints = (from: GridPoint, to: GridPoint): GridPoint[] => {
  if (from.x !== to.x && from.y !== to.y) return [];
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  const result: GridPoint[] = [];
  let current = { ...from };
  while (current.x !== to.x || current.y !== to.y) {
    result.push(current);
    current = { x: current.x + dx, y: current.y + dy };
  }
  result.push(to);
  return result;
};

const rectCellKeys = (rect: GridRect) => {
  const result: string[] = [];
  for (let x = rect.x; x < rect.x + rect.width; x += 1) {
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      result.push(`${x},${y}`);
    }
  }
  return result;
};

type RouteAxis = "horizontal" | "vertical";

const routeAxes = (edge: PositionedLayoutEdge) => {
  const result = new Map<string, Set<RouteAxis>>();
  for (let index = 1; index < edge.points.length; index += 1) {
    const from = edge.points[index - 1]!;
    const to = edge.points[index]!;
    if (from.x !== to.x && from.y !== to.y) continue;
    const axis: RouteAxis = from.y === to.y ? "horizontal" : "vertical";
    for (const point of segmentPoints(from, to)) {
      const key = `${point.x},${point.y}`;
      const axes = result.get(key) ?? new Set<RouteAxis>();
      axes.add(axis);
      result.set(key, axes);
    }
  }
  return result;
};

const mustRemainIndependent = (
  first: PositionedLayoutEdge,
  second: PositionedLayoutEdge,
) => first.routing?.topology === "independent" ||
  second.routing?.topology === "independent";

const markerCellKeys = (
  endpoint: PositionedEdgeEndpoint,
  clearance = 0,
) => Array.from({ length: clearance }, (_, index) => {
  const distance = index + 1;
  return `${endpoint.anchor.x + endpoint.outward.x * distance},${
    endpoint.anchor.y + endpoint.outward.y * distance
  }`;
});

export const validateGridLayout = (layout: GridLayout): string[] => {
  const errors: string[] = [];
  const groups = new Map(layout.groups.map((group) => [group.id, group]));
  const nodes = new Map(layout.nodes.map((node) => [node.id, node]));
  const edgeCellOwners = new Map<string, Set<string>>();
  const axesByEdge = new Map<string, ReturnType<typeof routeAxes>>();
  for (const edge of layout.edges) {
    axesByEdge.set(edge.id, routeAxes(edge));
    for (let index = 1; index < edge.points.length; index += 1) {
      for (const point of segmentPoints(edge.points[index - 1]!, edge.points[index]!)) {
        const key = `${point.x},${point.y}`;
        const owners = edgeCellOwners.get(key) ?? new Set<string>();
        owners.add(edge.id);
        edgeCellOwners.set(key, owners);
      }
    }
  }

  const endpointLabelRects: Array<GridRect & { owner: string }> = [];
  const validateEndpointLabel = (
    edge: PositionedLayoutEdge,
    end: "source" | "target",
    label: LayoutLabel | undefined,
    position: GridPoint | undefined,
  ) => {
    if (!label) return;
    if (!position) {
      errors.push(`Edge ${edge.id} ${end} label has no position`);
      return;
    }
    const rect = { ...position, width: label.width, height: label.height };
    endpointLabelRects.push({ ...rect, owner: `${edge.id}:${end}` });
    const nodeId = end === "source" ? edge.source : edge.target;
    const parentId = nodes.get(nodeId)?.parentId;
    const parent = parentId ? groups.get(parentId) : undefined;
    if (parent && !containsRect(groupInterior(parent), rect)) {
      errors.push(`Edge ${edge.id} ${end} label escapes group ${parent.id}`);
    }
    for (const key of rectCellKeys(rect)) {
      const comma = key.indexOf(",");
      const point = {
        x: Number(key.slice(0, comma)),
        y: Number(key.slice(comma + 1)),
      };
      if (layout.nodes.some((node) => containsPoint(node, point))) {
        errors.push(`Edge ${edge.id} ${end} label overlaps a node`);
        break;
      }
      if (layout.groups.some((group) => onRectBoundary(group, point))) {
        errors.push(`Edge ${edge.id} ${end} label overlaps a group border`);
        break;
      }
      if ((edgeCellOwners.get(key)?.size ?? 0) > 0) {
        errors.push(`Edge ${edge.id} ${end} label overlaps an edge`);
        break;
      }
    }
  };

  for (let index = 0; index < layout.nodes.length; index += 1) {
    const node = layout.nodes[index]!;
    for (let otherIndex = index + 1; otherIndex < layout.nodes.length; otherIndex += 1) {
      const other = layout.nodes[otherIndex]!;
      if (node.parentId === other.id || other.parentId === node.id) continue;
      if (overlaps(node, other)) errors.push(`Nodes ${node.id} and ${other.id} overlap`);
    }
  }

  for (const node of layout.nodes) {
    if (!node.parentId) continue;
    const parent = groups.get(node.parentId);
    if (!parent) errors.push(`Node ${node.id} references missing group ${node.parentId}`);
    else if (!containsRect(parent, node)) {
      errors.push(`Group ${parent.id} does not contain node ${node.id}`);
    }
  }
  for (const group of layout.groups) {
    if (!group.parentId) continue;
    const parent = groups.get(group.parentId);
    if (!parent) errors.push(`Group ${group.id} references missing group ${group.parentId}`);
    else if (!containsRect(parent, group)) {
      errors.push(`Group ${parent.id} does not contain group ${group.id}`);
    }
  }

  for (let index = 0; index < layout.edges.length; index += 1) {
    const edge = layout.edges[index]!;
    for (let otherIndex = index + 1; otherIndex < layout.edges.length; otherIndex += 1) {
      const other = layout.edges[otherIndex]!;
      if (!mustRemainIndependent(edge, other)) continue;

      const endpoints = [
        { node: edge.source, endpoint: edge.sourceEndpoint },
        { node: edge.target, endpoint: edge.targetEndpoint },
      ];
      const otherEndpoints = [
        { node: other.source, endpoint: other.sourceEndpoint },
        { node: other.target, endpoint: other.targetEndpoint },
      ];
      if (endpoints.some((endpoint) => otherEndpoints.some((candidate) =>
        endpoint.node === candidate.node &&
        pointEquals(endpoint.endpoint.anchor, candidate.endpoint.anchor)
      ))) {
        errors.push(`Independent edges ${edge.id} and ${other.id} share a node port`);
      }

      const markerCells = new Set([
        ...markerCellKeys(edge.sourceEndpoint, edge.routing?.sourceClearance),
        ...markerCellKeys(edge.targetEndpoint, edge.routing?.targetClearance),
      ]);
      const otherMarkerCells = [
        ...markerCellKeys(other.sourceEndpoint, other.routing?.sourceClearance),
        ...markerCellKeys(other.targetEndpoint, other.routing?.targetClearance),
      ];
      if (otherMarkerCells.some((key) => markerCells.has(key))) {
        errors.push(`Independent edges ${edge.id} and ${other.id} share marker cells`);
      }

      const axes = axesByEdge.get(edge.id)!;
      const otherAxes = axesByEdge.get(other.id)!;
      if ([...axes].some(([key, values]) => {
        const candidates = otherAxes.get(key);
        return candidates && [...values].some((axis) => candidates.has(axis));
      })) {
        errors.push(`Independent edges ${edge.id} and ${other.id} share collinear route cells`);
      }
    }
  }

  for (const edge of layout.edges) {
    errors.push(...validateEndpoint(
      edge.id,
      edge.sourceEndpoint,
      nodes.get(edge.source),
      edge.points[1],
    ));
    errors.push(...validateEndpoint(
      edge.id,
      edge.targetEndpoint,
      nodes.get(edge.target),
      edge.points.at(-2),
    ));
    validateEndpointLabel(
      edge,
      "source",
      edge.sourceLabel,
      edge.sourceLabelPosition,
    );
    validateEndpointLabel(
      edge,
      "target",
      edge.targetLabel,
      edge.targetLabelPosition,
    );
    for (let index = 1; index < edge.points.length; index += 1) {
      const from = edge.points[index - 1]!;
      const to = edge.points[index]!;
      if (from.x !== to.x && from.y !== to.y) {
        errors.push(`Edge ${edge.id} contains a diagonal segment`);
        continue;
      }
      for (const point of segmentPoints(from, to)) {
        for (const node of layout.nodes) {
          const allowedEndpoint =
            node.id === edge.source && pointEquals(point, edge.sourceEndpoint.anchor) ||
            node.id === edge.target && pointEquals(point, edge.targetEndpoint.anchor);
          if (!allowedEndpoint && containsPoint(node, point)) {
            errors.push(`Edge ${edge.id} crosses node ${node.id}`);
            break;
          }
        }
      }
    }
    if (edge.label && edge.labelPosition) {
      const protectedPoints = new Set(edge.points.map((point) => `${point.x},${point.y}`));
      const ownRouteCells = axesByEdge.get(edge.id) ?? new Map();
      let adjacentToRoute = false;
      for (let x = edge.labelPosition.x; x < edge.labelPosition.x + edge.label.width; x += 1) {
        for (let y = edge.labelPosition.y; y < edge.labelPosition.y + edge.label.height; y += 1) {
          const point = { x, y };
          const key = `${x},${y}`;
          if (protectedPoints.has(key)) {
            errors.push(`Edge ${edge.id} label overlaps a protected route cell`);
          }
          for (const node of layout.nodes) {
            if (containsPoint(node, point)) {
              errors.push(`Edge ${edge.id} label overlaps node ${node.id}`);
              break;
            }
          }
          for (const group of layout.groups) {
            if (onRectBoundary(group, point)) {
              errors.push(`Edge ${edge.id} label overlaps group ${group.id} border`);
              break;
            }
          }
          if ([...(edgeCellOwners.get(key) ?? [])].some((owner) => owner !== edge.id)) {
            errors.push(`Edge ${edge.id} label overlaps another edge`);
          }
          adjacentToRoute ||= [
            key,
            `${x - 1},${y}`,
            `${x + 1},${y}`,
            `${x},${y - 1}`,
            `${x},${y + 1}`,
          ].some((candidate) => ownRouteCells.has(candidate));
        }
      }
      if (
        edge.routing?.topology === "independent" &&
        !adjacentToRoute
      ) {
        errors.push(`Edge ${edge.id} label is detached from its route`);
      }
    }
  }

  const labels: Array<GridRect & { owner: string }> = [
    ...layout.edges.flatMap((edge) => edge.label && edge.labelPosition
      ? [{
          ...edge.labelPosition,
          width: edge.label.width,
          height: edge.label.height,
          owner: edge.id,
        }]
      : []),
    ...endpointLabelRects,
  ];
  for (let index = 0; index < labels.length; index += 1) {
    const label = labels[index]!;
    for (let otherIndex = index + 1; otherIndex < labels.length; otherIndex += 1) {
      const other = labels[otherIndex]!;
      if (overlaps(label, other)) {
        errors.push(`Edge labels ${label.owner} and ${other.owner} overlap`);
      }
    }
  }

  return [...new Set(errors)];
};
