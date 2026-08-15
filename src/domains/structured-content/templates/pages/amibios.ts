import type {
  StructuredSplitBoxTreeNode,
} from "../../model/types";
import { parseAnsiTextCells } from "@/shared/utils/ansiText";
import type { StructuredComponentDefinition } from "../components/types";
import {
  buildStyledTextRegion,
  type StyledTextRegion,
} from "./styled-text";

const AMIBIOS_SOURCE = `[37;44m╭───────────────────────────────────────────────────────────────────────────────╮[0m
[37;44m│   [1mAMIBIOS EASY SETUP UTILITY - VERSION 1.24.2026[22m                              │[0m
[37;44m├───────────────────────────────────────────────────────────────────────────────┤[0m
[37;44m│ [7m Main [27m     Advanced     Power     Boot     Security     Exit                  │[0m
[37;44m├───────────────────────────────────────┬───────────────────────────────────────┤[0m
[37;44m│                                       │                                       │[0m
[37;44m│  System Time:       [[1m11:05:25[22m]        │ Item Specific Help                    │[0m
[37;44m│  System Date:       [[1m07/02/2026[22m]      │                                       │[0m
[37;44m│                                       │ Use [Enter], [TAB]                    │[0m
[37;44m│  Legacy Diskette A:  [1.44M, 3.5 in.] │ or [SHIFT-TAB] to select a field.     │[0m
[37;44m│                                       │                                       │[0m
[37;44m│ ┌─ Primary Master ──────────────────┐ │ Use [+] or [-] to                     │[0m
[37;44m│ │ Type:             [Auto]          │ │ configure system Time.                │[0m
[37;44m│ │ LBA Mode:         [On]            │ │                                       │[0m
[37;44m│ │ Block Mode:       [4 Sectors]     │ │                                       │[0m
[37;44m│ └───────────────────────────────────┘ │                                       │[0m
[37;44m│                                       │                                       │[0m
[37;44m│                                       │                                       │[0m
[37;44m│  [7m> System Memory:     640 KB        [27m  │                                       │[0m
[37;44m│    Extended Memory:   16384 MB        │                                       │[0m
[37;44m│                                       │                                       │[0m
[37;44m│ [33m  [1;31mCPU Temperature:   45°C (Normal)[22;37m   │                                       │[0m
[37;44m├───────────────────────────────────────┴───────────────────────────────────────┤[0m
[37;44m│ F1:Help  ↑↓:Select Item  +/-:Change Values  F5:Setup Defaults  F10:Save & Exit│[0m
[37;44m╰───────────────────────────────────────────────────────────────────────────────╯[0m`;

const AMIBIOS_BASE_STYLE = {
  color: "#c0c0c0",
  bgColor: "#000080",
};

const AMIBIOS_CELLS =
  parseAnsiTextCells(AMIBIOS_SOURCE, AMIBIOS_BASE_STYLE.color) ?? [];
const AMIBIOS_CELL_BY_POINT = new Map(
  AMIBIOS_CELLS.map((cell) => [cell.x + "," + cell.y, cell])
);

const createFrameRoot = (): StructuredSplitBoxTreeNode => ({
  type: "split",
  id: "split-title",
  axis: "horizontal",
  ratio: 2 / 24,
  first: { type: "leaf", id: "leaf-title" },
  second: {
    type: "split",
    id: "split-navigation",
    axis: "horizontal",
    ratio: 2 / 22,
    first: { type: "leaf", id: "leaf-navigation" },
    second: {
      type: "split",
      id: "split-footer",
      axis: "horizontal",
      ratio: 18 / 20,
      first: {
        type: "split",
        id: "split-main",
        axis: "vertical",
        ratio: 40 / 80,
        first: { type: "leaf", id: "leaf-settings" },
        second: { type: "leaf", id: "leaf-help" },
      },
      second: { type: "leaf", id: "leaf-footer" },
    },
  },
});

export const AMIBIOS_TEMPLATE: StructuredComponentDefinition = {
  id: "amibios",
  label: "AMIBIOS",
  build: ({ createBg, createSplitBox, createText }) => {
    const screenFill = createBg(
      81,
      0,
      0,
      { x: 0, y: 0 },
      25,
      AMIBIOS_BASE_STYLE.bgColor,
      "screenFill"
    );
    const frame = createSplitBox(
      81,
      25,
      1,
      { x: 0, y: 0 },
      {
        verticalSplitRatio: 40 / 80,
        topSplitRatio: 2 / 24,
        bottomSplitRatio: 18 / 20,
      },
      AMIBIOS_BASE_STYLE,
      "frame"
    );
    const createRegion = (
      role: string,
      region: StyledTextRegion,
      orderOffset: number
    ) => {
      const styledText = buildStyledTextRegion(
        region,
        AMIBIOS_CELL_BY_POINT,
        AMIBIOS_BASE_STYLE
      );
      return createText(
        styledText.text,
        { x: region.x, y: region.y },
        orderOffset,
        styledText.styleRanges.length > 0
          ? styledText.styleRanges
          : undefined,
        AMIBIOS_BASE_STYLE,
        role
      );
    };

    return [
      screenFill,
      { ...frame, root: createFrameRoot() },
      createRegion("title", { x: 1, y: 1, width: 79, height: 1 }, 2),
      createRegion("navigation", { x: 1, y: 3, width: 79, height: 1 }, 3),
      createRegion("systemFields", { x: 1, y: 5, width: 39, height: 5 }, 4),
      createRegion("drivePanel", { x: 1, y: 10, width: 39, height: 6 }, 5),
      createRegion("memoryStatus", { x: 1, y: 16, width: 39, height: 4 }, 6),
      createRegion(
        "temperatureStatus",
        { x: 1, y: 20, width: 39, height: 2 },
        7
      ),
      createRegion("itemHelp", { x: 41, y: 5, width: 39, height: 17 }, 8),
      createRegion("footer", { x: 1, y: 23, width: 79, height: 1 }, 9),
    ];
  },
};
