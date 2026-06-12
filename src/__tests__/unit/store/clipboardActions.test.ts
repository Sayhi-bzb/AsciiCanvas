import { describe, expect, it, vi } from "vitest";
import {
  buildClipboardPayload,
  parseAnsiClipboardText,
  writeClipboardPayload,
} from "@/domains/actions/adapters/clipboardActions";
import { getCellOccupancy } from "@/shared/metrics";

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
      plain: "[38;2;255;0;0mA[38;2;0;255;0mB[0m",
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
