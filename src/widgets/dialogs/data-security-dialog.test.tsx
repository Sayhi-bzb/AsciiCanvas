import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataSecurityDialog } from "./data-security-dialog";
import { useEditorStore } from "@/domains/canvas/public";

describe("DataSecurityDialog", () => {
  it("states the local-first data boundary without overstating offline support", () => {
    render(<DataSecurityDialog open onOpenChange={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "Data security" });
    expect(dialog).toHaveTextContent("Stored locally");
    expect(dialog).toHaveTextContent("No uploads or analytics");
    expect(dialog).toHaveTextContent("You control transfers");
    expect(dialog).toHaveTextContent("Local storage is not encrypted");
    expect(dialog).not.toHaveTextContent("offline");
    expect(dialog).not.toHaveTextContent("URL");
  });

  it("replaces local-only claims with the active P2P data boundary", () => {
    const state = useEditorStore.getState();
    state.setCanvasSessionCollaboration(state.activeCanvasId, {
      version: 1,
      provider: "p2p",
      roomId: "room_identifier_1234",
      key: "room_secret_key_123456789012345678901234567890",
    });

    render(<DataSecurityDialog open onOpenChange={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "Data security" });
    expect(dialog).toHaveTextContent("Peer-to-peer room");
    expect(dialog).toHaveTextContent("encrypted WebRTC channels");
    expect(dialog).toHaveTextContent("Anyone with the edit link can edit");
    expect(dialog).not.toHaveTextContent("No uploads or analytics");

    useEditorStore.getState().setCanvasSessionCollaboration(state.activeCanvasId, null);
  });
});
