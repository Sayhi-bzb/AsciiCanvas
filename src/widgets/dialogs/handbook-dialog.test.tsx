import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HandbookDialog } from "@/widgets/dialogs/handbook-dialog";
import { setUiLanguage } from "@/shared/i18n";

const renderHandbook = (dialog: ReactElement = <HandbookDialog />) => render(dialog);

describe("HandbookDialog", () => {
  beforeEach(() => setUiLanguage("en"));
  afterEach(() => setUiLanguage("en"));

  it("presents a compact operation reference", () => {
    renderHandbook();

    fireEvent.click(screen.getByRole("button", { name: "Open help" }));

    const dialog = screen.getByRole("dialog", { name: "Help" });
    expect(screen.getAllByRole("heading")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Keyboard shortcuts" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open full documentation" })).toBeInTheDocument();
    expect(screen.getByText("Select and fill")).toBeInTheDocument();
    expect(screen.getByText("Navigate the character grid")).toBeInTheDocument();
    expect(screen.getByText("Insert components")).toBeInTheDocument();
    expect(screen.getByText("Edit text")).toBeInTheDocument();
    expect(screen.getByText("Format a range")).toBeInTheDocument();
    expect(screen.getByText("Color shapes")).toBeInTheDocument();
    expect(screen.getByText("Copy between modes")).toBeInTheDocument();
    expect(dialog.querySelectorAll('[data-slot="help-reference"] dt')).toHaveLength(7);
    expect(dialog.querySelectorAll('[data-slot="help-reference"] dd')).toHaveLength(7);
    expect(screen.queryByText("Common commands")).not.toBeInTheDocument();
    expect(dialog.querySelector('[class*="bg-accent/"]')).not.toBeInTheDocument();
    expect(dialog.querySelector(".border-accent")).not.toBeInTheDocument();
  });

  it("offers a desktop guided-tour replay action when supplied", () => {
    const onStartTour = vi.fn();
    renderHandbook(
      <HandbookDialog open trigger={null} onStartTour={onStartTour} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Start guided tour" }));
    expect(onStartTour).toHaveBeenCalledOnce();
  });

  it("localizes the compact reference in Chinese", () => {
    setUiLanguage("zh");
    renderHandbook(<HandbookDialog />);

    fireEvent.click(screen.getByRole("button", { name: "打开帮助" }));

    expect(screen.getByRole("heading", { name: "帮助" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "键盘快捷键" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打开完整文档" })).toBeInTheDocument();
    expect(screen.getByText("选择与填充")).toBeInTheDocument();
    expect(screen.getByText("插入组件")).toBeInTheDocument();
    expect(screen.getByText("编辑文本")).toBeInTheDocument();
    expect(screen.getByText("格式化范围")).toBeInTheDocument();
    expect(screen.getByText("形状颜色")).toBeInTheDocument();
    expect(screen.getByText("跨模式复制")).toBeInTheDocument();
  });
});
