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
export {
  isSlideMarkdownSource,
  parseSlideMarkdown,
  parseSlideMarkdownBody,
} from "./markdown";
export { isValidSlideDimension, isValidSlideSize } from "./grid";
export type { Slide, SlideDeck, SlideSize } from "./model";
export { DEFAULT_SLIDE_SIZE, SLIDE_SIZE_PRESETS } from "./model";
