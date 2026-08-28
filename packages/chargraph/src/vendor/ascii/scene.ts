// @ts-nocheck -- internal renderer scene; exercised at the package boundary.

import type { Canvas, CharRole, MermaidStyleRole, MermaidStyleRoleCanvas, RoleCanvas } from './types.js'
import type { BoxLineWeight } from './box-drawing.js'
import {
  BoxConnection,
  getBoxGlyphTopology,
  glyphForBoxConnections,
  glyphForBoxCorner,
  glyphForWeightedBoxConnections,
} from './box-drawing.js'

function blankCanvas(maxX: number, maxY: number): Canvas {
  return Array.from({ length: maxX + 1 }, () => Array.from({ length: maxY + 1 }, () => ' '))
}

function blankRoleCanvas(maxX: number, maxY: number): RoleCanvas {
  return Array.from({ length: maxX + 1 }, () => Array.from({ length: maxY + 1 }, () => null))
}

function blankStyleRoleCanvas(maxX: number, maxY: number): MermaidStyleRoleCanvas {
  return Array.from({ length: maxX + 1 }, () => Array.from({ length: maxY + 1 }, () => null))
}

export interface SceneWriteOptions {
  owner?: string
  /** Semantic owners that this topology is allowed to connect to. */
  connections?: readonly string[]
  /** Exact directional topology when the display glyph is ambiguous. */
  topologyMask?: number
  /** Stroke weight retained while topology is composed. */
  topologyWeight?: BoxLineWeight
  /** Text spaces reserve cells instead of being discarded. */
  reserve?: boolean
  styleRole?: MermaidStyleRole
  topology?: 'shared' | 'independent'
  /** Only strokes in the same explicit route bundle may share topology. */
  bundleId?: string
  /** Visual plane; independent from whether two contributions share topology. */
  layer?: SceneLayer
}

export interface ScenePoint { x: number; y: number }

export type SceneLayer = 'background' | 'edge' | 'container' | 'node' | 'label' | 'marker'

export interface BoxPrimitive {
  kind: 'box'
  owner: string
  x: number
  y: number
  width: number
  height: number
  rounded?: boolean
  styleRole?: MermaidStyleRole
  layer?: SceneLayer
}

export interface StrokePrimitive {
  kind: 'stroke'
  owner: string
  points: ScenePoint[]
  role?: 'line' | 'border'
  style?: 'solid' | 'dotted' | 'thick'
  rounded?: boolean
  connections?: readonly string[]
  styleRole?: MermaidStyleRole
  topology?: 'shared' | 'independent'
  bundleId?: string
  layer?: SceneLayer
}

export interface MarkerPrimitive {
  kind: 'marker'
  owner: string
  at: ScenePoint
  char: string
  styleRole?: MermaidStyleRole
  bundleId?: string
  layer?: SceneLayer
}

export interface LabelPrimitive {
  kind: 'label'
  owner: string
  at: ScenePoint
  text: string
  width?: number
  styleRole?: MermaidStyleRole
  layer?: SceneLayer
}

export type ScenePrimitive = BoxPrimitive | StrokePrimitive | MarkerPrimitive | LabelPrimitive

export interface SceneCollision {
  x: number
  y: number
  owners: string[]
  roles: CharRole[]
  resolved: boolean
}

export interface ComposedScene {
  canvas: Canvas
  roleCanvas: RoleCanvas
  styleRoleCanvas: MermaidStyleRoleCanvas
  collisions: SceneCollision[]
}

interface Contribution {
  char: string
  role: CharRole
  owner: string
  connections: readonly string[]
  topologyMask?: number
  topologyWeight?: BoxLineWeight
  order: number
  styleRole: MermaidStyleRole
  topology: 'shared' | 'independent'
  bundleId?: string
  layer: SceneLayer
}

const defaultStyleRole = (role: CharRole): MermaidStyleRole => {
  if (role === 'text') return 'node.text'
  if (role === 'arrow') return 'edge.arrow'
  if (role === 'border') return 'node.border'
  return 'edge.line'
}

const rolePriority: Record<CharRole, number> = {
  line: 10,
  corner: 10,
  border: 20,
  junction: 30,
  arrow: 40,
  text: 50,
}

const layerPriority: Record<SceneLayer, number> = {
  background: 0,
  edge: 10,
  container: 20,
  node: 30,
  label: 40,
  marker: 50,
}

const defaultLayer = (
  role: CharRole,
  styleRole: MermaidStyleRole,
): SceneLayer => {
  if (styleRole === 'container.border') return 'container'
  if (styleRole === 'container.title' || styleRole === 'edge.label' || styleRole === 'node.text') {
    return 'label'
  }
  if (styleRole === 'node.background') return 'node'
  if (styleRole === 'edge.arrow' || role === 'arrow') return 'marker'
  if (styleRole === 'edge.line' || role === 'line' || role === 'corner') return 'edge'
  return role === 'text' ? 'label' : 'node'
}

