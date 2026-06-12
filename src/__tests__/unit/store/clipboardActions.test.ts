import { describe, expect, it, vi } from "vitest";
import {
  buildClipboardPayload,
  writeClipboardPayload,
} from "@/domains/actions/adapters/clipboardActions";

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
      plain: "\u001b[38;2;255;0;0mA\u001b[38;2;0;255;0mB\u001b[0m",
      rich: null,
    });
  });

  it("writes ANSI copy event data as text/plain only", async () => {
    const setData = vi.fn();
    const preventDefault = vi.fn();

    const result = await writeClipboardPayload(
      {
        plain: "\u001b[38;2;255;0;0mA\u001b[0m",
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
      "\u001b[38;2;255;0;0mA\u001b[0m"
    );
  });
});
