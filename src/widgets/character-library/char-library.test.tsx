import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CharLibrary } from "@/widgets/character-library/char-library";
import { useLibraryStore } from "@/domains/character-library/public";
import { useEditorStore } from "@/domains/canvas/public";
import { writeClipboardPayload } from "@/domains/actions/public";
import { feedback } from "@/shared/services/effects";
import { SidebarProvider } from "@/shared/ui/sidebar";
import { setUiLanguage } from "@/shared/i18n";

vi.mock("@/domains/actions/public", () => ({
  writeClipboardPayload: vi.fn(),
}));

vi.mock("@/shared/services/effects", () => ({
  feedback: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("CharLibrary", () => {
  const initialCanvasState = useEditorStore.getState();
  const initialLibraryState = useLibraryStore.getState();

  beforeEach(() => {
    act(() => setUiLanguage("en"));
    Object.defineProperty(window, "ResizeObserver", {
      writable: true,
      value: class ResizeObserverMock {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    });
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
    act(() => setUiLanguage("en"));
    useEditorStore.setState(initialCanvasState, true);
    useLibraryStore.setState(initialLibraryState, true);
  });

  it("copies selected characters to the clipboard instead of activating brush", async () => {
    vi.mocked(writeClipboardPayload).mockResolvedValue(true);
    useEditorStore.setState({
      brushChar: "#",
      brushColor: "#123456",
      tool: "select",
    });
    useLibraryStore.setState({
      packs: {},
      packStatus: { essentials: "ready", nerd: "ready", emoji: "ready" },
      packErrors: {},
      searchQueries: { essentials: "star", nerd: "", emoji: "" },
      searchResults: {
        essentials: [{
          id: "U+2605",
          grapheme: "★",
          name: "star icon",
          aliases: [],
          category: "So",
          script: "Common",
          coverage: 2,
          insertable: true,
        }],
        nerd: [],
        emoji: [],
      },
    });

    render(
      <SidebarProvider>
        <CharLibrary view="essentials" />
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
    expect(useEditorStore.getState().tool).toBe("select");
    expect(useEditorStore.getState().brushChar).toBe("#");
    expect(feedback.success).toHaveBeenCalledWith("Copied: ★", {
      duration: 600,
      position: "top-right",
    });
    await waitFor(() => expect(starButton).toHaveClass("bg-accent"));

    fireEvent.focus(starButton);
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.parentElement?.querySelector('[data-slot="tooltip-title"]'))
      .toHaveTextContent("star icon");
    expect(tooltip.parentElement?.querySelector('[data-slot="tooltip-meta"]'))
      .toHaveTextContent(/U\+2605.*So/);
  });

  it("localizes every curated pack directory and falls back to its asset label", () => {
    const labels = {
      essentials: [
        ["ascii", "ASCII & Punctuation", "ASCII 与标点"],
        ["lines", "Lines & Blocks", "线条与块元素"],
        ["arrows", "Arrows", "箭头"],
        ["shapes", "Geometric Shapes", "几何图形"],
        ["math", "Math", "数学"],
        ["technical", "Technical", "技术符号"],
        ["numbers", "Numbers & Letterlike Symbols", "数字与类字母符号"],
        ["dingbats", "Dingbats", "装饰符号"],
        ["braille", "Braille", "盲文"],
        ["common-symbols", "Common Symbols", "常用符号"],
      ],
      nerd: [
        ["seti-ui-custom", "Seti-UI-Custom", "Seti UI 自定义"],
        ["devicons", "Devicons", "Devicons"],
        ["font-awesome", "Font-Awesome", "Font Awesome"],
        ["font-awesome-ext", "Font-Awesome-Ext", "Font Awesome 扩展"],
        ["material-design", "Material-Design", "Material Design"],
        ["weather-icons", "Weather-Icons", "天气图标"],
        ["octicons", "Octicons", "Octicons"],
        ["powerline-symbols", "Powerline-Symbols", "Powerline 符号"],
        ["powerline-extra", "Powerline-Extra", "Powerline 扩展"],
        ["iec-power", "IEC-Power", "IEC 电源符号"],
        ["font-logos", "Font-Logos", "字体标志"],
        ["pomicons", "Pomicons", "Pomicons"],
        ["codicons", "Codicons", "Codicons"],
        ["progress-indicators", "Progress-Indicators", "进度指示器"],
        ["heavy-angle-brackets", "Heavy-Angle-Brackets", "粗角括号"],
      ],
      emoji: [
        ["smileys-emotion", "Smileys & Emotion", "笑脸与情感"],
        ["people-body", "People & Body", "人物与身体"],
        ["component", "Component", "组件"],
        ["animals-nature", "Animals & Nature", "动物与自然"],
        ["food-drink", "Food & Drink", "食物与饮品"],
        ["travel-places", "Travel & Places", "旅行与地点"],
        ["activities", "Activities", "活动"],
        ["objects", "Objects", "物品"],
        ["symbols", "Symbols", "符号"],
        ["flags", "Flags", "旗帜"],
      ],
    } as const;
    const groups = (items: ReadonlyArray<readonly [string, string, string]>) =>
      items.map(([id, label]) => ({ id, label, entries: [] }));
    useLibraryStore.setState({
      packs: {
        essentials: [
          ...groups(labels.essentials),
          { id: "future-group", label: "Future Group", entries: [] },
        ],
        nerd: groups(labels.nerd),
        emoji: groups(labels.emoji),
      },
      packStatus: { essentials: "ready", nerd: "ready", emoji: "ready" },
      packErrors: {},
      searchQueries: { essentials: "", nerd: "", emoji: "" },
      searchResults: { essentials: [], nerd: [], emoji: [] },
    });

    const { rerender } = render(
      <SidebarProvider>
        <CharLibrary view="essentials" />
      </SidebarProvider>
    );
    labels.essentials.forEach(([, english]) =>
      expect(screen.getByText(english)).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText("Lines & Blocks").closest("button")!);

    act(() => setUiLanguage("zh"));
    labels.essentials.forEach(([, , chinese]) =>
      expect(screen.getByText(chinese)).toBeInTheDocument()
    );
    expect(screen.getByText("Future Group")).toBeInTheDocument();
    expect(screen.getByText("线条与块元素").closest("button"))
      .toHaveAttribute("data-state", "open");

    rerender(
      <SidebarProvider>
        <CharLibrary view="nerd" />
      </SidebarProvider>
    );
    labels.nerd.forEach(([, , chinese]) =>
      expect(screen.getByText(chinese)).toBeInTheDocument()
    );

    rerender(
      <SidebarProvider>
        <CharLibrary view="emoji" />
      </SidebarProvider>
    );
    labels.emoji.forEach(([, , chinese]) =>
      expect(screen.getByText(chinese)).toBeInTheDocument()
    );
  });
});
