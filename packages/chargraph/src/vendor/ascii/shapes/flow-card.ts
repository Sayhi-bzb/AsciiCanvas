// @ts-nocheck -- pinned upstream source; validated at the package boundary.

import type { NodeShape } from '../../types.js'
import type { Canvas } from '../types.js'
import { splitLines } from '../multiline-utils.js'
import { getCorners } from './corners.js'
import { getBoxDimensions, renderBox } from './rectangle.js'
import type { ShapeDimensions, ShapeRenderOptions } from './types.js'

const UNICODE_MARKERS: Partial<Record<NodeShape, string>> = {
  stadium: '●',
  diamond: '◇',
  circle: '○',
  doublecircle: '◎',
  subroutine: '▣',
  cylinder: '▤',
  hexagon: '⬡',
  asymmetric: '▷',
  trapezoid: '╱',
  'trapezoid-alt': '╲',
}

const ASCII_MARKERS: Partial<Record<NodeShape, string>> = {
  stadium: '*',
  diamond: '?',
  circle: 'o',
  doublecircle: '@',
  subroutine: '#',
  cylinder: 'D',
  hexagon: 'H',
  asymmetric: '>',
  trapezoid: '/',
  'trapezoid-alt': '\\',
}

export interface FlowCardPresentation {
  canvas: Canvas
  dimensions: ShapeDimensions
  marker?: { x: number; y: number }
}

const markerForShape = (shape: NodeShape, useAscii: boolean) =>
  (useAscii ? ASCII_MARKERS : UNICODE_MARKERS)[shape]

export const createFlowCardPresentation = (
  shape: NodeShape,
  label: string,
  options: ShapeRenderOptions,
): FlowCardPresentation => {
  const marker = markerForShape(shape, options.useAscii)
  const lines = splitLines(label)
  const displayLines = marker
    ? lines.map((line, index) => `${index === 0 ? marker : ' '} ${line}`)
    : lines
  const displayLabel = displayLines.join('\n')
  const dimensions = getBoxDimensions(displayLabel, options)
  const canvas = renderBox(
    displayLabel,
    dimensions,
    getCorners(options.useAscii ? 'rectangle' : 'rounded', options.useAscii),
    options.useAscii,
  )

  if (!marker) return { canvas, dimensions }

  const widthWithoutLastColumn = dimensions.width - 1
  const heightWithoutLastRow = dimensions.height - 1
  const firstLine = displayLines[0] ?? ''
  const markerX = Math.floor(widthWithoutLastColumn / 2)
    - Math.ceil(firstLine.length / 2)
    + 1
  const markerY = Math.floor(heightWithoutLastRow / 2)
    - Math.floor((displayLines.length - 1) / 2)

  return {
    canvas,
    dimensions,
    marker: { x: markerX, y: markerY },
  }
}
