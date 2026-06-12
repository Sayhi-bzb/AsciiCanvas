import { describe, expect, it, vi } from "vitest";
import { writeClipboardPayload } from "@/domains/actions/adapters/clipboardActions";

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
});
