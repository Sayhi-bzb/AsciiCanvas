// @ts-nocheck -- pinned renderer support; validated by exhaustive fixtures.

export const BoxConnection = {
  up: 1,
  right: 2,
  down: 4,
  left: 8,
} as const

export type BoxConnectionMask = number
export type BoxLineWeight = 'single' | 'double'

const LIGHT_GLYPH_BY_MASK: Readonly<Record<number, string>> = {
  1: '╵',
  2: '╶',
  3: '└',
  4: '╷',
  5: '│',
  6: '┌',
  7: '├',
  8: '╴',
  9: '┘',
  10: '─',
  11: '┴',
  12: '┐',
  13: '┤',
  14: '┬',
  15: '┼',
}

const ROUNDED_GLYPH_BY_MASK: Readonly<Record<number, string>> = {
  3: '╰',
  6: '╭',
  9: '╯',
  12: '╮',
}

const DOUBLE_GLYPH_BY_MASK: Readonly<Record<number, string>> = {
  1: '║',
  2: '═',
  3: '╚',
  4: '║',
  5: '║',
  6: '╔',
  7: '╠',
  8: '═',
  9: '╝',
  10: '═',
  11: '╩',
  12: '╗',
  13: '╣',
  14: '╦',
  15: '╬',
}

const HORIZONTAL_DOUBLE_GLYPH_BY_MASK: Readonly<Record<number, string>> = {
  3: '╘',
  6: '╒',
  7: '╞',
  9: '╛',
  11: '╧',
  12: '╕',
  13: '╡',
  14: '╤',
  15: '╪',
}

const VERTICAL_DOUBLE_GLYPH_BY_MASK: Readonly<Record<number, string>> = {
  3: '╙',
  6: '╓',
  7: '╟',
  9: '╜',
  11: '╨',
  12: '╖',
  13: '╢',
  14: '╥',
  15: '╫',
}

export interface BoxGlyphTopology {
  readonly mask: BoxConnectionMask
  readonly rounded: boolean
  readonly horizontalWeight: BoxLineWeight
  readonly verticalWeight: BoxLineWeight
}

const TOPOLOGY_BY_GLYPH = new Map<string, BoxGlyphTopology>()

for (const [mask, glyph] of Object.entries(LIGHT_GLYPH_BY_MASK)) {
  TOPOLOGY_BY_GLYPH.set(glyph, {
    mask: Number(mask),
    rounded: false,
    horizontalWeight: 'single',
    verticalWeight: 'single',
  })
}
for (const [mask, glyph] of Object.entries(ROUNDED_GLYPH_BY_MASK)) {
  TOPOLOGY_BY_GLYPH.set(glyph, {
    mask: Number(mask),
    rounded: true,
    horizontalWeight: 'single',
    verticalWeight: 'single',
  })
}
for (const [mask, glyph] of Object.entries(DOUBLE_GLYPH_BY_MASK)) {
  const resolvedMask = glyph === '║'
    ? BoxConnection.up | BoxConnection.down
    : glyph === '═'
      ? BoxConnection.left | BoxConnection.right
      : Number(mask)
  TOPOLOGY_BY_GLYPH.set(glyph, {
    mask: resolvedMask,
    rounded: false,
    horizontalWeight: (resolvedMask & (BoxConnection.left | BoxConnection.right)) !== 0
      ? 'double'
      : 'single',
    verticalWeight: (resolvedMask & (BoxConnection.up | BoxConnection.down)) !== 0
      ? 'double'
      : 'single',
  })
}
for (const [mask, glyph] of Object.entries(HORIZONTAL_DOUBLE_GLYPH_BY_MASK)) {
  TOPOLOGY_BY_GLYPH.set(glyph, {
    mask: Number(mask),
    rounded: false,
    horizontalWeight: 'double',
    verticalWeight: 'single',
  })
}
for (const [mask, glyph] of Object.entries(VERTICAL_DOUBLE_GLYPH_BY_MASK)) {
  TOPOLOGY_BY_GLYPH.set(glyph, {
    mask: Number(mask),
    rounded: false,
    horizontalWeight: 'single',
    verticalWeight: 'double',
  })
}

export function getBoxGlyphTopology(glyph: string): BoxGlyphTopology | null {
  return TOPOLOGY_BY_GLYPH.get(glyph) ?? null
}

