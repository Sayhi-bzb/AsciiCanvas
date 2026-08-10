import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HandbookDialog } from "@/widgets/dialogs/handbook-dialog";
import { setUiLanguage } from "@/shared/i18n";

describe("HandbookDialog", () => {
  beforeEach(() => setUiLanguage("en"));
  afterEach(() => setUiLanguage("en"));

  it("documents the current freeform and structured workflows", () => {
    render(<HandbookDialog />);

    fireEvent.click(screen.getByRole("button", { name: "Open user manual" }));

    expect(screen.getByRole("heading", { name: "User Manual" })).toBeInTheDocument();
    expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();
    expect(screen.getByText("Common commands")).toBeInTheDocument();
    expect(screen.getByText("Canvas controls")).toBeInTheDocument();
    expect(screen.getByText("Undo")).toBeInTheDocument();
    expect(screen.getByText(/Ctrl\+Z|⌘Z/)).toBeInTheDocument();
    expect(screen.getByText("Toggle sidebar")).toBeInTheDocument();
    expect(screen.getByText(/Ctrl\+B|⌘B/)).toBeInTheDocument();
    expect(screen.getByText("Choose Dock tool by position")).toBeInTheDocument();
    expect(
      screen.getByText("Mac: Control+1…Control+N · Windows/Linux: Alt+1…Alt+N")
    ).toBeInTheDocument();
    expect(screen.getByText("Space + Drag")).toBeInTheDocument();
    expect(screen.getByText("Ctrl/⌘ + Arrow")).toBeInTheDocument();
    expect(screen.getByText("Escape")).toBeInTheDocument();
    expect(screen.getByText("Freeform")).toBeInTheDocument();
    expect(screen.getByText(/rectangular selection/)).toBeInTheDocument();
    expect(screen.getByText("Structured Canvas")).toBeInTheDocument();
    expect(screen.getByText(/Template or Components tab/)).toBeInTheDocument();
    expect(screen.getByText("Text / Background / Box")).toBeInTheDocument();
    expect(screen.getByText("Structured Editing")).toBeInTheDocument();
    expect(screen.getByText(/Double-click text to edit in place/)).toBeInTheDocument();
    expect(screen.getByText(/Select text inside edit mode/)).toBeInTheDocument();
    expect(screen.getByText(/Toolbar fill controls bg layers/)).toBeInTheDocument();
    expect(screen.getByText(/Structured copy keeps node data/)).toBeInTheDocument();
    expect(screen.getByText(/Selections and structured nodes expose mode-specific editing actions/)).toBeInTheDocument();
  });

  it("offers a desktop guided-tour replay action when supplied", () => {
    const onStartTour = vi.fn();
    render(
      <HandbookDialog open trigger={null} onStartTour={onStartTour} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Start guided tour" }));
    expect(onStartTour).toHaveBeenCalledOnce();
  });

  it("localizes the shortcut list in Chinese", () => {
    setUiLanguage("zh");
    render(<HandbookDialog />);

    fireEvent.click(screen.getByRole("button", { name: "打开用户手册" }));

    expect(screen.getByRole("heading", { name: "用户手册" })).toBeInTheDocument();
    expect(screen.getByText("键盘快捷键")).toBeInTheDocument();
    expect(screen.getByText("常用命令")).toBeInTheDocument();
    expect(screen.getByText("画布操作")).toBeInTheDocument();
    expect(screen.getByText("切换侧栏")).toBeInTheDocument();
    expect(screen.getByText("按位置选择 Dock 工具")).toBeInTheDocument();
    expect(
      screen.getByText("Mac：Control+1…Control+N · Windows/Linux：Alt+1…Alt+N")
    ).toBeInTheDocument();
    expect(screen.getByText("Space + 拖拽")).toBeInTheDocument();
    expect(screen.getByText("Ctrl/⌘ + 方向键")).toBeInTheDocument();
    expect(screen.getByText("取消或清除选区")).toBeInTheDocument();
  });
});
