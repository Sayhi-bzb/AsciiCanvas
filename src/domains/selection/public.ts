export type {
  GridAddress,
  GridEditMode,
  GridRange,
  GridSelectionState,
} from "./model/static-grid";
export {
  collapseGridSelectionTo,
  createGridSelectionState,
  createStaticGridState,
  extendGridSelectionTo,
  getStaticGridSelectionAreas,
  getStaticGridViewState,
  gridRangeFromSelectionArea,
  moveGridAddress,
  normalizeGridRange,
  selectionAreaFromGridRange,
  selectionAreasFromGridRanges,
  syncGridSelectionFromLegacy,
} from "./model/static-grid";
