export {
  activateSlide,
  addSlide,
  createSlideDeck,
  createSlideId,
  duplicateSlide,
  getSlideResizeCropCount,
  moveSlide,
  removeSlide,
  renameSlide,
  resizeSlide,
  updateSlideGrid,
} from "./deck";
export { normalizeSlideDeck } from "./normalize";
export { parseSlideMarkdown } from "./markdown";
export { isValidSlideDimension, isValidSlideSize } from "./grid";
export type { Slide, SlideDeck, SlideSize } from "./model";
export { SLIDE_SIZE_PRESETS } from "./model";
