import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataSecurityDialog } from "./data-security-dialog";
import { useEditorStore } from "@/domains/canvas/testing";

describe("DataSecurityDialog", () => {
  it("states the local-first data boundary without overstating offline support", () => {
    render(<DataSecurityDialog open onOpenChange={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "Data security" });
    expect(dialog).toHaveTextContent("Stored here");
    expect(dialog).toHaveTextContent("No analytics");
    expect(dialog).toHaveTextContent("Local transfers");
    expect(dialog).toHaveTextContent("Local storage is not encrypted");
    expect(dialog).not.toHaveTextContent("offline");
    expect(dialog).not.toHaveTextContent("URL");
    expect(dialog.querySelectorAll("h3")).toHaveLength(0);
    expect(dialog.querySelector('[class*="bg-accent/"]')).not.toBeInTheDocument();
    expect(dialog.querySelector(".border-accent")).not.toBeInTheDocument();
  });

  it("replaces local-only claims with the active P2P data boundary", () => {
    const state = useEditorStore.getState();
    state.setCanvasSessionCollaboration(state.activeCanvasId, {
      version: 2,
      documentVersion: 2,
      mode: "freeform",
      provider: "p2p",
      roomId: "room_identifier_1234",
      key: "room_secret_key_123456789012345678901234567890",
    });

    render(<DataSecurityDialog open onOpenChange={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "Data security" });
    expect(dialog).toHaveTextContent("Peer-to-peer room");
    expect(dialog).toHaveTextContent("encrypted signaling and WebRTC");
    expect(dialog).toHaveTextContent("Anyone with the edit link can edit");
    expect(dialog).not.toHaveTextContent("No analytics");

    useEditorStore.getState().setCanvasSessionCollaboration(state.activeCanvasId, null);
  });
});
