import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CharLibrary } from "@/domains/character-library";
import { useLibraryStore } from "@/domains/character-library/stores/useLibraryStore";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { writeClipboardPayload } from "@/domains/actions/adapters/clipboardActions";
import { feedback } from "@/shared/services/effects";
import { SidebarProvider } from "@/shared/ui/sidebar";

vi.mock("@/domains/actions/adapters/clipboardActions", () => ({
  writeClipboardPayload: vi.fn(),
}));

vi.mock("@/shared/services/effects", () => ({
  feedback: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("CharLibrary", () => {
  const initialCanvasState = useCanvasStore.getState();
  const initialLibraryState = useLibraryStore.getState();

  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    useCanvasStore.setState(initialCanvasState, true);
    useLibraryStore.setState(initialLibraryState, true);
  });

  it("copies selected characters to the clipboard instead of activating brush", async () => {
    vi.mocked(writeClipboardPayload).mockResolvedValue(true);
    useCanvasStore.setState({
      brushChar: "#",
      brushColor: "#123456",
      tool: "select",
    });
    useLibraryStore.setState({
      data: {
        entities: {},
        related: {},
        boxDrawing: {},
        nerdfonts: {
          Symbols: [{ name: "star icon", char: "★" }],
        },
        emojis: {},
        characterLabels: { "★": "star icon" },
      },
      isLoading: false,
      error: null,
      searchQuery: "star",
      searchResults: ["★"],
    });

    render(
      <SidebarProvider>
        <CharLibrary />
      </SidebarProvider>
    );
    const starButton = screen.getByRole("button", { name: /star icon/i });

    fireEvent.click(starButton);

    await waitFor(() => expect(writeClipboardPayload).toHaveBeenCalledTimes(1));
    const [payload, options] = vi.mocked(writeClipboardPayload).mock.calls[0];
    expect(payload.plain).toBe("★");
    expect(JSON.parse(payload.rich!)).toEqual({
      type: "ascii-metropolis-zone",
      version: 1,
      cells: [{ x: 0, y: 0, char: "★", color: "#123456" }],
    });
    expect(options).toEqual({ withRich: true });
    expect(useCanvasStore.getState().tool).toBe("select");
    expect(useCanvasStore.getState().brushChar).toBe("#");
    expect(feedback.success).toHaveBeenCalledWith("Copied: ★", {
      duration: 600,
      position: "top-right",
    });
    await waitFor(() => expect(starButton).toHaveClass("bg-primary"));
  });
});
