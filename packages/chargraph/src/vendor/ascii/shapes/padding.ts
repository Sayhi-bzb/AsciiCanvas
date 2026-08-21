import type { ShapeRenderOptions } from './types.js'

export const getShapePadding = (options: ShapeRenderOptions) => ({
  x: options.paddingX ?? options.padding,
  y: options.paddingY ?? options.padding,
})
