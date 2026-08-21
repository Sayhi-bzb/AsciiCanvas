// @ts-nocheck -- pinned upstream source; validated at the package boundary.
// ============================================================================
// Circle shape renderer — uses corner decorators instead of curves
// ============================================================================

import type { ShapeRenderer } from './types.js'
import { getBoxDimensions, renderBox, getBoxAttachmentPoint } from './rectangle.js'
import { getCorners } from './corners.js'

/**
 * Circle shape renderer.
 * Uses circle markers (◯) at corners to indicate circular shape semantics.
 *
 * Renders as:
 *   ◯─────────◯
 *   │  Label  │
 *   ◯─────────◯
 */
export const circleRenderer: ShapeRenderer = {
  getDimensions: getBoxDimensions,

  render(label, dimensions, options) {
    const corners = getCorners('circle', options.useAscii)
    return renderBox(label, dimensions, corners, options.useAscii)
  },

  getAttachmentPoint: getBoxAttachmentPoint,
}