const visualPriority = (value: Contribution) =>
  layerPriority[value.layer] * 100 + rolePriority[value.role]

function topologyFor(char: string): {
  mask: number
  rounded: boolean
  horizontalWeight: BoxLineWeight
  verticalWeight: BoxLineWeight
} | null {
  const unicode = getBoxGlyphTopology(char)
  if (unicode) return unicode
  if (['-', '.', '┄'].includes(char)) {
    return {
      mask: BoxConnection.left | BoxConnection.right,
      rounded: false,
      horizontalWeight: 'single',
      verticalWeight: 'single',
    }
  }
  if (['=', '━'].includes(char)) {
    return {
      mask: BoxConnection.left | BoxConnection.right,
      rounded: false,
      horizontalWeight: 'double',
      verticalWeight: 'single',
    }
  }
  if (['|', ':', '┆'].includes(char)) {
    return {
      mask: BoxConnection.up | BoxConnection.down,
      rounded: false,
      horizontalWeight: 'single',
      verticalWeight: 'single',
    }
  }
  if (['‖', '┃'].includes(char)) {
    return {
      mask: BoxConnection.up | BoxConnection.down,
      rounded: false,
      horizontalWeight: 'single',
      verticalWeight: 'double',
    }
  }
  if (char === '+') {
    return {
      mask: BoxConnection.up | BoxConnection.right | BoxConnection.down | BoxConnection.left,
      rounded: false,
      horizontalWeight: 'single',
      verticalWeight: 'single',
    }
  }
  return null
}

function glyphForStroke(
  mask: number,
  style: NonNullable<StrokePrimitive['style']>,
  useAscii: boolean,
  rounded: boolean,
): string {
  const vertical = BoxConnection.up | BoxConnection.down
  const horizontal = BoxConnection.left | BoxConnection.right
  const hasVertical = (mask & vertical) !== 0
  const hasHorizontal = (mask & horizontal) !== 0

  if (style === 'thick') {
    return glyphForWeightedBoxConnections(mask, {
      useAscii,
      horizontalWeight: 'double',
      verticalWeight: 'double',
    })
  }
  if (style === 'dotted') {
    if (hasVertical && !hasHorizontal) return useAscii ? ':' : '┆'
    if (hasHorizontal && !hasVertical) return useAscii ? '.' : '┄'
  }
  if (rounded && hasVertical && hasHorizontal) {
    return glyphForBoxConnections(mask, { useAscii, rounded: true })
  }
  return glyphForBoxConnections(mask, { useAscii })
}

const sharesConnection = (left: Contribution, right: Contribution) =>
  left.owner === right.owner ||
  left.connections.includes(right.owner) ||
  right.connections.includes(left.owner)

const sharesBundle = (left: Contribution, right: Contribution) =>
  left.bundleId !== undefined && left.bundleId === right.bundleId

const perpendicular = (left: Contribution, right: Contribution) => {
  if (left.layer !== right.layer) return false
  const leftTopology = topologyForContribution(left)
  const rightTopology = topologyForContribution(right)
  if (!leftTopology || !rightTopology) return false
  const horizontal = BoxConnection.left | BoxConnection.right
  const vertical = BoxConnection.up | BoxConnection.down
  const leftHorizontal = (leftTopology.mask & horizontal) !== 0
  const leftVertical = (leftTopology.mask & vertical) !== 0
  const rightHorizontal = (rightTopology.mask & horizontal) !== 0
  const rightVertical = (rightTopology.mask & vertical) !== 0
  return (leftHorizontal && !leftVertical && rightVertical && !rightHorizontal) ||
    (leftVertical && !leftHorizontal && rightHorizontal && !rightVertical)
}

const mayMergeTopology = (left: Contribution, right: Contribution) =>
  sharesConnection(left, right) ||
  (left.topology === 'shared' && right.topology === 'shared' && sharesBundle(left, right)) ||
  perpendicular(left, right)

const topologyForContribution = (value: Contribution) => {
  if (value.role === 'text' || value.role === 'arrow') return null
  if (value.topologyMask === undefined) return topologyFor(value.char)
  const horizontal = BoxConnection.left | BoxConnection.right
  const vertical = BoxConnection.up | BoxConnection.down
  return {
    mask: value.topologyMask,
    rounded: false,
    horizontalWeight: (value.topologyMask & horizontal) !== 0
      ? value.topologyWeight ?? 'single'
      : 'single',
    verticalWeight: (value.topologyMask & vertical) !== 0
      ? value.topologyWeight ?? 'single'
      : 'single',
  }
}

/** Collect semantic contributors before rasterizing them to a character grid. */
export class CharScene {
  private readonly cells = new Map<string, Contribution[]>()
  private order = 0
  private maxX: number
  private maxY: number

