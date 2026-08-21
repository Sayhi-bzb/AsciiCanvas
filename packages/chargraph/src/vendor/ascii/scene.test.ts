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
