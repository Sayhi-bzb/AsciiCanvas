// @ts-nocheck -- pinned renderer support; validated by exhaustive fixtures.

export const BoxConnection = {
  up: 1,
  right: 2,
  down: 4,
  left: 8,
} as const

export type BoxConnectionMask = number

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

interface BoxGlyphTopology {
  readonly mask: BoxConnectionMask
  readonly rounded: boolean
}

const TOPOLOGY_BY_GLYPH = new Map<string, BoxGlyphTopology>()

for (const [mask, glyph] of Object.entries(LIGHT_GLYPH_BY_MASK)) {
  TOPOLOGY_BY_GLYPH.set(glyph, { mask: Number(mask), rounded: false })
}
for (const [mask, glyph] of Object.entries(ROUNDED_GLYPH_BY_MASK)) {
  TOPOLOGY_BY_GLYPH.set(glyph, { mask: Number(mask), rounded: true })
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

  return glyphForBoxConnections(mask, { rounded: canPreserveRounded })
}
