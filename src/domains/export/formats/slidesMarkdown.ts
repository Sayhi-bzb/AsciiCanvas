import type { SlideDeck } from '@/domains/slides/public';
import { GridManager } from '@/shared/utils/grid';
import { exportSelectionToAnsi } from './text';

const escapeFrontMatterValue = (value: string) => value.replace(/\r?\n/g, ' ').trim();

const resolveFence = (source: string) => {
  let length = 3;
  for (const match of source.matchAll(/^`+/gm)) {
    length = Math.max(length, match[0].length + 1);
  }
  return '`'.repeat(length);
};

const renderSlide = (
  slide: SlideDeck['slides'][number],
  includeColor: boolean
) => {
  const gridEntries = slide.grid;
  const grid = new Map(gridEntries);
  const lastRow = gridEntries.reduce((max, [key]) => {
    const point = GridManager.fromKey(key);
    return Math.max(max, point.y);
  }, 0);
  const source = exportSelectionToAnsi(
    grid,
    [
      {
        start: { x: 0, y: 0 },
        end: {
          x: slide.size.columns - 1,
          y: Math.min(lastRow, slide.size.rows - 1),
        },
      },
    ],
    { includeColor }
  ).replaceAll('\u001b', '');
  const fence = resolveFence(source);
  return { source, fence };
};

export const exportSlideDeckToMarkdown = (
  slideDeck: SlideDeck,
  options?: { title?: string; includeColor?: boolean }
) => {
  const title = escapeFrontMatterValue(options?.title || 'Slides');
  const header = [
    '---',
    'chardesk: slides/v1',
    `title: ${title}`,
    '---',
  ].join('\n');
  const pages = slideDeck.slides.map((slide) => {
    const { source, fence } = renderSlide(slide, options?.includeColor !== false);
    const size = `${slide.size.columns}x${slide.size.rows}`;
    return `## ${escapeFrontMatterValue(slide.name)}\n\n${fence}chardesk size=${size}\n${source}\n${fence}`;
  });
  return `${header}\n\n${pages.join('\n\n')}`;
};
