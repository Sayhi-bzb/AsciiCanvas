import type { GridLayout, GridPoint, GridRect } from "./model.js";

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

export const validateGridLayout = (layout: GridLayout): string[] => {
  const errors: string[] = [];
  const groups = new Map(layout.groups.map((group) => [group.id, group]));

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

  for (const edge of layout.edges) {
    for (let index = 1; index < edge.points.length; index += 1) {
      const from = edge.points[index - 1]!;
      const to = edge.points[index]!;
      if (from.x !== to.x && from.y !== to.y) {
        errors.push(`Edge ${edge.id} contains a diagonal segment`);
        continue;
      }
      for (const point of segmentPoints(from, to)) {
        for (const node of layout.nodes) {
          if (node.id === edge.source || node.id === edge.target) continue;
          if (containsInterior(node, point)) {
            errors.push(`Edge ${edge.id} crosses node ${node.id}`);
            break;
          }
        }
      }
    }
  }

  return [...new Set(errors)];
};
