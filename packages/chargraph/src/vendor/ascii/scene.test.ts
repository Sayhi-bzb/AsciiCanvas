import { describe, expect, it } from 'vitest'
import { CharScene } from './scene.js'

describe('CharScene', () => {
  it('composes orthogonal route topology before rasterizing', () => {
    const scene = new CharScene(3, 3, false)
    scene.write(1, 1, '─', 'line', { owner: 'horizontal' })
    scene.write(1, 1, '│', 'line', { owner: 'vertical' })

    const result = scene.compose()
    expect(result.canvas[1]![1]).toBe('┼')
    expect(result.collisions).toEqual([
      expect.objectContaining({ resolved: true, owners: ['horizontal', 'vertical'] }),
    ])
  })

  it('keeps markers and reserved labels independent from routes', () => {
    const scene = new CharScene(3, 1, false)
    scene.write(0, 0, '─', 'line', { owner: 'route' })
    scene.write(0, 0, '>', 'arrow', { owner: 'marker' })
    scene.write(1, 0, '─', 'line', { owner: 'route' })
    scene.write(1, 0, ' ', 'text', { owner: 'label', reserve: true })

    const result = scene.compose()
    expect(result.canvas[0]![0]).toBe('>')
    expect(result.canvas[1]![0]).toBe(' ')
    expect(result.collisions.every(collision => collision.resolved)).toBe(true)
  })

  it('does not merge a route into a higher-priority box border', () => {
    const scene = new CharScene(1, 1, false)
    scene.write(0, 0, '│', 'line', { owner: 'route' })
    scene.write(0, 0, '─', 'border', { owner: 'box' })
    expect(scene.compose().canvas[0]![0]).toBe('─')
  })

  it.each([
    ['dotted', [{ x: 2, y: 0 }, { x: 2, y: 1 }], { x: 2, y: 1 }, '┴'],
    ['dotted', [{ x: 2, y: 3 }, { x: 2, y: 4 }], { x: 2, y: 3 }, '┬'],
    ['dotted', [{ x: 0, y: 2 }, { x: 1, y: 2 }], { x: 1, y: 2 }, '┤'],
    ['dotted', [{ x: 3, y: 2 }, { x: 4, y: 2 }], { x: 3, y: 2 }, '├'],
    ['thick', [{ x: 2, y: 0 }, { x: 2, y: 1 }], { x: 2, y: 1 }, '┴'],
    ['thick', [{ x: 2, y: 3 }, { x: 2, y: 4 }], { x: 2, y: 3 }, '┬'],
    ['thick', [{ x: 0, y: 2 }, { x: 1, y: 2 }], { x: 1, y: 2 }, '┤'],
    ['thick', [{ x: 3, y: 2 }, { x: 4, y: 2 }], { x: 3, y: 2 }, '├'],
  ] as const)(
    'preserves the exact %s endpoint topology at a node border',
    (style, points, at, expected) => {
      const scene = new CharScene(5, 5, false)
      scene.add({ kind: 'box', owner: 'node', x: 1, y: 1, width: 3, height: 3 })
      scene.add({
        kind: 'stroke',
        owner: 'edge',
        connections: ['node'],
        points: [...points],
        role: 'line',
        style,
      })

      expect(scene.compose().canvas[at.x]![at.y]).toBe(expected)
    },
  )

  it('uses a four-way junction only when the stroke passes through the border', () => {
    const scene = new CharScene(5, 5, false)
    scene.add({ kind: 'box', owner: 'node', x: 1, y: 1, width: 3, height: 3 })
    scene.add({
      kind: 'stroke',
      owner: 'edge',
      connections: ['node'],
      points: [{ x: 2, y: 0 }, { x: 2, y: 4 }],
      role: 'line',
      style: 'dotted',
    })

    const output = scene.compose().canvas
    expect(output[2]![1]).toBe('┼')
    expect(output[2]![3]).toBe('┼')
  })

  it('uses an ASCII junction for a connected mixed-priority attachment', () => {
    const scene = new CharScene(1, 1, true)
    scene.write(0, 0, ':', 'line', {
      owner: 'edge',
      connections: ['node'],
    })
    scene.write(0, 0, '-', 'border', { owner: 'node' })

    expect(scene.compose().canvas[0]![0]).toBe('+')
  })

  it('merges routes that share a semantic endpoint', () => {
    const scene = new CharScene(1, 1, false)
    scene.write(0, 0, '┆', 'line', {
      owner: 'dependency',
      connections: ['source', 'dependency-target'],
    })
    scene.write(0, 0, '─', 'border', {
      owner: 'association',
      connections: ['source', 'association-target'],
    })

    expect(scene.compose().canvas[0]![0]).toBe('┼')
  })

  it('rasterizes typed boxes, strokes, markers, and reserved labels', () => {
    const scene = new CharScene(8, 4, false)
    scene.add({ kind: 'box', owner: 'node', x: 0, y: 0, width: 4, height: 3 })
    scene.add({ kind: 'stroke', owner: 'route', points: [{ x: 4, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 3 }] })
    scene.add({ kind: 'marker', owner: 'route', at: { x: 6, y: 3 }, char: 'v' })
    scene.add({ kind: 'label', owner: 'label', at: { x: 4, y: 0 }, text: 'A', width: 2 })

    const output = scene.compose().canvas
    expect(output[0]![0]).toBe('╭')
    expect(output[6]![1]).toBe('┐')
    expect(output[6]![3]).toBe('v')
    expect(output[5]![0]).toBe(' ')
  })

  it('rounds two-direction stroke bends without rounding junctions', () => {
    const cornerCases = [
      { points: [{ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }], at: { x: 0, y: 0 }, char: '╭' },
      { points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], at: { x: 1, y: 0 }, char: '╮' },
      { points: [{ x: 1, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 0 }], at: { x: 0, y: 1 }, char: '╰' },
      { points: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 0 }], at: { x: 1, y: 1 }, char: '╯' },
    ]

    for (const [index, corner] of cornerCases.entries()) {
      const scene = new CharScene(2, 2, false)
      scene.add({ kind: 'stroke', owner: `corner:${index}`, points: corner.points, rounded: true })
      expect(scene.compose().canvas[corner.at.x]![corner.at.y]).toBe(corner.char)
    }

    const junction = new CharScene(3, 2, false)
    junction.add({ kind: 'stroke', owner: 'horizontal', points: [{ x: 0, y: 0 }, { x: 2, y: 0 }], rounded: true })
    junction.add({ kind: 'stroke', owner: 'vertical', points: [{ x: 1, y: 0 }, { x: 1, y: 1 }], rounded: true })
    expect(junction.compose().canvas[1]![0]).toBe('┬')
  })

  it.each([
    ['solid', '─', '│'],
    ['dotted', '┄', '┆'],
    ['thick', '━', '┃'],
  ] as const)('keeps %s stroke segments around a light rounded bend', (style, horizontal, vertical) => {
    const scene = new CharScene(3, 3, false)
    scene.add({
      kind: 'stroke',
      owner: style,
      points: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }],
      style,
      rounded: true,
    })

    const output = scene.compose().canvas
    expect(output[1]![0]).toBe(horizontal)
    expect(output[2]![0]).toBe('╮')
    expect(output[2]![1]).toBe(vertical)
  })

  it('falls rounded strokes back to ASCII corners', () => {
    const scene = new CharScene(3, 3, true)
    scene.add({
      kind: 'stroke',
      owner: 'ascii',
      points: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }],
      rounded: true,
    })
    expect(scene.compose().canvas[2]![0]).toBe('+')
  })

  it('keeps square corners as an explicit opt-out', () => {
    const scene = new CharScene(4, 3, false)
    scene.add({ kind: 'box', owner: 'square', x: 0, y: 0, width: 4, height: 3, rounded: false })

    const output = scene.compose().canvas
    expect(output[0]![0]).toBe('┌')
    expect(output[3]![0]).toBe('┐')
    expect(output[0]![2]).toBe('└')
    expect(output[3]![2]).toBe('┘')
  })
})
