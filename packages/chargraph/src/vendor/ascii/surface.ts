import type {
  AsciiRenderSurface,
  Canvas,
  MermaidStyleRole,
  MermaidStyleRoleCanvas,
  RoleCanvas,
} from './types.js'

export interface AsciiStyleRun {
  text: string
  role: MermaidStyleRole | null
}

export const styleRoleFromCharRole = (
  role: RoleCanvas[number][number],
): MermaidStyleRole | null => {
  if (role === 'text') return 'node.text'
  if (role === 'arrow') return 'edge.arrow'
  if (role === 'border') return 'node.border'
  if (role === 'line' || role === 'corner' || role === 'junction') return 'edge.line'
  return null
}

export const surfaceFromRoleCanvas = (
  canvas: Canvas,
  roles: RoleCanvas,
): AsciiRenderSurface => ({
  canvas,
  styleRoleCanvas: canvas.map((column, x) =>
    column.map((_, y) => styleRoleFromCharRole(roles[x]?.[y] ?? null)),
  ),
})

export const cropSurface = (surface: AsciiRenderSurface): AsciiRenderSurface => {
  const { canvas, styleRoleCanvas } = surface
  let minX = canvas.length
  let maxX = -1
  let minY = canvas[0]?.length ?? 0
  let maxY = -1
  for (let x = 0; x < canvas.length; x += 1) {
    for (let y = 0; y < (canvas[0]?.length ?? 0); y += 1) {
      if ((canvas[x]?.[y] ?? ' ') === ' ') continue
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }
  if (maxX < minX || maxY < minY) {
    return { canvas: [[' ']], styleRoleCanvas: [[null]] }
  }
  return {
    canvas: Array.from({ length: maxX - minX + 1 }, (_, x) =>
      Array.from({ length: maxY - minY + 1 }, (_, y) =>
        canvas[minX + x]![minY + y]!,
      ),
    ),
    styleRoleCanvas: Array.from({ length: maxX - minX + 1 }, (_, x) =>
      Array.from({ length: maxY - minY + 1 }, (_, y) =>
        styleRoleCanvas[minX + x]?.[minY + y] ?? null,
      ),
    ),
  }
}

export const surfaceToStyleRuns = (
  {
    canvas,
    styleRoleCanvas,
    trimTrailingSpaces = false,
    trimTrailingLines = false,
  }: AsciiRenderSurface,
): AsciiStyleRun[] => {
  if (canvas.length === 0) return []
  const height = canvas[0]?.length ?? 0
  const rowEnds = Array.from({ length: height }, (_, y) => {
    if (!trimTrailingSpaces) return canvas.length - 1
    let end = canvas.length - 1
    while (end >= 0 && (canvas[end]?.[y] ?? ' ') === ' ') end -= 1
    return end
  })
  let lastRow = rowEnds.length - 1
  if (trimTrailingLines) {
    while (lastRow >= 0 && rowEnds[lastRow] === -1) lastRow -= 1
  }
  if (lastRow < 0) return []

  const runs: AsciiStyleRun[] = []
  const append = (text: string, role: MermaidStyleRole | null) => {
    if (!text) return
    const previous = runs[runs.length - 1]
    if (previous?.role === role) previous.text += text
    else runs.push({ text, role })
  }
  for (let y = 0; y <= lastRow; y += 1) {
    for (let x = 0; x <= rowEnds[y]!; x += 1) {
      append(canvas[x]?.[y] ?? ' ', styleRoleCanvas[x]?.[y] ?? null)
    }
    if (y < lastRow) append('\n', null)
  }
  return runs
}

export const surfaceToString = (surface: AsciiRenderSurface) =>
  surfaceToStyleRuns(surface).map((run) => run.text).join('')

export const createStyleRoleCanvas = (
  width: number,
  height: number,
): MermaidStyleRoleCanvas => Array.from(
  { length: width },
  () => Array.from<MermaidStyleRole | null>({ length: height }).fill(null),
)
