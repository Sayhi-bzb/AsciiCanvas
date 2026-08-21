// @ts-nocheck -- pinned upstream source; validated at the package boundary.
// ============================================================================
// Rounded rectangle shape renderer — uses rounded corner decorators
// ============================================================================

import type { ShapeRenderer } from './types.js'
import { getBoxDimensions, renderBox, getBoxAttachmentPoint } from './rectangle.js'
import { getCorners } from './corners.js'

/**
 * Rounded rectangle shape renderer.
 * Uses rounded corner markers (╭╮╰╯) to indicate soft edges.
 *
 * Renders as:
 *   ╭─────────╮
 *   │  Label  │
 *   ╰─────────╯
 */
export const roundedRenderer: ShapeRenderer = {
  getDimensions: getBoxDimensions,

  render(label, dimensions, options) {
    const corners = getCorners('rounded', options.useAscii)
    return renderBox(label, dimensions, corners, options.useAscii)
  },

  getAttachmentPoint: getBoxAttachmentPoint,
}
