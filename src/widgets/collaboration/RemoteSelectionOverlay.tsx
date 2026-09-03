import { useCanvasState } from "@/domains/canvas/public";
import type { CanvasMode } from "@/domains/sessions/public";
import type { StructuredNode } from "@/domains/structured-content/public";
import { CELL_HEIGHT, CELL_WIDTH } from "@/shared/lib/constants";
import type { Point } from "@/shared/types";
import { useCanvasLiveViewportOptional } from "@/widgets/canvas-editor/engine/CanvasWorkspace";
import {
  resolveRemoteSelectionVisuals,
  type RemotePeer,
} from "./remoteSelectionGeometry";
import { useCollaborationSnapshot } from "./useCollaborationSnapshot";

const createPreviewPeers = ({
  canvasMode,
  structuredScene,
  viewport,
}: {
  canvasMode: CanvasMode;
  structuredScene: StructuredNode[];
  viewport: { offset: Point; zoom: number };
}): RemotePeer[] => {
  if (canvasMode === "structured") {
    const identities = [
      { name: "Ada", color: "#0969da" },
      { name: "Lin", color: "#bf3989" },
      { name: "Kai", color: "#1a7f37" },
    ] as const;
    return structuredScene.slice(0, 3).map((node, index) => ({
      clientId: -(index + 1),
      name: identities[index].name,
      color: identities[index].color,
      selection: { mode: "structured", nodeIds: [node.id] },
    }));
  }
  if (canvasMode !== "freeform") return [];
  const screenToGrid = (point: Point): Point => ({
    x: Math.floor((point.x - viewport.offset.x) / (CELL_WIDTH * viewport.zoom)),
    y: Math.floor((point.y - viewport.offset.y) / (CELL_HEIGHT * viewport.zoom)),
  });
  const width = typeof window === "undefined" ? 1024 : window.innerWidth;
  const height = typeof window === "undefined" ? 768 : window.innerHeight;
  const cell = screenToGrid({ x: width * 0.2, y: height * 0.25 });
  const rangeStart = screenToGrid({ x: width * 0.42, y: height * 0.42 });
  const overlapStart = screenToGrid({ x: width * 0.58, y: height * 0.52 });
  return [
    {
      clientId: -1,
      name: "Ada",
      color: "#0969da",
      selection: { mode: "freeform", areas: [{ start: cell, end: cell }] },
    },
    {
      clientId: -2,
      name: "Lin",
      color: "#bf3989",
      selection: {
        mode: "freeform",
        areas: [{ start: rangeStart, end: { x: rangeStart.x + 9, y: rangeStart.y + 3 } }],
      },
    },
    {
      clientId: -3,
      name: "Kai",
      color: "#1a7f37",
      selection: {
        mode: "freeform",
        areas: [{ start: overlapStart, end: { x: overlapStart.x + 7, y: overlapStart.y + 2 } }],
      },
    },
  ];
};

export function RemoteSelectionOverlay() {
  const { peers } = useCollaborationSnapshot();
  const liveViewport = useCanvasLiveViewportOptional();
  const storeOffset = useCanvasState((state) => state.offset);
  const storeZoom = useCanvasState((state) => state.zoom);
  const canvasMode = useCanvasState((state) => state.canvasMode);
  const grid = useCanvasState((state) => state.grid);
  const structuredScene = useCanvasState((state) => state.structuredScene);
  const viewport = {
    offset: liveViewport?.offset ?? storeOffset,
    zoom: liveViewport?.zoom ?? storeZoom,
  };
  const previewParams = typeof window === "undefined"
    ? null
    : new URLSearchParams(window.location.search);
  const previewEnabled = import.meta.env.DEV
    && (previewParams?.get("collaboration-selections") === "preview"
      || previewParams?.get("collaboration-cursors") === "preview");
  const visiblePeers = previewEnabled
    ? createPreviewPeers({ canvasMode, structuredScene, viewport })
    : peers;
  const visuals = resolveRemoteSelectionVisuals({
    peers: visiblePeers,
    canvasMode,
    grid,
    structuredScene,
    viewport,
  });

  return (
    <div
      className="pointer-events-none absolute inset-0 z-(--layer-presence) overflow-hidden"
      aria-hidden="true"
    >
      <svg className="absolute inset-0 size-full">
        {visuals.map((visual) => (
          <path
            key={visual.clientId}
            d={visual.path}
            fill="none"
            stroke={visual.color}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      {visuals.map((visual) => (
        <span
          key={visual.clientId}
          className="absolute whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none text-presence-label-foreground shadow-xs"
          style={{
            backgroundColor: visual.color,
            transform: `translate3d(${Math.max(2, visual.anchor.x)}px, ${Math.max(16, visual.anchor.y) - 16}px, 0)`,
          }}
        >
          {visual.name}
        </span>
      ))}
    </div>
  );
}