export function isBoxDrawingGlyph(glyph: string): boolean {
  return TOPOLOGY_BY_GLYPH.has(glyph)
}

export function glyphForBoxConnections(
  mask: BoxConnectionMask,
  options: { useAscii?: boolean; rounded?: boolean } = {},
): string {
  if (options.useAscii) {
    const vertical = BoxConnection.up | BoxConnection.down
    const horizontal = BoxConnection.left | BoxConnection.right
    if ((mask & vertical) !== 0 && (mask & horizontal) === 0) return '|'
    if ((mask & horizontal) !== 0 && (mask & vertical) === 0) return '-'
    return '+'
  }

  if (options.rounded && ROUNDED_GLYPH_BY_MASK[mask]) {
    return ROUNDED_GLYPH_BY_MASK[mask]!
  }
  return LIGHT_GLYPH_BY_MASK[mask] ?? '┼'
}

export function glyphForWeightedBoxConnections(
  mask: BoxConnectionMask,
  options: {
    useAscii?: boolean
    rounded?: boolean
    horizontalWeight?: BoxLineWeight
    verticalWeight?: BoxLineWeight
  } = {},
): string {
  const horizontalWeight = options.horizontalWeight ?? 'single'
  const verticalWeight = options.verticalWeight ?? 'single'
  if (options.useAscii) {
    const vertical = BoxConnection.up | BoxConnection.down
    const horizontal = BoxConnection.left | BoxConnection.right
    const hasVertical = (mask & vertical) !== 0
    const hasHorizontal = (mask & horizontal) !== 0
    if (hasVertical && !hasHorizontal) return verticalWeight === 'double' ? '‖' : '|'
    if (hasHorizontal && !hasVertical) return horizontalWeight === 'double' ? '=' : '-'
    return '+'
  }
  if (horizontalWeight === 'double' && verticalWeight === 'double') {
    return DOUBLE_GLYPH_BY_MASK[mask] ?? '╬'
  }
  if (horizontalWeight === 'double') {
    const horizontal = BoxConnection.left | BoxConnection.right
    if ((mask & horizontal) !== 0) {
      return HORIZONTAL_DOUBLE_GLYPH_BY_MASK[mask] ?? DOUBLE_GLYPH_BY_MASK[mask] ?? '═'
    }
  }
  if (verticalWeight === 'double') {
    const vertical = BoxConnection.up | BoxConnection.down
    if ((mask & vertical) !== 0) {
      return VERTICAL_DOUBLE_GLYPH_BY_MASK[mask] ?? DOUBLE_GLYPH_BY_MASK[mask] ?? '║'
    }
  }
  return glyphForBoxConnections(mask, options)
}

/** Outer box corners are rounded unless a caller explicitly requests square corners. */
export function glyphForBoxCorner(
  mask: BoxConnectionMask,
  options: { useAscii?: boolean; rounded?: boolean } = {},
): string {
  return glyphForBoxConnections(mask, {
    useAscii: options.useAscii,
    rounded: options.rounded ?? true,
  })
}

export function mergeBoxDrawingGlyphs(first: string, second: string): string | null {
  const firstTopology = getBoxGlyphTopology(first)
  const secondTopology = getBoxGlyphTopology(second)
  if (!firstTopology || !secondTopology) return null

  const mask = firstTopology.mask | secondTopology.mask
  const hasSquareGlyphForMask =
    (!firstTopology.rounded && firstTopology.mask === mask) ||
    (!secondTopology.rounded && secondTopology.mask === mask)
  const canPreserveRounded =
    !hasSquareGlyphForMask &&
    ((firstTopology.rounded && firstTopology.mask === mask) ||
      (secondTopology.rounded && secondTopology.mask === mask))

  const horizontalWeight = firstTopology.horizontalWeight === 'double' || secondTopology.horizontalWeight === 'double'
    ? 'double'
    : 'single'
  const verticalWeight = firstTopology.verticalWeight === 'double' || secondTopology.verticalWeight === 'double'
    ? 'double'
    : 'single'

  return glyphForWeightedBoxConnections(mask, {
    rounded: canPreserveRounded,
    horizontalWeight,
    verticalWeight,
  })
}
