import { getTextCellWidth } from "@chardesk/protocol";
import { parseClassDiagram } from "../vendor/class/parser.js";
import type {
  ClassMember,
  ClassRelationship,
  RelationshipType,
} from "../vendor/class/types.js";
import { splitLines } from "../vendor/ascii/multiline-utils.js";
import type { CharScene } from "../vendor/ascii/scene.js";
import type { AsciiConfig, Canvas } from "../vendor/ascii/types.js";
import type {
  GridPoint,
  LayoutGraph,
  PositionedEdgeEndpoint,
} from "./model.js";
import {
  createLayoutLabel,
  createMultiBoxCanvas,
  drawMultiBoxFragment,
} from "./presentation.js";
import {
  renderLayeredDiagram,
  renderLayeredDiagramSurface,
  type LayeredDiagramPresentation,
  type LayeredEndpointPainter,
  type LayeredEndpointPresentation,
} from "./render.js";

interface ClassNodeVisual {
  canvas: Canvas;
}

interface ClassEdgeVisual {
  relationship: ClassRelationship;
  sourceLogicalEnd: "from" | "to";
  targetLogicalEnd: "from" | "to";
}

const nodeId = (id: string) => `class:${id}`;
const groupId = (name: string) => `namespace:${name}`;

const formatMember = (member: ClassMember) => {
  const visibility = member.visibility || "";
  const params = member.isMethod ? `(${member.params ?? ""})` : "";
  const type = member.type ? `: ${member.type}` : "";
  return `${visibility}${member.name}${params}${type}`;
};

const buildClassSections = (node: ReturnType<typeof parseClassDiagram>["classes"][number]) => {
  const header = [
    ...(node.annotation ? [`<<${node.annotation}>>`] : []),
    ...splitLines(node.label),
  ];
  const attributes = node.attributes.map(formatMember);
  const methods = node.methods.map(formatMember);
  if (attributes.length === 0 && methods.length === 0) return [header];
  if (methods.length === 0) return [header, attributes];
  return [header, attributes, methods];
};

const travelTowardNode = (endpoint: PositionedEdgeEndpoint): GridPoint => ({
  x: -endpoint.outward.x,
  y: -endpoint.outward.y,
});

const directionalMarker = (
  relationship: RelationshipType,
  travel: GridPoint,
  useAscii: boolean,
) => {
  if (relationship === "composition") return useAscii ? "*" : "◆";
  if (relationship === "aggregation") return useAscii ? "o" : "◇";
  const horizontal = travel.x > 0 ? ">" : travel.x < 0 ? "<" : undefined;
  return horizontal ?? (travel.y > 0 ? "v" : "^");
};

const cardinalityFor = (
  relationship: ClassRelationship,
  logicalEnd: "from" | "to",
) => logicalEnd === "from"
  ? relationship.fromCardinality
  : relationship.toCardinality;

const markerFor = (
  relationship: ClassRelationship,
  logicalEnd: "from" | "to",
) => relationship.markerAt === logicalEnd;

const paintCardinality = (
  scene: CharScene,
  edgeId: string,
  endpoint: PositionedEdgeEndpoint,
  text: string,
) => {
  const lines = text.split("\n");
  const at = endpoint.side === "left" || endpoint.side === "right"
    ? { x: endpoint.marker.x, y: Math.max(0, endpoint.marker.y - lines.length) }
    : { x: endpoint.marker.x + 2, y: endpoint.marker.y };
  for (const [index, line] of lines.entries()) {
    scene.add({
      kind: "label",
      owner: `${edgeId}:cardinality:${index}`,
      at: { x: at.x, y: at.y + index },
      text: line,
      width: getTextCellWidth(line),
      styleRole: "edge.label",
    });
  }
};

const endpointPresentation = (
  relationship: ClassRelationship,
  logicalEnd: "from" | "to",
): LayeredEndpointPresentation | undefined => {
  const hasMarker = markerFor(relationship, logicalEnd);
  const cardinality = cardinalityFor(relationship, logicalEnd);
  if (!hasMarker && !cardinality) return undefined;
  const paint: LayeredEndpointPainter = (scene, context) => {
    if (hasMarker) {
      scene.add({
        kind: "marker",
        owner: `${context.edge.id}:${context.end}-uml-marker`,
        at: context.endpoint.marker,
        char: directionalMarker(
          relationship.type,
          travelTowardNode(context.endpoint),
          context.useAscii,
        ),
      });
    }
    if (cardinality) {
      paintCardinality(scene, context.edge.id, context.endpoint, cardinality);
    }
  };
  return { trimAnchor: hasMarker, paint };
};

