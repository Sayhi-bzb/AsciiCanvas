// @ts-nocheck -- pinned upstream source; validated at the package boundary.
// ============================================================================
// ASCII renderer — sequence diagrams
//
// Renders sequenceDiagram text to ASCII/Unicode art using a column-based layout.
// Each actor occupies a column with a vertical lifeline; messages are horizontal
// arrows between lifelines. Blocks (loop/alt/opt/par) wrap around message groups.
//
// Layout is fundamentally different from flowcharts — no grid or A* pathfinding.
// Instead: actors → columns, messages → rows, all positioned linearly.
// ============================================================================

import { parseSequenceDiagram } from '../sequence/parser.js'
import type { SequenceDiagram, Block } from '../sequence/types.js'
import type { Canvas, AsciiConfig, RoleCanvas, CharRole, MermaidStyleRole } from './types.js'
import { mkCanvas, mkRoleCanvas, canvasToString, increaseSize, increaseRoleCanvasSize, setRole } from './canvas.js'
import { splitLines, maxLineWidth, lineCount } from './multiline-utils.js'
import { BoxConnection, glyphForBoxConnections, glyphForBoxCorner } from './box-drawing.js'
import { CharScene } from './scene.js'
import { prepareMermaidLines } from '../parse-utils.js'

const SELF_LOOP_WIDTH = 4
const SELF_LABEL_GAP = 2
const MESSAGE_CLEARANCE = 2
const MINIMUM_LIFELINE_GAP = 10

const selfMessageRight = (origin: number, label: string) =>
  origin + SELF_LOOP_WIDTH + SELF_LABEL_GAP + maxLineWidth(label)

/** Classify a box-drawing character as 'border' or 'text'. */
function classifyBoxChar(ch: string): CharRole {
  if (/^[┌┐└┘├┤┬┴┼│─╭╮╰╯+\-|]$/.test(ch)) return 'border'
  return 'text'
}

/**
 * Render a Mermaid sequence diagram to ASCII/Unicode text.
 *
 * Pipeline: parse → layout (columns + rows) → draw onto canvas → string.
 */
