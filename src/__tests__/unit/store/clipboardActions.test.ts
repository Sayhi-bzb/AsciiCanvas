import { describe, expect, it, vi } from "vitest";
import {
  buildClipboardPayload,
  parseAnsiClipboardText,
  writeClipboardPayload,
} from "@/domains/actions/adapters/clipboardActions";
import { getCellOccupancy } from "@/shared/metrics";

const ansiThemeSample = `[38;2;148;163;184m╭──────────────────────────╮[0m
[38;2;148;163;184m│[48;2;239;246;255m [1;38;2;37;99;235m 界面标题[22;38;2;209;213;219m               [0m[38;2;148;163;184m│[38;2;37;99;235m<─[38;2;209;213;219m [1;38;2;37;99;235mPrimary 主色/品牌色[0m
[38;2;148;163;184m├──────────────────────────┤[0m
[38;2;148;163;184m│[48;2;248;250;252m[38;2;15;23;42m 主要内容区域            [0m[38;2;148;163;184m│[0m<─ Foreground 前景文本
[38;2;148;163;184m│[48;2;248;250;252m                          [0m[38;2;148;163;184m│[38;2;209;213;219m<─ Background 背景底色[0m
[38;2;148;163;184m│[48;2;248;250;252m [1;38;2;34;197;94m 操作已完成[22;38;2;209;213;219m             [0m[38;2;148;163;184m│[38;2;34;197;94m<─[38;2;209;213;219m [1;38;2;34;197;94mSemantic: Success 成功[0m
[38;2;148;163;184m│[48;2;248;250;252m [1;38;2;245;158;11m 需要注意[22;38;2;209;213;219m               [0m[38;2;148;163;184m│[38;2;245;158;11m<─[38;2;209;213;219m [1;38;2;245;158;11mSemantic: Warning 警告[0m
[38;2;148;163;184m│[48;2;248;250;252m [1;38;2;239;68;68m 操作失败[22;38;2;209;213;219m               [0m[38;2;148;163;184m│[38;2;239;68;68m<─[38;2;209;213;219m [1;38;2;239;68;68mSemantic: Danger  危险[0m
[38;2;148;163;184m│[48;2;248;250;252m                          [0m[38;2;148;163;184m│[0m
[38;2;148;163;184m│[48;2;248;250;252m [38;2;100;116;139m╭──────╮ [48;2;37;99;235;38;2;255;255;255m╭──────╮[48;2;248;250;252m        [0m[38;2;148;163;184m│<─[38;2;209;213;219m [38;2;148;163;184mNeutral 中性灰/辅助元素[0m
[38;2;148;163;184m│[48;2;248;250;252m [38;2;100;116;139m│ 取消 │ [48;2;37;99;235;1;38;2;255;255;255m│ 确认 │[0m[48;2;236;72;153;1;38;2;255;255;255m  标签 [0m[38;2;148;163;184m│[38;2;236;72;153m<─[38;2;209;213;219m [1;38;2;236;72;153mAccent 强调/高亮色[0m
[38;2;148;163;184m│[48;2;248;250;252m [38;2;100;116;139m╰──────╯ [48;2;37;99;235;38;2;255;255;255m╰──────╯[48;2;248;250;252m        [0m[38;2;148;163;184m│[0m
[38;2;148;163;184m╰──────────────────────────╯[0m`;

const mapAnsiCells = (text: string, color: string, y = 0, startX = 0) => {
  let x = startX;
  return Array.from(text).map((char) => {
    const cell = { x, y, char, color };
    x += getCellOccupancy(char);
    return cell;
  });
};

