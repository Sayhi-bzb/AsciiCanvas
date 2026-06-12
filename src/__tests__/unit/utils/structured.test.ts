import { describe, it, expect } from 'vitest';
import {
  normalizeScene,
  sceneToGridEntries,
  getStructuredNodeBounds,
  containsBounds,
  intersectsBounds,
  buildStructuredTree,
  createStructuredNodeId
} from '@/shared/utils/structured';
import type { StructuredNode, NodeBounds } from '@/shared/types';

describe('structured', () => {
  describe('normalizeScene', () => {
    it('should sort nodes by order', () => {
      const scene: StructuredNode[] = [
        { id: '3', type: 'box', order: 3, start: { x: 0, y: 0 }, end: { x: 10, y: 10 }, style: { color: '#000' } },
        { id: '1', type: 'box', order: 1, start: { x: 0, y: 0 }, end: { x: 5, y: 5 }, style: { color: '#000' } },
        { id: '2', type: 'box', order: 2, start: { x: 0, y: 0 }, end: { x: 8, y: 8 }, style: { color: '#000' } }
      ];
      const result = normalizeScene(scene);

      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');
      expect(result[2].id).toBe('3');
    });

    it('should not mutate original array', () => {
      const scene: StructuredNode[] = [
        { id: '2', type: 'box', order: 2, start: { x: 0, y: 0 }, end: { x: 10, y: 10 }, style: { color: '#000' } },
        { id: '1', type: 'box', order: 1, start: { x: 0, y: 0 }, end: { x: 5, y: 5 }, style: { color: '#000' } }
      ];
      const originalOrder = scene.map(n => n.id);
      normalizeScene(scene);

      expect(scene.map(n => n.id)).toEqual(originalOrder);
    });

    it('should handle empty array', () => {
      expect(normalizeScene([])).toEqual([]);
    });

    it('should handle single node', () => {
      const scene: StructuredNode[] = [
        { id: '1', type: 'box', order: 1, start: { x: 0, y: 0 }, end: { x: 10, y: 10 }, style: { color: '#000' } }
      ];
      expect(normalizeScene(scene)).toHaveLength(1);
    });
  });

  describe('sceneToGridEntries', () => {
    it('should convert scene to grid entries', () => {
      const scene: StructuredNode[] = [
        { id: '1', type: 'box', order: 1, start: { x: 0, y: 0 }, end: { x: 2, y: 2 }, style: { color: '#000' } }
      ];
      const entries = sceneToGridEntries(scene);

      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBeGreaterThan(0);
      // Each entry should be [key, cell] tuple
      expect(entries[0]).toHaveLength(2);
      expect(typeof entries[0][0]).toBe('string');
      expect(entries[0][1]).toHaveProperty('char');
      expect(entries[0][1]).toHaveProperty('color');
    });

    it('should handle empty scene', () => {
      expect(sceneToGridEntries([])).toEqual([]);
    });
  });

  describe('getStructuredNodeBounds', () => {
    it('should calculate box bounds', () => {
      const node: StructuredNode = {
        id: '1', type: 'box', order: 1,
        start: { x: 5, y: 5 },
        end: { x: 15, y: 10 },
        style: { color: '#000' }
      };
      const bounds = getStructuredNodeBounds(node);

      expect(bounds).toEqual({ x: 5, y: 5, width: 11, height: 6 });
    });

    it('should calculate text bounds', () => {
      const node: StructuredNode = {
        id: '1', type: 'text', order: 1,
        position: { x: 5, y: 5 },
        text: 'Hello\nWorld',
        style: { color: '#000' }
      };
      const bounds = getStructuredNodeBounds(node);

      expect(bounds.x).toBe(5);
      expect(bounds.y).toBe(5);
      expect(bounds.height).toBe(2); // 2 lines
    });

    it('should handle reversed coordinates', () => {
      const node: StructuredNode = {
        id: '1', type: 'box', order: 1,
        start: { x: 10, y: 10 },
        end: { x: 0, y: 0 },
        style: { color: '#000' }
      };
      const bounds = getStructuredNodeBounds(node);

      expect(bounds.x).toBe(0);
      expect(bounds.y).toBe(0);
      expect(bounds.width).toBe(11);
      expect(bounds.height).toBe(11);
    });
  });

  describe('containsBounds', () => {
    it('should return true when inner is contained', () => {
      const outer: NodeBounds = { x: 0, y: 0, width: 10, height: 10 };
      const inner: NodeBounds = { x: 2, y: 2, width: 5, height: 5 };
      expect(containsBounds(outer, inner)).toBe(true);
    });

    it('should return false when inner exceeds outer', () => {
      const outer: NodeBounds = { x: 0, y: 0, width: 10, height: 10 };
      const inner: NodeBounds = { x: 8, y: 8, width: 5, height: 5 };
      expect(containsBounds(outer, inner)).toBe(false);
    });

    it('should return true for same bounds', () => {
      const bounds: NodeBounds = { x: 0, y: 0, width: 10, height: 10 };
      expect(containsBounds(bounds, bounds)).toBe(true);
    });
  });

  describe('intersectsBounds', () => {
    it('should return true for overlapping bounds', () => {
      const a: NodeBounds = { x: 0, y: 0, width: 5, height: 5 };
      const b: NodeBounds = { x: 3, y: 3, width: 5, height: 5 };
      expect(intersectsBounds(a, b)).toBe(true);
    });

    it('should return false for non-overlapping bounds', () => {
      const a: NodeBounds = { x: 0, y: 0, width: 5, height: 5 };
      const b: NodeBounds = { x: 10, y: 10, width: 5, height: 5 };
      expect(intersectsBounds(a, b)).toBe(false);
    });

    it('should return false for adjacent bounds (edge touching only)', () => {
      // Bounds that only touch at edges are not considered intersecting
      const a: NodeBounds = { x: 0, y: 0, width: 5, height: 5 };
      const b: NodeBounds = { x: 5, y: 0, width: 5, height: 5 };
      expect(intersectsBounds(a, b)).toBe(false);
    });
  });

  describe('buildStructuredTree', () => {
    it('should build tree with parent-child relationships', () => {
      const scene: StructuredNode[] = [
        { id: 'parent', type: 'box', order: 1, start: { x: 0, y: 0 }, end: { x: 20, y: 20 }, style: { color: '#000' } },
        { id: 'child', type: 'box', order: 2, start: { x: 5, y: 5 }, end: { x: 10, y: 10 }, style: { color: '#000' } }
      ];
      const tree = buildStructuredTree(scene);

      expect(tree.roots).toHaveLength(1);
      expect(tree.roots[0].id).toBe('parent');
      expect(tree.childrenById.get('parent')).toHaveLength(1);
      expect(tree.childrenById.get('parent')![0].id).toBe('child');
    });

    it('should handle multiple roots', () => {
      const scene: StructuredNode[] = [
        { id: 'box1', type: 'box', order: 1, start: { x: 0, y: 0 }, end: { x: 10, y: 10 }, style: { color: '#000' } },
        { id: 'box2', type: 'box', order: 2, start: { x: 20, y: 20 }, end: { x: 30, y: 30 }, style: { color: '#000' } }
      ];
      const tree = buildStructuredTree(scene);

      expect(tree.roots).toHaveLength(2);
    });

    it('should find smallest containing parent', () => {
      const scene: StructuredNode[] = [
        { id: 'outer', type: 'box', order: 1, start: { x: 0, y: 0 }, end: { x: 30, y: 30 }, style: { color: '#000' } },
        { id: 'inner', type: 'box', order: 2, start: { x: 5, y: 5 }, end: { x: 25, y: 25 }, style: { color: '#000' } },
        { id: 'child', type: 'box', order: 3, start: { x: 10, y: 10 }, end: { x: 15, y: 15 }, style: { color: '#000' } }
      ];
      const tree = buildStructuredTree(scene);

      // child should be inside inner (smaller area), not outer
      expect(tree.childrenById.get('inner')?.some(n => n.id === 'child')).toBe(true);
    });
  });

  describe('createStructuredNodeId', () => {
    it('should create unique IDs', () => {
      const id1 = createStructuredNodeId();
      const id2 = createStructuredNodeId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^node-/);
    });
  });
});
