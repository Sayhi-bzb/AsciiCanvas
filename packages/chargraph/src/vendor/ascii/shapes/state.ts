// @ts-nocheck -- pinned renderer support; validated at the package boundary.

import type { Canvas, DrawingCoord, Direction } from '../types.js'
import { mkCanvas } from '../canvas.js'
import type { ShapeRenderer, ShapeDimensions, ShapeRenderOptions } from './types.js'

function dimensions(): ShapeDimensions {
  return {
    width: 1,
    height: 1,
    labelArea: { x: 0, y: 0, width: 1, height: 1 },
    gridColumns: [0, 1, 0],
    gridRows: [0, 1, 0],
  }
}

function renderSymbol(symbol: string): Canvas {
  const canvas = mkCanvas(0, 0)
  canvas[0]![0] = symbol
  return canvas
}

function attachment(_dir: Direction, _dimensions: ShapeDimensions, base: DrawingCoord): DrawingCoord {
  return base
}

/** UML initial pseudo-state: a single filled point, never a boxed node. */
export const stateStartRenderer: ShapeRenderer = {
  getDimensions: dimensions,
  render(_label: string, _dimensions: ShapeDimensions, options: ShapeRenderOptions): Canvas {
    return renderSymbol(options.useAscii ? '*' : '●')
  },
  getAttachmentPoint: attachment,
}

/** UML final pseudo-state: a single bullseye, never a boxed node. */
export const stateEndRenderer: ShapeRenderer = {
  getDimensions: dimensions,
  render(_label: string, _dimensions: ShapeDimensions, options: ShapeRenderOptions): Canvas {
    return renderSymbol(options.useAscii ? 'O' : '◎')
  },
  getAttachmentPoint: attachment,
}
