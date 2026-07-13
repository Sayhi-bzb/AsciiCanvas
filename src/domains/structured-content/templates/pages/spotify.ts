import type { GridCell } from "@/shared/types";
import type { StructuredTextRangeStyle, StructuredTextStyleRange } from "@/domains/structured-content/public";
import { parseAnsiTextCells } from "@/shared/utils/ansiText";
import { STRUCTURED_TEMPLATE_TEXT_COLOR } from "../components/factory";
import type { StructuredComponentDefinition } from "../components/types";
import SPOTIFY_SOURCE from "./spotify.txt?raw";

const SPOTIFY_TEXT_STYLE = {
  color: STRUCTURED_TEMPLATE_TEXT_COLOR,
};
const SPOTIFY_ACCENT = "#00ff00";

const styleFromCell = (cell: Pick<GridCell, "color" | "bgColor" | "attrs">) => ({
  color: cell.color,
  ...(cell.bgColor ? { bgColor: cell.bgColor } : {}),
  ...(cell.attrs ? { attrs: { ...cell.attrs } } : {}),
});

const stylesEqual = (
  left: StructuredTextRangeStyle,
  right: StructuredTextRangeStyle
) =>
  left.color === right.color &&
  left.bgColor === right.bgColor &&
  !!left.attrs?.bold === !!right.attrs?.bold &&
  !!left.attrs?.italic === !!right.attrs?.italic &&
  !!left.attrs?.underline === !!right.attrs?.underline &&
  !!left.attrs?.strike === !!right.attrs?.strike &&
  !!left.attrs?.inverse === !!right.attrs?.inverse;

const SPOTIFY_CELLS =
  parseAnsiTextCells(SPOTIFY_SOURCE, SPOTIFY_TEXT_STYLE.color) ?? [];
const SPOTIFY_CELL_BY_POINT = new Map(
  SPOTIFY_CELLS.map((cell) => [cell.x + "," + cell.y, cell])
);

type StyledTextRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const buildStyledTextRegion = ({
  x,
  y,
  width,
  height,
}: StyledTextRegion) => {
  let text = "";
  let offset = 0;
  let activeRange: StructuredTextStyleRange | null = null;
  const styleRanges: StructuredTextStyleRange[] = [];

  const pushStyle = (style: StructuredTextRangeStyle) => {
    if (stylesEqual(style, SPOTIFY_TEXT_STYLE)) {
      activeRange = null;
      return;
    }
    if (activeRange && stylesEqual(activeRange.style, style)) {
      activeRange.end = offset + 1;
      return;
    }
    activeRange = { start: offset, end: offset + 1, style };
    styleRanges.push(activeRange);
  };

  for (let rowOffset = 0; rowOffset < height; rowOffset += 1) {
    const row = Array.from({ length: width }, (_, columnOffset) => {
      const cell = SPOTIFY_CELL_BY_POINT.get(
        x + columnOffset + "," + (y + rowOffset)
      );
      return {
        char: cell?.char ?? " ",
        style: cell ? styleFromCell(cell) : SPOTIFY_TEXT_STYLE,
      };
    });
    let contentLength = row.length;
    while (
      contentLength > 0 &&
      row[contentLength - 1].char === " " &&
      stylesEqual(row[contentLength - 1].style, SPOTIFY_TEXT_STYLE)
    ) {
      contentLength -= 1;
    }

    row.slice(0, contentLength).forEach(({ char, style }) => {
      text += char;
      pushStyle(style);
      offset += 1;
    });
    activeRange = null;
    if (rowOffset < height - 1) {
      text += "\n";
      offset += 1;
    }
  }

  return { text, styleRanges };
};

export const SPOTIFY_TEMPLATE: StructuredComponentDefinition = {
  id: "spotify",
  label: "Spotify",
  build: ({ createBox, createText }) => {
    const createRegion = (
      role: string,
      region: StyledTextRegion,
      orderOffset: number
    ) => {
      const styledText = buildStyledTextRegion(region);
      return createText(
        styledText.text,
        { x: region.x + 1, y: region.y + 1 },
        orderOffset,
        styledText.styleRanges.length > 0
          ? styledText.styleRanges
          : undefined,
        SPOTIFY_TEXT_STYLE,
        role
      );
    };

    return [
      createBox(
        46,
        17,
        0,
        { x: 0, y: 0 },
        { color: SPOTIFY_ACCENT },
        "frame"
      ),
      createRegion("header", { x: 0, y: 0, width: 44, height: 1 }, 1),
      createRegion("nowPlaying", { x: 0, y: 2, width: 44, height: 2 }, 2),
      createRegion("progress", { x: 0, y: 5, width: 44, height: 1 }, 3),
      createRegion("controls", { x: 0, y: 7, width: 44, height: 1 }, 4),
      createRegion("queueHeading", { x: 0, y: 9, width: 44, height: 1 }, 5),
      createRegion("queueTrack", { x: 0, y: 10, width: 44, height: 1 }, 6),
      createRegion("queueTrack", { x: 0, y: 11, width: 44, height: 1 }, 7),
      createRegion("queueTrack", { x: 0, y: 12, width: 44, height: 1 }, 8),
      createRegion(
        "listeningStatus",
        { x: 0, y: 14, width: 44, height: 1 },
        9
      ),
    ];
  },
};
