import { parseAnsiTextCells } from "@/shared/utils/ansiText";
import { STRUCTURED_TEMPLATE_TEXT_COLOR } from "../components/factory";
import type { StructuredComponentDefinition } from "../components/types";
import SPOTIFY_SOURCE from "./spotify.txt?raw";
import {
  buildStyledTextRegion,
  type StyledTextRegion,
} from "./styled-text";

const SPOTIFY_TEXT_STYLE = {
  color: STRUCTURED_TEMPLATE_TEXT_COLOR,
};
const SPOTIFY_ACCENT = "#00ff00";

const SPOTIFY_CELLS =
  parseAnsiTextCells(SPOTIFY_SOURCE, SPOTIFY_TEXT_STYLE.color) ?? [];
const SPOTIFY_CELL_BY_POINT = new Map(
  SPOTIFY_CELLS.map((cell) => [cell.x + "," + cell.y, cell])
);

export const SPOTIFY_TEMPLATE: StructuredComponentDefinition = {
  id: "spotify",
  label: "Spotify",
  build: ({ createBox, createText }) => {
    const createRegion = (
      role: string,
      region: StyledTextRegion,
      orderOffset: number
    ) => {
      const styledText = buildStyledTextRegion(
        region,
        SPOTIFY_CELL_BY_POINT,
        SPOTIFY_TEXT_STYLE
      );
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
