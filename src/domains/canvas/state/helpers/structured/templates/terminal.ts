import type { StructuredComponentDefinition } from "../components/types";

export const TERMINAL_TEMPLATE: StructuredComponentDefinition = {
  id: "terminal",
  label: "Terminal",
  build: ({ createSplitBox, createText }) => {
    const frame = createSplitBox(
      44,
      10,
      0,
      { x: 0, y: 0 },
      {
        verticalSplitRatio: 0.5,
        topSplitRatio: 2 / 9,
        bottomSplitRatio: 0.9,
      },
      undefined,
      "frame"
    );

    return [
      {
        ...frame,
        root: {
          type: "split",
          id: "split-titlebar",
          axis: "horizontal",
          ratio: 2 / 9,
          first: { type: "leaf", id: "leaf-titlebar" },
          second: { type: "leaf", id: "leaf-terminal" },
        },
      },
      createText(
        "● ● ●",
        { x: 2, y: 1 },
        1,
        [
          { start: 0, end: 1, style: { color: "#ff6159" } },
          { start: 2, end: 3, style: { color: "#ffbd2e" } },
          { start: 4, end: 5, style: { color: "#28c941" } },
        ],
        undefined,
        "windowControls"
      ),
      createText("$ ls", { x: 2, y: 3 }, 2, undefined, undefined, "command"),
      createText(
        "Documents Downloads Pictures",
        { x: 2, y: 4 },
        3,
        undefined,
        { color: "#3b82f6" },
        "output"
      ),
      createText("$ cd Documents", { x: 2, y: 5 }, 4, undefined, undefined, "command"),
      createText("$ pwd", { x: 2, y: 6 }, 5, undefined, undefined, "command"),
      createText(
        "/home/user/Documents",
        { x: 2, y: 7 },
        6,
        undefined,
        { color: "#28c941" },
        "output"
      ),
    ];
  },
};
