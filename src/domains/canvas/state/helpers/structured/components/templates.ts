import type { StructuredComponentDefinition } from "./types";

export const PAGE_TEMPLATE_COMPONENTS: StructuredComponentDefinition[] = [
  {
    id: "safari",
    label: "Safari",
    build: ({ createBg, createSplitBox, createText }) => {
      const container = createSplitBox(
        72,
        21,
        0,
        { x: 0, y: 0 },
        {
          verticalSplitRatio: 0.5,
          topSplitRatio: 0.1,
          bottomSplitRatio: 0.9,
        },
        undefined,
        "container"
      );
      return [
        {
          ...container,
          root: {
            type: "split",
            id: "split-toolbar",
            axis: "horizontal",
            ratio: 2 / 20,
            first: { type: "leaf", id: "leaf-toolbar" },
            second: { type: "leaf", id: "leaf-content" },
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
        createText(
          "  < >   ",
          { x: 8, y: 1 },
          2,
          undefined,
          undefined,
          "toolbarLeft"
        ),
        createBg(34, 4, 3, { x: 19, y: 1 }, 1, "#d1d5db", "addressFill"),
        createText(
          "      ascii-canvas.pages.dev     ",
          { x: 19, y: 1 },
          4,
          undefined,
          undefined,
          "addressText"
        ),
        createText(
          "    󰆏",
          { x: 61, y: 1 },
          5,
          undefined,
          undefined,
          "toolbarRight"
        ),
      ];
    },
  },
];