describe("clipboardActions", () => {
  it("writes app-rich clipboard data during native copy events", async () => {
    const setData = vi.fn();
    const preventDefault = vi.fn();

    const result = await writeClipboardPayload(
      {
        plain: "AB",
        rich: '{"type":"ascii-metropolis-zone","version":1,"cells":[]}',
      },
      {
        event: {
          preventDefault,
          clipboardData: {
            setData,
          },
        } as unknown as ClipboardEvent,
      }
    );

    expect(result).toBe(true);
    expect(preventDefault).toHaveBeenCalled();
    expect(setData).toHaveBeenCalledWith("text/plain", "AB");
    expect(setData).toHaveBeenCalledWith(
      "web application/x-ascii-metropolis",
      '{"type":"ascii-metropolis-zone","version":1,"cells":[]}'
    );
  });

  it("builds ANSI clipboard payloads without app-rich data", () => {
    const payload = buildClipboardPayload(
      new Map([
        ["0,0", { char: "A", color: "#ff0000" }],
        ["1,0", { char: "B", color: "#00ff00" }],
      ]),
      [{ start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }],
      null,
      "#ffffff",
      "ansi"
    );

    expect(payload).toEqual({
      plain: "[38;2;255;0;0mA[0m[38;2;0;255;0mB[0m",
      rich: null,
    });
  });

  it("parses ANSI-like clipboard text without ESC prefixes", () => {
    expect(
      parseAnsiClipboardText(
        "[38;2;190;24;93mWhat doesn’t kill [38;2;0;0;0myou makes you stronger.[0m",
        "#ffffff"
      )
    ).toEqual([
      ...Array.from("What doesn’t kill ").map((char, x) => ({
        x,
        y: 0,
        char,
        color: "#be185d",
      })),
      ...Array.from("you makes you stronger.").map((char, offset) => ({
        x: "What doesn’t kill ".length + offset,
        y: 0,
        char,
        color: "#000000",
      })),
    ]);
  });

  it("parses standard ANSI clipboard text and reset color", () => {
    expect(
      parseAnsiClipboardText(
        "\u001b[38;2;255;0;0mA\u001b[0mB",
        "#123456"
      )
    ).toEqual([
      { x: 0, y: 0, char: "A", color: "#ff0000" },
      { x: 1, y: 0, char: "B", color: "#123456" },
    ]);
  });

  it("clears background and attributes on ANSI reset", () => {
    expect(
      parseAnsiClipboardText(
        "\u001b[1;48;2;1;2;3mA\u001b[0mB",
        "#123456"
      )
    ).toEqual([
      {
        x: 0,
        y: 0,
        char: "A",
        color: "#123456",
        bgColor: "#010203",
        attrs: { bold: true },
      },
      { x: 1, y: 0, char: "B", color: "#123456" },
    ]);
  });

  it("clears only background on ANSI default background", () => {
    expect(
      parseAnsiClipboardText(
        "\u001b[48;2;1;2;3mA\u001b[49mB",
        "#123456"
      )
    ).toEqual([
      { x: 0, y: 0, char: "A", color: "#123456", bgColor: "#010203" },
      { x: 1, y: 0, char: "B", color: "#123456" },
    ]);
  });

  it("parses ANSI background, palette colors, and text attributes", () => {
    expect(
      parseAnsiClipboardText(
        "\u001b[1;3;4;9;38;5;196;48;5;21mA\u001b[22;23;24;29;39;49mB",
        "#123456"
      )
    ).toEqual([
      {
        x: 0,
        y: 0,
        char: "A",
        color: "#ff0000",
        bgColor: "#0000ff",
        attrs: {
          bold: true,
          italic: true,
          underline: true,
          strike: true,
        },
      },
      { x: 1, y: 0, char: "B", color: "#123456" },
    ]);
  });

  it("parses inverse ANSI style without swapping stored colors", () => {
    expect(
      parseAnsiClipboardText(
        "\u001b[7;38;2;10;20;30;48;2;40;50;60mA",
        "#ffffff"
      )
    ).toEqual([
      {
        x: 0,
        y: 0,
        char: "A",
        color: "#0a141e",
        bgColor: "#28323c",
        attrs: { inverse: true },
      },
    ]);
  });

  it("preserves styled background spaces in a terminal UI sample", () => {
    const cells = parseAnsiClipboardText(ansiThemeSample, "#ffffff");
    expect(cells).not.toBeNull();

    const titleLineCells = cells!.filter((cell) => cell.y === 1);
    expect(titleLineCells).toContainEqual({
      x: 1,
      y: 1,
      char: " ",
      color: "#94a3b8",
      bgColor: "#eff6ff",
    });
    expect(titleLineCells).toContainEqual({
      x: 3,
      y: 1,
      char: "界",
      color: "#2563eb",
      bgColor: "#eff6ff",
      attrs: { bold: true },
    });
    expect(titleLineCells).toContainEqual({
      x: 5,
      y: 1,
      char: "面",
      color: "#2563eb",
      bgColor: "#eff6ff",
      attrs: { bold: true },
    });
  });

  it("parses combined background and foreground SGR in either order", () => {
    expect(
      parseAnsiClipboardText("[48;2;37;99;235;38;2;255;255;255mA", "#000000")
    ).toEqual([
      {
        x: 0,
        y: 0,
        char: "A",
        color: "#ffffff",
        bgColor: "#2563eb",
      },
    ]);
  });

  it("does not parse plain bracketed text as ANSI", () => {
    expect(parseAnsiClipboardText("hello [world]", "#ffffff")).toBeNull();
  });

  it("preserves ANSI color across wide characters and new lines", () => {
    expect(
      parseAnsiClipboardText("\u001b[38;2;255;255;255m你A\nB", "#000000")
    ).toEqual([
      { x: 0, y: 0, char: "你", color: "#ffffff" },
      { x: 2, y: 0, char: "A", color: "#ffffff" },
      { x: 0, y: 1, char: "B", color: "#ffffff" },
    ]);
  });

  it("preserves CRLF new lines in ANSI-like clipboard text", () => {
    expect(
      parseAnsiClipboardText(
        "[38;2;244;63;94m[ 比例数字 (Proportional Nums) - 每个数字宽度根据字形变化 ][0m\r\n  [38;2;251;146;60m1 1 1 . 1 1[0m",
        "#ffffff"
      )
    ).toEqual([
      ...mapAnsiCells(
        "[ 比例数字 (Proportional Nums) - 每个数字宽度根据字形变化 ]",
        "#f43f5e"
      ),
      { x: 0, y: 1, char: " ", color: "#ffffff" },
      { x: 1, y: 1, char: " ", color: "#ffffff" },
      ...mapAnsiCells("1 1 1 . 1 1", "#fb923c", 1, 2),
    ]);
  });

  it("writes ANSI copy event data as text/plain only", async () => {
    const setData = vi.fn();
    const preventDefault = vi.fn();

    const result = await writeClipboardPayload(
      {
        plain: "[38;2;255;0;0mA[0m",
        rich: null,
      },
      {
        event: {
          preventDefault,
          clipboardData: {
            setData,
          },
        } as unknown as ClipboardEvent,
      }
    );

    expect(result).toBe(true);
    expect(preventDefault).toHaveBeenCalled();
    expect(setData).toHaveBeenCalledTimes(1);
    expect(setData).toHaveBeenCalledWith(
      "text/plain",
      "[38;2;255;0;0mA[0m"
    );
  });
});
