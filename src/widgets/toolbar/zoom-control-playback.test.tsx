import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/domains/canvas/testing";
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
        activeSlideId: "slide-2",
        slides: [
          {
            id: "slide-1",
            name: "First",
            size: { columns: 3, rows: 2 },
            grid: [["2,1", { char: "A", color: "#000" }]],
          },
          { id: "slide-2", name: "Second", size: { columns: 3, rows: 2 }, grid: [] },
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
    const slideList = screen.getByRole("list", { name: "Slides, reorderable" });
    expect(slideList.querySelectorAll(":scope > li > span")).toHaveLength(0);
    const firstSlide = screen.getByRole("button", { name: "1. First" });
    const secondSlide = screen.getByRole("button", { name: "2. Second" });
    expect(firstSlide.querySelector("pre")).not.toBeInTheDocument();
    expect(firstSlide.querySelector("canvas")).toHaveAttribute(
      "data-testid",
      "slide-preview-canvas"
    );
    expect(firstSlide.parentElement).toHaveClass("border");
    expect(firstSlide.parentElement).not.toHaveClass("border-primary", "ring-1");
    expect(secondSlide.parentElement).toHaveClass("border");
    expect(secondSlide.parentElement).not.toHaveClass("border-primary", "ring-1");
    expect(firstSlide).not.toHaveAttribute("data-selected");
    expect(firstSlide).not.toHaveClass("bg-accent");
    expect(secondSlide).toHaveAttribute("data-selected", "true");
    expect(secondSlide).toHaveClass("bg-accent", "text-foreground");

    fireEvent.click(firstSlide);

    expect(firstSlide).toHaveAttribute("data-selected", "true");
    expect(firstSlide).toHaveClass("bg-accent", "text-foreground");
    expect(secondSlide).not.toHaveAttribute("data-selected");
    expect(secondSlide).not.toHaveClass("bg-accent");

    const firstNameInput = screen.getAllByRole("textbox", { name: "Rename" })[0];
    expect(firstNameInput).toHaveClass("bg-transparent", "border-0", "shadow-none");
    act(() => firstNameInput.focus());
    fireEvent.change(firstNameInput, { target: { value: "  Intro  " } });
    expect(useEditorStore.getState().slideDeck?.slides[0].name).toBe("First");
    fireEvent.keyDown(firstNameInput, { key: "Enter" });
    expect(useEditorStore.getState().slideDeck?.slides[0].name).toBe("Intro");

    expect(screen.queryByRole("button", { name: "Move up" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Move down" })).not.toBeInTheDocument();
    const reorderCard = screen.getByRole("listitem", {
      name: "Reorder Intro, position 1 of 2",
    });
    fireEvent.keyDown(reorderCard, { key: " " });
    expect(
      screen.getByRole("listitem", {
        name: "Reorder Intro, position 1 of 2, grabbed",
      })
    ).toBeInTheDocument();
    fireEvent.keyDown(reorderCard, { key: "ArrowDown" });

    expect(
      useEditorStore.getState().slideDeck?.slides.map((slide) => slide.name)
    ).toEqual(["Second", "Intro"]);
    expect(useEditorStore.getState().slideDeck?.activeSlideId).toBe("slide-1");
    const movedCard = screen.getByRole("listitem", {
      name: "Reorder Intro, position 2 of 2, grabbed",
    });
    fireEvent.keyDown(movedCard, { key: "Enter" });
    expect(
      screen.getByRole("listitem", {
        name: "Reorder Intro, position 2 of 2",
      })
    ).toBeInTheDocument();
  });

  it("configures only the selected slide and confirms destructive cropping", async () => {
    render(<SlideNavigator />);

    const configureFirst = screen.getAllByRole("button", {
      name: "Configure slide size",
    })[0];
    fireEvent.click(configureFirst);
    expect(useEditorStore.getState().slideDeck?.activeSlideId).toBe("slide-2");
    expect(
      await screen.findByRole("heading", { name: "Slide size" })
    ).toBeInTheDocument();
    const columns = screen.getByRole("spinbutton", { name: "Columns" });
    const rows = screen.getByRole("spinbutton", { name: "Rows" });
    expect(columns).toHaveValue(3);
    expect(rows).toHaveValue(2);

    fireEvent.change(columns, { target: { value: "4" } });
    fireEvent.change(rows, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(useEditorStore.getState().slideDeck?.slides[0].size).toEqual({
      columns: 4,
      rows: 3,
    });
    expect(useEditorStore.getState().slideDeck?.slides[1].size).toEqual({
      columns: 3,
      rows: 2,
    });

    fireEvent.click(configureFirst);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Columns" }), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Rows" }), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(
      await screen.findByRole("heading", { name: "Crop slide content?" })
    ).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "Resize First to 2 × 1. Out-of-bounds cells removed: 1."
    );
    expect(useEditorStore.getState().slideDeck?.slides[0].size).toEqual({
      columns: 4,
      rows: 3,
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(useEditorStore.getState().slideDeck?.slides[0].size).toEqual({
      columns: 4,
      rows: 3,
    });
    fireEvent.click(configureFirst);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Columns" }), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Rows" }), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    fireEvent.click(screen.getByRole("button", { name: "Crop and apply" }));
    expect(useEditorStore.getState().slideDeck?.slides[0]).toMatchObject({
      size: { columns: 2, rows: 1 },
      grid: [],
    });
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
