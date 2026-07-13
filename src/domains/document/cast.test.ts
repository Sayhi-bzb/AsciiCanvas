import { describe, expect, it } from "vitest";
import {
  isLikelyAsciinemaCast,
  parseAsciinemaCast,
} from "@/domains/document/public";
import { exportAnimationToCast } from "@/domains/export/public";
import { normalizeAnimationTimeline } from "@/domains/animation/public";

describe("asciinema cast utilities", () => {
  it("exports animation frames as simple asciinema v2 output events", () => {
    const timeline = normalizeAnimationTimeline({
      fps: 2,
      loop: true,
      currentFrameId: "f1",
      frames: [
        {
          id: "f1",
          name: "Frame 1",
          grid: [["1,0", { char: "@", color: "#ff0000" }]],
        },
        {
          id: "f2",
          name: "Frame 2",
          grid: [["0,1", { char: "*", color: "#00ff00" }]],
        },
      ],
    });

    const cast = exportAnimationToCast(
      { width: 3, height: 2 },
      timeline,
      { timestamp: 1770000000 }
    );
    const lines = cast.trimEnd().split("\n");

    expect(JSON.parse(lines[0])).toEqual({
      version: 2,
      width: 3,
      height: 2,
      timestamp: 1770000000,
      env: { TERM: "xterm-256color" },
    });
    expect(JSON.parse(lines[1])).toEqual([
      0,
      "o",
      "\r \u001b[91m@ \u001b[m\n   ",
    ]);
    expect(JSON.parse(lines[2])[0]).toBe(0.5);
    expect(JSON.parse(lines[3])).toEqual([1, "o", ""]);
  });

  it("exports monochrome cast payloads when color export is disabled", () => {
    const timeline = normalizeAnimationTimeline({
      fps: 1,
      currentFrameId: "f1",
      frames: [
        {
          id: "f1",
          name: "Frame 1",
          grid: [["0,0", { char: "@", color: "#ff0000" }]],
        },
      ],
    });

    const lines = exportAnimationToCast(
      { width: 1, height: 1 },
      timeline,
      { includeColor: false, timestamp: 1770000000 }
    )
      .trimEnd()
      .split("\n");

    expect(JSON.parse(lines[1])).toEqual([0, "o", "\r@"]);
  });

  it("imports a simple cast as an animation snapshot", () => {
    const raw = [
      '{"version":2,"width":4,"height":2,"timestamp":1770000000,"env":{"TERM":"xterm-256color"}}',
      '[0,"o","\\r\\u001b[38;2;249;115;22mHi\\u001b[0m\\n  \\u001b[38;2;107;114;128m!\\u001b[0m "]',
      '[0.5,"o","\\rBye\\n    "]',
      '[1,"o",""]',
      "",
    ].join("\n");

    expect(isLikelyAsciinemaCast(raw)).toBe(true);

    const snapshot = parseAsciinemaCast(raw);

    expect(snapshot.mode).toBe("animation");
    expect(snapshot.size).toEqual({ width: 4, height: 2 });
    expect(snapshot.timeline?.fps).toBe(2);
    expect(snapshot.timeline?.frames).toHaveLength(2);
    expect(snapshot.timeline?.frames[0].grid).toContainEqual([
      "0,0",
      { char: "H", color: "#f97316" },
    ]);
    expect(snapshot.timeline?.frames[0].grid).toContainEqual([
      "2,1",
      { char: "!", color: "#6b7280" },
    ]);
    expect(snapshot.grid).toBe(snapshot.timeline?.frames[0].grid);
  });

  it("derives and clamps high frame-rate casts to 60 fps", () => {
    const raw = [
      '{"version":2,"width":2,"height":1,"timestamp":1770000000,"env":{"TERM":"xterm-256color"}}',
      '[0,"o","\\rA "]',
      '[0.0166667,"o","\\rB "]',
      '[0.0333334,"o","\\rC "]',
      '[0.04,"o","\\rD "]',
      "",
    ].join("\n");

    expect(parseAsciinemaCast(raw).timeline?.fps).toBe(60);
  });

  it("rejects invalid cast headers", () => {
    expect(() =>
      parseAsciinemaCast('{"version":1,"width":4,"height":2}\n')
    ).toThrow("Invalid asciinema cast header.");
  });
});
