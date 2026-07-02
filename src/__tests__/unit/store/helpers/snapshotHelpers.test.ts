import { describe, it, expect } from 'vitest';
import {
  cloneStructuredNode,
  cloneScene,
  normalizeAndCloneScene,
  serializeGrid,
  normalizeGridEntries,
  createMapFromEntries,
  isSameCell,
  isPoint,
  toStructuredNode
} from '@/domains/canvas/state/helpers/snapshotHelpers';
import type {
  StructuredBoxNode,
  StructuredLineNode,
  StructuredNode,
  StructuredSplitBoxNode,
  StructuredTextNode,
  GridCell,
} from '@/shared/types';

describe('snapshotHelpers', () => {
  describe('cloneStructuredNode', () => {
    it('should deep clone text node', () => {
      const node: StructuredNode = {
        id: '1',
        type: 'text',
        order: 1,
        position: { x: 10, y: 20 },
        text: 'Hello',
        style: { color: '#000' },
        component: {
          instanceId: 'component-1',
          templateId: 'button',
          role: 'label'
        }
      };
      const cloned = cloneStructuredNode(node) as StructuredTextNode;

      expect(cloned).toEqual(node);
      expect(cloned).not.toBe(node);
      expect(cloned.position).not.toBe(node.position);
      expect(cloned.style).not.toBe(node.style);
      expect(cloned.component).not.toBe(node.component);
    });

    it('should deep clone box node', () => {
      const node: StructuredNode = {
        id: '1',
        type: 'box',
        order: 1,
        start: { x: 0, y: 0 },
        end: { x: 10, y: 10 },
        style: { color: '#000' }
      };
      const cloned = cloneStructuredNode(node) as StructuredBoxNode;

      expect(cloned).toEqual(node);
      expect(cloned.start).not.toBe(node.start);
      expect(cloned.end).not.toBe(node.end);
      expect(cloned.style).not.toBe(node.style);
    });

    it('should deep clone line node', () => {
      const node: StructuredNode = {
        id: '1',
        type: 'line',
        order: 1,
        start: { x: 0, y: 0 },
        end: { x: 10, y: 10 },
        axis: 'horizontal',
        style: { color: '#000' }
      };
      const cloned = cloneStructuredNode(node) as StructuredLineNode;

      expect(cloned).toEqual(node);
      expect(cloned.start).not.toBe(node.start);
      expect(cloned.end).not.toBe(node.end);
    });

    it('should deep clone split box node', () => {
      const node: StructuredNode = {
        id: 'split',
        type: 'splitBox',
        order: 1,
        start: { x: 0, y: 0 },
        end: { x: 10, y: 4 },
        verticalSplitRatio: 0.36,
        topSplitRatio: 0.25,
        bottomSplitRatio: 0.75,
        style: { color: '#000' }
      };
      const cloned = cloneStructuredNode(node) as StructuredSplitBoxNode;

      expect(cloned).toMatchObject(node);
      expect(cloned.root).toBeDefined();
      expect(cloned.start).not.toBe(node.start);
      expect(cloned.end).not.toBe(node.end);
      expect(cloned.verticalSplitRatio).toBe(0.36);
    });

    it('should not affect original when modifying clone', () => {
      const node: StructuredNode = {
        id: '1',
        type: 'box',
        order: 1,
        start: { x: 0, y: 0 },
        end: { x: 10, y: 10 },
        style: { color: '#000' }
      };
      const cloned = cloneStructuredNode(node) as StructuredBoxNode;
      cloned.start.x = 100;

      expect(node.start.x).toBe(0);
    });
  });

  describe('cloneScene', () => {
    it('should clone array of nodes', () => {
      const scene: StructuredNode[] = [
        { id: '1', type: 'box', order: 1, start: { x: 0, y: 0 }, end: { x: 10, y: 10 }, style: { color: '#000' } },
        { id: '2', type: 'text', order: 2, position: { x: 5, y: 5 }, text: 'Hi', style: { color: '#fff' } }
      ];
      const cloned = cloneScene(scene);

      expect(cloned).toHaveLength(2);
      expect(cloned[0]).not.toBe(scene[0]);
      expect(cloned[1]).not.toBe(scene[1]);
    });

    it('should handle empty array', () => {
      expect(cloneScene([])).toEqual([]);
    });
  });

  describe('normalizeAndCloneScene', () => {
    it('should sort nodes by order', () => {
      const scene: StructuredNode[] = [
        { id: '3', type: 'box', order: 3, start: { x: 0, y: 0 }, end: { x: 10, y: 10 }, style: { color: '#000' } },
        { id: '1', type: 'box', order: 1, start: { x: 0, y: 0 }, end: { x: 5, y: 5 }, style: { color: '#000' } },
        { id: '2', type: 'box', order: 2, start: { x: 0, y: 0 }, end: { x: 8, y: 8 }, style: { color: '#000' } }
      ];
      const result = normalizeAndCloneScene(scene);

      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');
      expect(result[2].id).toBe('3');
    });

    it('should clone nodes while sorting', () => {
      const scene: StructuredNode[] = [
        { id: '2', type: 'box', order: 2, start: { x: 0, y: 0 }, end: { x: 10, y: 10 }, style: { color: '#000' } }
      ];
      const result = normalizeAndCloneScene(scene);

      expect(result[0]).not.toBe(scene[0]);
    });
  });

  describe('serializeGrid', () => {
    it('should convert Map to array entries', () => {
      const grid = new Map<string, GridCell>([
        ['0,0', { char: 'A', color: '#000' }],
        ['1,1', { char: 'B', color: '#fff' }]
      ]);
      const result = serializeGrid(grid);

      expect(result).toEqual([
        ['0,0', { char: 'A', color: '#000' }],
        ['1,1', { char: 'B', color: '#fff' }]
      ]);
    });

    it('should handle empty map', () => {
      expect(serializeGrid(new Map())).toEqual([]);
    });
  });

  describe('createMapFromEntries', () => {
    it('should create Map from entries', () => {
      const entries: [string, GridCell][] = [
        ['0,0', { char: 'A', color: '#000' }],
        ['1,1', { char: 'B', color: '#fff' }]
      ];
      const result = createMapFromEntries(entries);

      expect(result.get('0,0')).toEqual({ char: 'A', color: '#000' });
      expect(result.get('1,1')).toEqual({ char: 'B', color: '#fff' });
    });

    it('should handle empty entries', () => {
      expect(createMapFromEntries([])).toEqual(new Map());
    });

    it('should migrate legacy string cell entries', () => {
      const result = createMapFromEntries([
        ['0,0', 'A'],
        ['1,1', 'B']
      ]);

      expect(result.get('0,0')).toEqual({ char: 'A', color: '#000000' });
      expect(result.get('1,1')).toEqual({ char: 'B', color: '#000000' });
    });
  });

  describe('normalizeGridEntries', () => {
    it('should preserve valid grid cells', () => {
      expect(
        normalizeGridEntries([
          ['0,0', { char: 'A', color: '#111111' }]
        ])
      ).toEqual([
        ['0,0', { char: 'A', color: '#111111' }]
      ]);
    });

    it('should fill missing colors for partial grid cells', () => {
      expect(
        normalizeGridEntries([
          ['0,0', { char: 'A' }]
        ])
      ).toEqual([
        ['0,0', { char: 'A', color: '#000000' }]
      ]);
    });
  });

  describe('isSameCell', () => {
    it('should return true for identical cells', () => {
      const a: GridCell = { char: 'A', color: '#000' };
      const b: GridCell = { char: 'A', color: '#000' };
      expect(isSameCell(a, b)).toBe(true);
    });

    it('should return false for different chars', () => {
      const a: GridCell = { char: 'A', color: '#000' };
      const b: GridCell = { char: 'B', color: '#000' };
      expect(isSameCell(a, b)).toBe(false);
    });

    it('should return false for different colors', () => {
      const a: GridCell = { char: 'A', color: '#000' };
      const b: GridCell = { char: 'A', color: '#fff' };
      expect(isSameCell(a, b)).toBe(false);
    });

    it('should return false if either is undefined', () => {
      const a: GridCell = { char: 'A', color: '#000' };
      expect(isSameCell(a, undefined)).toBe(false);
      expect(isSameCell(undefined, a)).toBe(false);
      expect(isSameCell(undefined, undefined)).toBe(false);
    });
  });

  describe('isPoint', () => {
    it('should return true for valid point', () => {
      expect(isPoint({ x: 1, y: 2 })).toBe(true);
      expect(isPoint({ x: 0, y: 0 })).toBe(true);
      expect(isPoint({ x: -1, y: -1 })).toBe(true);
    });

    it('should return false for invalid point', () => {
      expect(isPoint(null)).toBe(false);
      expect(isPoint(undefined)).toBe(false);
      expect(isPoint({})).toBe(false);
      expect(isPoint({ x: 1 })).toBe(false);
      expect(isPoint({ y: 2 })).toBe(false);
      expect(isPoint({ x: '1', y: 2 })).toBe(false);
      expect(isPoint('not an object')).toBe(false);
    });
  });

  describe('toStructuredNode', () => {
    it('should convert valid box node', () => {
      const raw = {
        id: 'box1',
        type: 'box' as const,
        order: 1,
        start: { x: 0, y: 0 },
        end: { x: 10, y: 10 },
        style: { color: '#000' }
      };
      const result = toStructuredNode(raw);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('box');
    });

    it('should convert valid line node', () => {
      const raw = {
        id: 'line1',
        type: 'line' as const,
        order: 1,
        start: { x: 0, y: 0 },
        end: { x: 10, y: 10 },
        axis: 'horizontal' as const,
        style: { color: '#000' }
      };
      const result = toStructuredNode(raw);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('line');
    });

    it('should convert valid text node', () => {
      const raw = {
        id: 'text1',
        type: 'text' as const,
        order: 1,
        position: { x: 5, y: 5 },
        text: 'Hello',
        style: { color: '#000' }
      };
      const result = toStructuredNode(raw);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('text');
    });

    it('should convert split box node and default missing ratios', () => {
      const raw = {
        id: 'split',
        type: 'splitBox' as const,
        order: 1,
        start: { x: 0, y: 0 },
        end: { x: 10, y: 4 },
        style: { color: '#000' }
      };
      const result = toStructuredNode(raw);

      expect(result).toMatchObject({
        type: 'splitBox',
        verticalSplitRatio: 0.36,
        topSplitRatio: 0.25,
        bottomSplitRatio: 0.75
      });
    });

    it('should return null for invalid input', () => {
      expect(toStructuredNode(null)).toBeNull();
      expect(toStructuredNode(undefined)).toBeNull();
      expect(toStructuredNode('string')).toBeNull();
      expect(toStructuredNode({})).toBeNull();
      expect(toStructuredNode({ id: 'test' })).toBeNull(); // missing required fields
    });

    it('should return null for box without valid start/end', () => {
      const raw = {
        id: 'box1',
        type: 'box' as const,
        order: 1,
        style: { color: '#000' }
      };
      expect(toStructuredNode(raw)).toBeNull();
    });

    it('should return null for line with invalid axis', () => {
      const raw = {
        id: 'line1',
        type: 'line' as const,
        order: 1,
        start: { x: 0, y: 0 },
        end: { x: 10, y: 10 },
        axis: 'diagonal', // invalid
        style: { color: '#000' }
      };
      expect(toStructuredNode(raw)).toBeNull();
    });

    it('should return null for box with non-string name', () => {
      const raw = {
        id: 'box1',
        type: 'box' as const,
        order: 1,
        start: { x: 0, y: 0 },
        end: { x: 10, y: 10 },
        name: 123, // invalid
        style: { color: '#000' }
      };
      expect(toStructuredNode(raw)).toBeNull();
    });

    it('should accept box with valid name', () => {
      const raw = {
        id: 'box1',
        type: 'box' as const,
        order: 1,
        start: { x: 0, y: 0 },
        end: { x: 10, y: 10 },
        name: 'My Box',
        style: { color: '#000' }
      };
      const result = toStructuredNode(raw);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('box');
      expect(result && result.type === 'box' ? result.name : undefined).toBe('My Box');
    });
  });
});