  constructor(width: number, height: number, private readonly useAscii: boolean) {
    this.maxX = Math.max(0, width - 1)
    this.maxY = Math.max(0, height - 1)
  }

  resize(width: number, height: number): void {
    this.maxX = Math.max(this.maxX, width - 1)
    this.maxY = Math.max(this.maxY, height - 1)
  }

  write(
    x: number,
    y: number,
    char: string,
    role: CharRole,
    options: SceneWriteOptions = {},
  ): void {
    if (x < 0 || y < 0 || (char === ' ' && !options.reserve)) return
    this.resize(x + 1, y + 1)
    const key = `${x},${y}`
    const values = this.cells.get(key) ?? []
    values.push({
      char,
      role,
      owner: options.owner ?? 'anonymous',
      connections: options.connections ?? [],
      topologyMask: options.topologyMask,
      topologyWeight: options.topologyWeight,
      order: this.order++,
      styleRole: options.styleRole ?? defaultStyleRole(role),
      topology: options.topology ?? 'shared',
      bundleId: options.bundleId,
      layer: options.layer ?? defaultLayer(
        role,
        options.styleRole ?? defaultStyleRole(role),
      ),
    })
    this.cells.set(key, values)
  }

  add(primitive: ScenePrimitive): void {
    if (primitive.kind === 'marker') {
      this.write(primitive.at.x, primitive.at.y, primitive.char, 'arrow', {
        owner: primitive.owner,
        styleRole: primitive.styleRole ?? 'edge.arrow',
        bundleId: primitive.bundleId,
        layer: primitive.layer ?? 'marker',
      })
      return
    }
    if (primitive.kind === 'label') {
      const width = Math.max(primitive.width ?? primitive.text.length, primitive.text.length)
      for (let index = 0; index < width; index++) {
        this.write(
          primitive.at.x + index,
          primitive.at.y,
          primitive.text[index] ?? ' ',
          'text',
          {
            owner: primitive.owner,
            reserve: true,
            styleRole: primitive.styleRole ?? 'node.text',
            layer: primitive.layer ?? 'label',
          },
        )
      }
      return
    }
    if (primitive.kind === 'box') {
      const right = primitive.x + primitive.width - 1
      const bottom = primitive.y + primitive.height - 1
      const rounded = primitive.rounded ?? true
      const boxOptions = {
        owner: primitive.owner,
        styleRole: primitive.styleRole ?? 'node.border',
        layer: primitive.layer ?? 'node',
      }
      this.write(primitive.x, primitive.y, glyphForBoxCorner(6, { useAscii: this.useAscii, rounded }), 'border', boxOptions)
      this.write(right, primitive.y, glyphForBoxCorner(12, { useAscii: this.useAscii, rounded }), 'border', boxOptions)
      this.write(primitive.x, bottom, glyphForBoxCorner(3, { useAscii: this.useAscii, rounded }), 'border', boxOptions)
      this.write(right, bottom, glyphForBoxCorner(9, { useAscii: this.useAscii, rounded }), 'border', boxOptions)
      for (let x = primitive.x + 1; x < right; x++) {
        this.write(x, primitive.y, glyphForBoxConnections(10, { useAscii: this.useAscii }), 'border', boxOptions)
        this.write(x, bottom, glyphForBoxConnections(10, { useAscii: this.useAscii }), 'border', boxOptions)
      }
      for (let y = primitive.y + 1; y < bottom; y++) {
        this.write(primitive.x, y, glyphForBoxConnections(5, { useAscii: this.useAscii }), 'border', boxOptions)
        this.write(right, y, glyphForBoxConnections(5, { useAscii: this.useAscii }), 'border', boxOptions)
      }
      return
    }

    const masks = new Map<string, number>()
    const addMask = (point: ScenePoint, mask: number) => {
      const key = `${point.x},${point.y}`
      masks.set(key, (masks.get(key) ?? 0) | mask)
    }
    for (let index = 1; index < primitive.points.length; index++) {
      const from = primitive.points[index - 1]!
      const to = primitive.points[index]!
      if (from.x !== to.x && from.y !== to.y) {
        throw new Error(`Stroke ${primitive.owner} must be orthogonal`)
      }
      const dx = Math.sign(to.x - from.x)
      const dy = Math.sign(to.y - from.y)
      let current = { ...from }
      while (current.x !== to.x || current.y !== to.y) {
        const next = { x: current.x + dx, y: current.y + dy }
        if (dx > 0) {
          addMask(current, BoxConnection.right)
          addMask(next, BoxConnection.left)
        } else if (dx < 0) {
          addMask(current, BoxConnection.left)
          addMask(next, BoxConnection.right)
        } else if (dy > 0) {
          addMask(current, BoxConnection.down)
          addMask(next, BoxConnection.up)
        } else {
          addMask(current, BoxConnection.up)
          addMask(next, BoxConnection.down)
        }
        current = next
      }
    }
    for (const [key, mask] of masks) {
      const [x, y] = key.split(',').map(Number)
      this.write(
        x,
        y,
        glyphForStroke(
          mask,
          primitive.style ?? 'solid',
          this.useAscii,
          primitive.rounded ?? false,
        ),
        primitive.role ?? 'line',
        {
          owner: primitive.owner,
          connections: primitive.connections,
          topologyMask: mask,
          topologyWeight: primitive.style === 'thick' ? 'double' : 'single',
          styleRole: primitive.styleRole ?? 'edge.line',
          topology: primitive.topology ?? 'shared',
          bundleId: primitive.bundleId,
          layer: primitive.layer ?? 'edge',
        },
      )
    }
  }