export function renderSequenceSurface(text: string, config: AsciiConfig) {
  const lines = prepareMermaidLines(text)
  const diagram = parseSequenceDiagram(lines)

  if (diagram.actors.length === 0) return { canvas: [], styleRoleCanvas: [] }

  const useAscii = config.useAscii

  // Box-drawing characters
  const glyph = (mask: number) => glyphForBoxConnections(mask, { useAscii })
  const H = glyph(BoxConnection.left | BoxConnection.right)
  const V = glyph(BoxConnection.up | BoxConnection.down)
  const TL = glyphForBoxCorner(BoxConnection.right | BoxConnection.down, { useAscii })
  const TR = glyphForBoxCorner(BoxConnection.down | BoxConnection.left, { useAscii })
  const BL = glyphForBoxCorner(BoxConnection.up | BoxConnection.right, { useAscii })
  const BR = glyphForBoxCorner(BoxConnection.up | BoxConnection.left, { useAscii })
  const JT = glyph(BoxConnection.right | BoxConnection.down | BoxConnection.left)
  const JB = glyph(BoxConnection.up | BoxConnection.right | BoxConnection.left)
  const JL = glyph(BoxConnection.up | BoxConnection.right | BoxConnection.down)
  const JR = glyph(BoxConnection.up | BoxConnection.down | BoxConnection.left)

  // ---- LAYOUT: compute lifeline X positions ----

  const actorIdx = new Map<string, number>()
  diagram.actors.forEach((a, i) => actorIdx.set(a.id, i))

  const boxPad = 1
  // Use max line width for multi-line actor labels
  const actorBoxWidths = diagram.actors.map(a => maxLineWidth(a.label) + 2 * boxPad + 2)
  const halfBox = actorBoxWidths.map(w => Math.ceil(w / 2))
  // Calculate actor box heights based on number of lines in label
  const actorBoxHeights = diagram.actors.map(a => lineCount(a.label) + 2) // lines + top/bottom border
  const actorBoxH = Math.max(...actorBoxHeights, 3) // Use max height for consistent lifeline positioning

  // Every boundary between adjacent lifelines owns one minimum-distance constraint.
  const minimumLifelineGaps: number[] = new Array(
    Math.max(diagram.actors.length - 1, 0),
  ).fill(0)

  for (const msg of diagram.messages) {
    const fi = actorIdx.get(msg.from)!
    const ti = actorIdx.get(msg.to)!
    if (fi === ti) {
      if (fi < diagram.actors.length - 1) {
        minimumLifelineGaps[fi] = Math.max(
          minimumLifelineGaps[fi]!,
          selfMessageRight(0, msg.label) + MESSAGE_CLEARANCE,
        )
      }
      continue
    }
    const lo = Math.min(fi, ti)
    const hi = Math.max(fi, ti)
    // Required gap per span = (max line width + arrow decorations) / number of gaps
    const needed = maxLineWidth(msg.label) + 4
    const numGaps = hi - lo
    const perGap = Math.ceil(needed / numGaps)
    for (let g = lo; g < hi; g++) {
      minimumLifelineGaps[g] = Math.max(
        minimumLifelineGaps[g]!,
        perGap + MESSAGE_CLEARANCE,
      )
    }
  }

  // Compute lifeline x-positions (greedy left-to-right)
  const llX: number[] = [halfBox[0]!]
  for (let i = 1; i < diagram.actors.length; i++) {
    const gap = Math.max(
      halfBox[i - 1]! + halfBox[i]! + 2,
      minimumLifelineGaps[i - 1]!,
      MINIMUM_LIFELINE_GAP,
    )
    llX[i] = llX[i - 1]! + gap
  }

  // ---- LAYOUT: compute vertical positions for messages ----

  // For each message index, track the y where its arrow is drawn.
  // Also track block start/end y positions and divider y positions.
  const msgArrowY: number[] = []
  const msgLabelY: number[] = []
  const blockStartY = new Map<number, number>()
  const blockEndY = new Map<number, number>()
  const divYMap = new Map<string, number>() // "blockIdx:divIdx" → y
  const notePositions: Array<{ x: number; y: number; width: number; height: number; lines: string[] }> = []

  let curY = actorBoxH // start right below header boxes
  let eventY = actorBoxH

  const activationPositions: Array<{ actorId: string; action: 'activate' | 'deactivate'; y: number }> = []
  const blockIndexById = new Map(diagram.blocks.map((block, index) => [block.id, index]))
  const placeNote = (noteIndex: number) => {
    const note = diagram.notes[noteIndex]!
    curY += 1
    const nLines = splitLines(note.text)
    const nWidth = Math.max(...nLines.map(l => l.length)) + 4
    const nHeight = nLines.length + 2
    const aIdx = actorIdx.get(note.actorIds[0]!) ?? 0
    let nx: number
    if (note.position === 'left') {
      nx = llX[aIdx]! - nWidth - 1
    } else if (note.position === 'right') {
      nx = llX[aIdx]! + 2
    } else if (note.actorIds.length >= 2) {
      const aIdx2 = actorIdx.get(note.actorIds[1]!) ?? aIdx
      nx = Math.floor((llX[aIdx]! + llX[aIdx2]!) / 2) - Math.floor(nWidth / 2)
    } else {
      nx = llX[aIdx]! - Math.floor(nWidth / 2)
    }
    nx = Math.max(0, nx)
    notePositions[noteIndex] = { x: nx, y: curY, width: nWidth, height: nHeight, lines: nLines }
    curY += nHeight
    eventY = curY
  }

  for (const event of diagram.timeline) {
    if (event.kind === 'block-start') {
      const blockIndex = blockIndexById.get(event.blockId)
      if (blockIndex !== undefined) {
        curY += 2 // 1 blank + 1 header row
        blockStartY.set(blockIndex, curY - 1)
        eventY = curY
      }
      continue
    }
    if (event.kind === 'block-divider') {
      const blockIndex = blockIndexById.get(event.blockId)
      if (blockIndex !== undefined) {
        curY += 1
        divYMap.set(`${blockIndex}:${event.dividerIndex}`, curY)
        curY += 1
        eventY = curY
      }
      continue
    }
    if (event.kind === 'block-end') {
      const blockIndex = blockIndexById.get(event.blockId)
      if (blockIndex !== undefined) {
        curY += 1
        blockEndY.set(blockIndex, curY)
        curY += 1
        eventY = curY
      }
      continue
    }
    if (event.kind === 'note') {
      placeNote(event.index)
      continue
    }
    if (event.kind === 'activation') {
      const activation = diagram.activationEvents[event.index]!
      activationPositions.push({ ...activation, y: eventY })
      continue
    }
    if (event.kind === 'message') {
      const m = event.index
      curY += 1 // blank row before message
      const msg = diagram.messages[m]!
      const msgLineCount = lineCount(msg.label)
      if (msg.from === msg.to) {
        msgLabelY[m] = curY + 1
        msgArrowY[m] = curY
        curY += 2 + msgLineCount
        eventY = curY - 1
      } else {
        msgLabelY[m] = curY
        msgArrowY[m] = curY + msgLineCount
        curY += msgLineCount + 1
        eventY = msgArrowY[m]!
      }
      if (msg.activate) activationPositions.push({ actorId: msg.to, action: 'activate', y: msgArrowY[m]! })
      if (msg.deactivate) activationPositions.push({ actorId: msg.from, action: 'deactivate', y: msgArrowY[m]! })
    }
  }

  curY += 1 // gap before footer
  const footerY = curY
  const totalH = footerY + actorBoxH

  // Total canvas width
  const lastLL = llX[llX.length - 1] ?? 0
  const lastHalf = halfBox[halfBox.length - 1] ?? 0
  let totalW = lastLL + lastHalf + 2

  // Ensure canvas is wide enough for self-message labels and notes
  for (let m = 0; m < diagram.messages.length; m++) {
    const msg = diagram.messages[m]!
    if (msg.from === msg.to) {
      const fi = actorIdx.get(msg.from)!
      totalW = Math.max(
        totalW,
        selfMessageRight(llX[fi]!, msg.label) + MESSAGE_CLEARANCE,
      )
    }
  }
  for (const np of notePositions) {
    totalW = Math.max(totalW, np.x + np.width + 1)
  }

  const canvas = mkCanvas(totalW, totalH - 1)
  const rc = mkRoleCanvas(totalW, totalH - 1)
  const scene = new CharScene(totalW + 1, totalH, useAscii)
  let currentOwner = 'sequence'

  /** Set a character on the canvas and track its role. */
  function setC(
    x: number,
    y: number,
    ch: string,
    role: CharRole,
    styleRole: MermaidStyleRole,
  ): void {
    if (x < 0 || y < 0) return
    scene.write(x, y, ch, role, {
      owner: currentOwner,
      reserve: role === 'text',
      styleRole,
    })
  }

  // ---- DRAW: helper to place a bordered actor box (supports multi-line labels) ----

  function drawActorBox(cx: number, topY: number, label: string): void {
    const lines = splitLines(label)
    const maxW = maxLineWidth(label)
    const w = maxW + 2 * boxPad + 2
    const h = lines.length + 2  // lines + top/bottom border
    const left = cx - Math.floor(w / 2)

    // Top border
    setC(left, topY, TL, 'border', 'node.border')
    for (let x = 1; x < w - 1; x++) setC(left + x, topY, H, 'border', 'node.border')
    setC(left + w - 1, topY, TR, 'border', 'node.border')

    // Content lines (centered horizontally within the box)
    for (let i = 0; i < lines.length; i++) {
      const row = topY + 1 + i
      setC(left, row, V, 'border', 'node.border')
      setC(left + w - 1, row, V, 'border', 'node.border')
      for (let x = left + 1; x < left + w - 1; x++) setC(x, row, ' ', 'text', 'node.background')
      // Center this line within the box
      const line = lines[i]!
      const ls = left + 1 + boxPad + Math.floor((maxW - line.length) / 2)
      for (let j = 0; j < line.length; j++) {
        setC(ls + j, row, line[j]!, 'text', 'node.text')
      }
    }

    // Bottom border
    const bottomY = topY + h - 1
    setC(left, bottomY, BL, 'border', 'node.border')
    for (let x = 1; x < w - 1; x++) setC(left + x, bottomY, H, 'border', 'node.border')
    setC(left + w - 1, bottomY, BR, 'border', 'node.border')
  }

  // ---- DRAW: lifelines ----

  for (let i = 0; i < diagram.actors.length; i++) {
    currentOwner = `lifeline:${diagram.actors[i]!.id}`
    const x = llX[i]!
    for (let y = actorBoxH; y <= footerY; y++) {
      setC(x, y, V, 'line', 'node.border')
    }
  }

  // ---- DRAW: actor header + footer boxes (drawn over lifelines) ----

  const activeSince = new Map<string, number[]>()
  const activations: Array<{ actorId: string; top: number; bottom: number }> = []
  const activate = (actorId: string, y: number) => {
    const starts = activeSince.get(actorId) ?? []
    starts.push(y)
    activeSince.set(actorId, starts)
  }
  const deactivate = (actorId: string, y: number) => {
    const starts = activeSince.get(actorId)
    const top = starts?.pop()
    if (top === undefined) {
      throw new Error(`Cannot deactivate inactive participant: "${actorId}"`)
    }
    if (starts.length === 0) {
      activations.push({ actorId, top, bottom: y })
      activeSince.delete(actorId)
    }
  }
  for (const event of activationPositions) {
    if (event.action === 'activate') activate(event.actorId, event.y)
    else deactivate(event.actorId, event.y)
  }
  for (const [actorId, starts] of activeSince) {
    activations.push({ actorId, top: starts[0]!, bottom: footerY - 1 })
  }
  for (const activation of activations) {
    currentOwner = `activation:${activation.actorId}:${activation.top}`
    const x = llX[actorIdx.get(activation.actorId)!]!
    const char = useAscii ? '|' : '┃'
    for (let y = activation.top; y <= Math.min(activation.bottom, footerY - 1); y++) {
      setC(x, y, char, 'border', 'sequence.activation')
    }
  }

  for (let i = 0; i < diagram.actors.length; i++) {
    const actor = diagram.actors[i]!
    currentOwner = `actor:${actor.id}`
    drawActorBox(llX[i]!, 0, actor.label)
    drawActorBox(llX[i]!, footerY, actor.label)

    // Lifeline junctions on box borders (Unicode only)
    if (!useAscii) {
      setC(llX[i]!, actorBoxH - 1, JT, 'junction', 'node.border')
      setC(llX[i]!, footerY, JB, 'junction', 'node.border')
    }
  }

  // ---- DRAW: messages ----

  const markerFor = (head: 'filled' | 'open' | 'cross', right: boolean) => {
    if (head === 'cross') return 'x'
    if (head === 'open') return right ? ')' : '('
    return right ? '>' : '<'
  }

  for (let m = 0; m < diagram.messages.length; m++) {
    const msg = diagram.messages[m]!
    currentOwner = `message:${m}`
    const fi = actorIdx.get(msg.from)!
    const ti = actorIdx.get(msg.to)!
    const fromX = llX[fi]!
    const toX = llX[ti]!
    const isSelf = fi === ti
    const isDashed = msg.lineStyle === 'dashed'
    // Arrow line character (solid vs dashed)
    const lineChar = isDashed ? (useAscii ? '.' : '╌') : H

    if (isSelf) {
      // Self-message: 3-row loop to the right of the lifeline
      //   ├──╮           (row 0 = msgArrowY)
      //   │  │ Label     (row 1)
      //   │<─╯           (last row)
      const y0 = msgArrowY[m]!
      const msgLines = splitLines(msg.label)
      const bottomY = y0 + msgLines.length + 1

      // Row 0: start junction + horizontal + top-right corner
      setC(fromX, y0, JL, 'junction', 'node.border')
      for (let x = fromX + 1; x < fromX + SELF_LOOP_WIDTH; x++) setC(x, y0, lineChar, 'line', 'node.border')
      setC(fromX + SELF_LOOP_WIDTH, y0, TR, 'corner', 'node.border')

      // Label rows: vertical on right side + one line of text
      const labelX = fromX + SELF_LOOP_WIDTH + SELF_LABEL_GAP
      for (let lineIndex = 0; lineIndex < msgLines.length; lineIndex++) {
        const row = y0 + lineIndex + 1
        const line = msgLines[lineIndex]!
        setC(fromX + SELF_LOOP_WIDTH, row, V, 'line', 'node.border')
        for (let index = 0; index < line.length; index++) {
          if (labelX + index < totalW) {
            setC(labelX + index, row, line[index]!, 'text', 'edge.label')
          }
        }
      }

      // Last row: arrow-back + horizontal + bottom-right corner
      setC(fromX, bottomY, markerFor(msg.arrowHead, false), 'arrow', 'node.border')
      for (let x = fromX + 1; x < fromX + SELF_LOOP_WIDTH; x++) setC(x, bottomY, lineChar, 'line', 'node.border')
      setC(fromX + SELF_LOOP_WIDTH, bottomY, BR, 'corner', 'node.border')
    } else {
      // Normal message: label on row above, arrow on row below
      const labelY = msgLabelY[m]!
      const arrowY = msgArrowY[m]!
      const leftToRight = fromX < toX

      // Draw label centered between the two lifelines (supports multi-line)
      const midX = Math.floor((fromX + toX) / 2)
      const msgLines = splitLines(msg.label)

      for (let lineIdx = 0; lineIdx < msgLines.length; lineIdx++) {
        const line = msgLines[lineIdx]!
        const labelStart = midX - Math.floor(line.length / 2)
        const y = labelY + lineIdx
        for (let i = 0; i < line.length; i++) {
          const lx = labelStart + i
          if (lx >= 0 && lx < totalW) setC(lx, y, line[i]!, 'text', 'edge.label')
        }
      }

      // Draw arrow line
      if (leftToRight) {
        setC(fromX, arrowY, JL, 'junction', 'node.border')
        for (let x = fromX + 1; x < toX - 1; x++) setC(x, arrowY, lineChar, 'line', 'node.border')
        // Keep the target lifeline visible: the marker occupies the adjacent cell.
        setC(toX - 1, arrowY, markerFor(msg.arrowHead, true), 'arrow', 'node.border')
      } else {
        setC(fromX, arrowY, JR, 'junction', 'node.border')
        for (let x = toX + 2; x < fromX; x++) setC(x, arrowY, lineChar, 'line', 'node.border')
        setC(toX + 1, arrowY, markerFor(msg.arrowHead, false), 'arrow', 'node.border')
      }
    }
  }

  // ---- DRAW: blocks (loop, alt, opt, par, etc.) ----

  for (let b = 0; b < diagram.blocks.length; b++) {
    const block = diagram.blocks[b]!
    currentOwner = `block:${b}`
    const topY = blockStartY.get(b)
    const botY = blockEndY.get(b)
    if (topY === undefined || botY === undefined) continue

    // Find the leftmost/rightmost lifelines involved in this block's messages
    let minLX = totalW
    let maxLX = 0
    for (let m = block.startIndex; m <= block.endIndex; m++) {
      if (m >= diagram.messages.length) break
      const msg = diagram.messages[m]!
      const f = actorIdx.get(msg.from) ?? 0
      const t = actorIdx.get(msg.to) ?? 0
      minLX = Math.min(minLX, llX[Math.min(f, t)]!)
      maxLX = Math.max(maxLX, llX[Math.max(f, t)]!)
    }

    const bLeft = Math.max(0, minLX - 4)
    const bRight = Math.min(totalW - 1, maxLX + 4)

    // Top border with block type label
    setC(bLeft, topY, TL, 'border', 'container.border')
    for (let x = bLeft + 1; x < bRight; x++) setC(x, topY, H, 'border', 'container.border')
    setC(bRight, topY, TR, 'border', 'container.border')
    // Write block header label over the top border (supports multi-line)
    const hdrLabel = block.label ? `${block.type} [${block.label}]` : block.type
    const hdrLines = splitLines(hdrLabel)

    for (let lineIdx = 0; lineIdx < hdrLines.length && topY + lineIdx < botY; lineIdx++) {
      const line = hdrLines[lineIdx]!
      for (let i = 0; i < line.length && bLeft + 1 + i < bRight; i++) {
        setC(bLeft + 1 + i, topY + lineIdx, line[i]!, 'text', 'container.title')
      }
    }

    // Bottom border
    setC(bLeft, botY, BL, 'border', 'container.border')
    for (let x = bLeft + 1; x < bRight; x++) setC(x, botY, H, 'border', 'container.border')
    setC(bRight, botY, BR, 'border', 'container.border')

    // Side borders
    for (let y = topY + 1; y < botY; y++) {
      setC(bLeft, y, V, 'border', 'container.border')
      setC(bRight, y, V, 'border', 'container.border')
    }

    // Dividers
    for (let d = 0; d < block.dividers.length; d++) {
      const dY = divYMap.get(`${b}:${d}`)
      if (dY === undefined) continue
      const dashChar = isDashedH()
      setC(bLeft, dY, JL, 'junction', 'container.border')
      for (let x = bLeft + 1; x < bRight; x++) setC(x, dY, dashChar, 'border', 'container.border')
      setC(bRight, dY, JR, 'junction', 'container.border')
      // Divider label
      const dLabel = block.dividers[d]!.label
      if (dLabel) {
        const dStr = `[${dLabel}]`
        for (let i = 0; i < dStr.length && bLeft + 1 + i < bRight; i++) {
          setC(bLeft + 1 + i, dY, dStr[i]!, 'text', 'container.title')
        }
      }
    }
  }

  // ---- DRAW: notes ----

  for (const [noteIndex, np] of notePositions.entries()) {
    currentOwner = `note:${noteIndex}`
    // Ensure canvas is big enough
    increaseSize(canvas, np.x + np.width, np.y + np.height)
    increaseRoleCanvasSize(rc, np.x + np.width, np.y + np.height)
    // Reserve the note rectangle so lifelines do not leak through its interior.
    for (let x = np.x + 1; x < np.x + np.width - 1; x++) {
      for (let y = np.y + 1; y < np.y + np.height - 1; y++) setC(x, y, ' ', 'text', 'node.background')
    }
    scene.add({
      kind: 'box',
      owner: currentOwner,
      x: np.x,
      y: np.y,
      width: np.width,
      height: np.height,
      styleRole: 'node.border',
    })
    for (let l = 0; l < np.lines.length; l++) {
      const ly = np.y + 1 + l
      scene.add({
        kind: 'label',
        owner: currentOwner,
        at: { x: np.x + 2, y: ly },
        text: np.lines[l]!,
        styleRole: 'node.text',
      })
    }
  }

  const composed = scene.compose()
  return { canvas: composed.canvas, styleRoleCanvas: composed.styleRoleCanvas }

  // ---- Helper: dashed horizontal character ----
  function isDashedH(): string {
    return useAscii ? '-' : '╌'
  }
}

export function renderSequenceAscii(text: string, config: AsciiConfig): string {
  return canvasToString(renderSequenceSurface(text, config).canvas)
}
