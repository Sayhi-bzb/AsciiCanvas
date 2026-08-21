// @ts-nocheck -- pinned upstream source; validated at the package boundary.
// ============================================================================
// Hexagon shape renderer — uses corner decorators instead of diagonals
// ============================================================================

import type { ShapeRenderer } from './types.js'
import { getBoxDimensions, renderBox, getBoxAttachmentPoint } from './rectangle.js'
import { getCorners } from './corners.js'

/**
 * Hexagon shape renderer.
 * Uses hexagon markers (⬡) at corners to indicate process node semantics.
 *
 * Renders as:
 *   ⬡─────────⬡
 *   │  Label  │
 *   ⬡─────────⬡
 */
export const hexagonRenderer: ShapeRenderer = {
  getDimensions: getBoxDimensions,

  render(label, dimensions, options) {
    const corners = getCorners('hexagon', options.useAscii)
    return renderBox(label, dimensions, corners, options.useAscii)
  },

  getAttachmentPoint: getBoxAttachmentPoint,
}