  compose(): ComposedScene {
    const canvas = blankCanvas(this.maxX, this.maxY)
    const roleCanvas = blankRoleCanvas(this.maxX, this.maxY)
    const styleRoleCanvas = blankStyleRoleCanvas(this.maxX, this.maxY)
    const collisions: SceneCollision[] = []

    for (const [key, values] of this.cells) {
      const [x, y] = key.split(',').map(Number)
      const highestPriority = Math.max(...values.map(visualPriority))
      const winners = values.filter(value => visualPriority(value) === highestPriority)
      const winner = winners[winners.length - 1]!
      const connected = values.filter(value =>
        value === winner || mayMergeTopology(value, winner),
      )
      const topology = connected.map(topologyForContribution)
      const allTopology = topology.every(Boolean)
      const compatibleWinners = winners.every(value => mayMergeTopology(value, winner))
      let char = winner.char
      let resolved = winners.length === 1

      if (allTopology && connected.length > 1) {
        const mask = topology.reduce((value, item) => value | item!.mask, 0)
        const horizontal = BoxConnection.left | BoxConnection.right
        const vertical = BoxConnection.up | BoxConnection.down
        const horizontalWeight = topology.some(item =>
          (item!.mask & horizontal) !== 0 && item!.horizontalWeight === 'double'
        ) ? 'double' : 'single'
        const verticalWeight = topology.some(item =>
          (item!.mask & vertical) !== 0 && item!.verticalWeight === 'double'
        ) ? 'double' : 'single'
        char = glyphForWeightedBoxConnections(mask, {
          useAscii: this.useAscii,
          horizontalWeight,
          verticalWeight,
        })
        resolved = true
      } else if (compatibleWinners && winners.every(value => value.char === winner.char)) {
        resolved = true
      }

      canvas[x]![y] = char
      roleCanvas[x]![y] = winner.role
      styleRoleCanvas[x]![y] = winner.styleRole

      const owners = [...new Set(values.map(value => value.owner))]
      if (owners.length > 1) {
        const arrows = values.filter(value => value.role === 'arrow')
        const markerOwner = (owner: string) =>
          owner.replace(/:(?:source|target)-.*$/, '')
        const terminalMarkerConflict = arrows.length > 0 && values
          .filter(value => topologyForContribution(value) !== null)
          .some(stroke => !arrows.some(arrow =>
            markerOwner(arrow.owner) === stroke.owner || sharesBundle(arrow, stroke)
          ))
        collisions.push({
          x,
          y,
          owners,
          roles: [...new Set(values.map(value => value.role))],
          resolved: !terminalMarkerConflict && (
            resolved || values.some(value => visualPriority(value) !== highestPriority)
          ),
        })
      }
    }

    return { canvas, roleCanvas, styleRoleCanvas, collisions }
  }
}

/** Route legacy layer canvases through the shared topology compositor. */
export function composeCanvasLayers(
  base: Canvas,
  offset: { x: number; y: number },
  useAscii: boolean,
  ...overlays: Canvas[]
): Canvas {
  const scene = new CharScene(base.length, base[0]?.length ?? 1, useAscii)
  const add = (canvas: Canvas, dx: number, dy: number, owner: string) => {
    for (let x = 0; x < canvas.length; x++) {
      for (let y = 0; y < (canvas[0]?.length ?? 0); y++) {
        const char = canvas[x]?.[y] ?? ' '
        if (char === ' ') continue
        scene.write(x + dx, y + dy, char, topologyFor(char) ? 'line' : 'text', { owner })
      }
    }
  }

  add(base, 0, 0, 'base')
  overlays.forEach((overlay, index) => add(overlay, offset.x, offset.y, `overlay:${index}`))
  return scene.compose().canvas
}

export function composeLegacyCanvas(canvas: Canvas, useAscii: boolean): Canvas {
  return composeCanvasLayers(blankCanvas(0, 0), { x: 0, y: 0 }, useAscii, canvas)
}
