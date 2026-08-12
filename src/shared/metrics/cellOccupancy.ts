import {
  getGraphemeCellWidth,
  getTextCellWidth as getProtocolTextCellWidth,
} from "@chardesk/protocol";

export const getCellOccupancy = getGraphemeCellWidth;

export const isWideCell = (grapheme: string) =>
  getGraphemeCellWidth(grapheme) === 2;

export const getTextCellWidth = getProtocolTextCellWidth;
