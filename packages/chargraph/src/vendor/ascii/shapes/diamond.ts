// @ts-nocheck -- pinned upstream source; validated at the package boundary.
// ============================================================================
// Diamond shape renderer — uses corner decorators instead of diagonals
// ============================================================================

import type { ShapeRenderer } from './types.js'
import { getBoxDimensions, renderBox, getBoxAttachmentPoint } from './rectangle.js'
import { getCorners } from './corners.js'

/**
 * Diamond shape renderer.
 * Uses diamond markers (◇) at corners to indicate decision node semantics.
 *
 * Renders as:
 *   ◇─────────◇
 *   │  Label  │
 *   ◇─────────◇
 */
export const diamondRenderer: ShapeRenderer = {
  getDimensions: getBoxDimensions,

  render(label, dimensions, options) {
    const corners = getCorners('diamond', options.useAscii)
    return renderBox(label, dimensions, corners, options.useAscii)
  },

  getAttachmentPoint: getBoxAttachmentPoint,
}
