import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/domains/canvas/public";
import { ShortcutProvider } from "@/shared/shortcuts/dispatcher";
import { SlideNavigator } from "./slide-navigator";
import { ZoomControl } from "./zoom-control";

const { warning } = vi.hoisted(() => ({ warning: vi.fn() }));
vi.mock("@/shared/services/effects", () => ({
  feedback: { warning },
}));
vi.mock("@/shared/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

const initialState = useEditorStore.getState();
const originalFullscreenDescriptor = Object.getOwnPropertyDescriptor(
  document,
  "fullscreenElement"
);
const originalRequestFullscreenDescriptor = Object.getOwnPropertyDescriptor(
  document.documentElement,
  "requestFullscreen"
);
const originalExitFullscreenDescriptor = Object.getOwnPropertyDescriptor(
  document,
  "exitFullscreen"
);

describe("ZoomControl slide playback", () => {
  let fullscreenElement: Element | null;
  let requestFullscreen: ReturnType<typeof vi.fn>;
  let exitFullscreen: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fullscreenElement = null;
    warning.mockReset();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    requestFullscreen = vi.fn(async () => {
      fullscreenElement = document.documentElement;
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    exitFullscreen = vi.fn(async () => {
      fullscreenElement = null;
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => fullscreenElement,
    });
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: exitFullscreen,
    });
    useEditorStore.setState({
      canvasMode: "slide",
      slideDeck: {
        size: { columns: 3, rows: 2 },
        activeSlideId: "slide-2",
        slides: [
          { id: "slide-1", name: "First", grid: [] },
          { id: "slide-2", name: "Second", grid: [] },
        ],
      },
    });
  });

  afterEach(() => {
    useEditorStore.setState(initialState, true);
    vi.restoreAllMocks();
    if (originalFullscreenDescriptor) {
      Object.defineProperty(document, "fullscreenElement", originalFullscreenDescriptor);
    } else {
      Reflect.deleteProperty(document, "fullscreenElement");
    }
    if (originalRequestFullscreenDescriptor) {
      Object.defineProperty(
        document.documentElement,
        "requestFullscreen",
        originalRequestFullscreenDescriptor
      );
    } else {
      Reflect.deleteProperty(document.documentElement, "requestFullscreen");
    }
    if (originalExitFullscreenDescriptor) {
      Object.defineProperty(document, "exitFullscreen", originalExitFullscreenDescriptor);
    } else {
      Reflect.deleteProperty(document, "exitFullscreen");
    }
  });

  it("requests fullscreen, starts from the current slide, and closes when fullscreen exits", async () => {
    render(
      <ShortcutProvider>
        <ZoomControl containerSize={{ width: 1000, height: 700 }} />
      </ShortcutProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("slide-playback")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Second" })).toBeInTheDocument();
    expect(useEditorStore.getState().slideDeck?.activeSlideId).toBe("slide-2");

    await act(async () => undefined);
    fullscreenElement = null;
    fireEvent(document, new Event("fullscreenchange"));
    await waitFor(() =>
      expect(screen.queryByTestId("slide-playback")).not.toBeInTheDocument()
    );
    expect(useEditorStore.getState().slideDeck?.activeSlideId).toBe("slide-2");
  });

  it("keeps the window overlay open when fullscreen is rejected", async () => {
    requestFullscreen.mockRejectedValueOnce(new Error("denied"));
    render(
      <ShortcutProvider>
        <ZoomControl containerSize={{ width: 1000, height: 700 }} />
      </ShortcutProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(warning).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("slide-playback")).toBeInTheDocument();
  });

  it("keeps playback and slide creation actions outside the slide navigator", () => {
    render(<SlideNavigator />);

    expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add slide" })).not.toBeInTheDocument();
    const slideList = screen.getByRole("list", { name: "Slides" });
    expect(slideList.querySelectorAll(":scope > li > span")).toHaveLength(0);
    const firstSlide = screen.getByRole("button", { name: "1. First" });
    const secondSlide = screen.getByRole("button", { name: "2. Second" });
    expect(firstSlide.parentElement).toHaveClass("border");
    expect(firstSlide.parentElement).not.toHaveClass("border-primary", "ring-1");
    expect(secondSlide.parentElement).toHaveClass("border");
    expect(secondSlide.parentElement).not.toHaveClass("border-primary", "ring-1");
    expect(firstSlide).toHaveClass("border-transparent");
    expect(firstSlide).not.toHaveClass("border-primary");
    expect(secondSlide).toHaveClass("border-primary");
    expect(secondSlide).not.toHaveClass("border-transparent");

    fireEvent.click(firstSlide);

    expect(firstSlide).toHaveClass("border-primary");
    expect(firstSlide).not.toHaveClass("border-transparent");
    expect(secondSlide).toHaveClass("border-transparent");
    expect(secondSlide).not.toHaveClass("border-primary");

    const firstNameInput = screen.getAllByRole("textbox", { name: "Rename" })[0];
    expect(firstNameInput).toHaveClass("bg-transparent", "border-0", "shadow-none");
    act(() => firstNameInput.focus());
    fireEvent.change(firstNameInput, { target: { value: "  Intro  " } });
    expect(useEditorStore.getState().slideDeck?.slides[0].name).toBe("First");
    fireEvent.keyDown(firstNameInput, { key: "Enter" });
    expect(useEditorStore.getState().slideDeck?.slides[0].name).toBe("Intro");
  });

  it("exits owned fullscreen from the presentation close control", async () => {
    render(
      <ShortcutProvider>
        <ZoomControl containerSize={{ width: 1000, height: 700 }} />
      </ShortcutProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await act(async () => undefined);

    fireEvent.click(screen.getByRole("button", { name: "Exit presentation" }));
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("slide-playback")).not.toBeInTheDocument();
  });
});
