import { useCanvasState } from "@/domains/canvas/public";
import { useCollaborationSnapshot } from "./useCollaborationSnapshot";
import { CELL_HEIGHT, CELL_WIDTH } from "@/shared/lib/constants";

export function RemotePresenceOverlay() {
  const { peers } = useCollaborationSnapshot();
  const offset = useCanvasState((state) => state.offset);
  const zoom = useCanvasState((state) => state.zoom);

  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden" aria-hidden="true">
      {peers.map((peer) => peer.cursor && (
        <div
          key={peer.clientId}
          className="absolute transition-transform duration-75 ease-out"
          style={{ transform: `translate(${offset.x + peer.cursor.x * CELL_WIDTH * zoom}px, ${offset.y + peer.cursor.y * CELL_HEIGHT * zoom}px)` }}
        >
          <div className="h-4 w-0.5" style={{ backgroundColor: peer.color }} />
          <span className="ml-1 whitespace-nowrap rounded-sm px-1 py-0.5 text-[10px] text-white" style={{ backgroundColor: peer.color }}>
            {peer.name}
          </span>
        </div>
      ))}
    </div>
  );
}