export const createLayeredClassDiagram = (
  text: string,
  config: AsciiConfig,
): { graph: LayoutGraph; presentation: LayeredDiagramPresentation } | undefined => {
  const lines = text.split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("%%"));
  const diagram = parseClassDiagram(lines);
  if (diagram.classes.length === 0) return undefined;

  const namespaceOwners = new Map<string, string>();
  const groups = diagram.namespaces.map((namespace) => {
    const id = groupId(namespace.name);
    for (const classId of namespace.classIds) namespaceOwners.set(classId, id);
    return { id, label: namespace.name };
  });
  const nodeVisuals = new Map<string, ClassNodeVisual>();
  const nodes = diagram.classes.map((node) => {
    const id = nodeId(node.id);
    const canvas = createMultiBoxCanvas(buildClassSections(node), config.useAscii);
    nodeVisuals.set(id, { canvas });
    return {
      id,
      label: node.label,
      width: canvas.length,
      height: canvas[0]?.length ?? 1,
      parentId: namespaceOwners.get(node.id),
      portPlacement: "distributed" as const,
    };
  });

  const edgeVisuals = new Map<string, ClassEdgeVisual>();
  const edges = diagram.relationships.map((relationship, index) => {
    const id = `class-edge:${index}`;
    const hierarchical = relationship.type === "inheritance" ||
      relationship.type === "realization";
    const parent = relationship.markerAt === "from"
      ? relationship.from
      : relationship.to;
    const child = relationship.markerAt === "from"
      ? relationship.to
      : relationship.from;
    const source = hierarchical ? parent : relationship.from;
    const target = hierarchical ? child : relationship.to;
    const sourceLogicalEnd = source === relationship.from ? "from" : "to";
    const targetLogicalEnd = target === relationship.from ? "from" : "to";
    edgeVisuals.set(id, { relationship, sourceLogicalEnd, targetLogicalEnd });
    return {
      id,
      source: nodeId(source),
      target: nodeId(target),
      label: createLayoutLabel(relationship.label),
      labelLayout: "route" as const,
    };
  });

  const graph: LayoutGraph = {
    direction: "TD",
    spacing: {
      nodeNode: Math.max(3, config.paddingX),
      nodeNodeBetweenLayers: Math.max(3, config.paddingY),
    },
    nodes,
    edges,
    groups,
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
      });
      scene.add({
        kind: "label",
        owner: `${group.id}:label`,
        at: { x: group.x + 1, y: group.y },
        text: group.label,
        width: getTextCellWidth(group.label),
        styleRole: "container.title",
      });
    },
    drawNode(scene, node) {
      const visual = nodeVisuals.get(node.id);
      if (!visual) throw new Error(`Missing presentation for class ${node.id}`);
      drawMultiBoxFragment(
        scene,
        visual.canvas,
        node,
        node.id,
        config.useAscii,
      );
    },
    edge(edge) {
      const visual = edgeVisuals.get(edge.id);
      if (!visual) throw new Error(`Missing presentation for class edge ${edge.id}`);
      const dotted = visual.relationship.type === "dependency" ||
        visual.relationship.type === "realization";
      return {
        stroke: {
          style: dotted ? "dotted" : "solid",
          role: dotted ? "line" : "border",
          rounded: true,
        },
        sourceEndpoint: endpointPresentation(
          visual.relationship,
          visual.sourceLogicalEnd,
        ),
        targetEndpoint: endpointPresentation(
          visual.relationship,
          visual.targetLogicalEnd,
        ),
      };
    },
  };
  return { graph, presentation };
};

export const renderLayeredClass = async (text: string, config: AsciiConfig) => {
  const diagram = createLayeredClassDiagram(text, config);
  if (!diagram) return "";
  return renderLayeredDiagram(diagram.graph, diagram.presentation, config);
};

export const renderLayeredClassSurface = async (text: string, config: AsciiConfig) => {
  const diagram = createLayeredClassDiagram(text, config);
  if (!diagram) return { canvas: [], styleRoleCanvas: [] };
  return renderLayeredDiagramSurface(diagram.graph, diagram.presentation, config);
};
