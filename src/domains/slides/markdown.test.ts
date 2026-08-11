import { describe, expect, it } from 'vitest';
import { parseSlideMarkdown } from './markdown';

const createSource = (body: string[], metadata: string[] = ['size: 4x2', 'title: Agent Deck']) =>
  ['---', 'asciicanvas: slides/v1', ...metadata, '---', ...body].join('\n');

describe('AsciiCanvas Slides Markdown', () => {
  it('parses ordered plain and ANSI slides', () => {
    const result = parseSlideMarkdown(
      createSource([
        '## Intro',
        '',
        '```text',
        'AB',
        '界',
        '```',
        '',
        '## Color',
        '',
        '```asciicanvas',
        '[31mR[0m',
        '```',
      ])
    );

    expect(result.title).toBe('Agent Deck');
    expect(result.slideDeck).toMatchObject({
      size: { columns: 4, rows: 2 },
      activeSlideId: 'slide-1',
      slides: [
        { id: 'slide-1', name: 'Intro' },
        { id: 'slide-2', name: 'Color' },
      ],
    });
    expect(result.slideDeck.slides[0].grid.map(([key]) => key)).toEqual(['0,0', '1,0', '0,1']);
    expect(result.slideDeck.slides[1].grid[0][1].color).toBe('#800000');
  });

  it('uses fallback names and clips overflow, including wide boundary cells', () => {
    const result = parseSlideMarkdown(createSource(['```text', 'ABCDE', 'abc界', 'third', '```']));

    expect(result.slideDeck.slides[0].name).toBe('Slide 1');
    expect(result.slideDeck.slides[0].grid.map(([key]) => key)).toEqual([
      '0,0',
      '1,0',
      '2,0',
      '3,0',
      '0,1',
      '1,1',
      '2,1',
    ]);
  });

  it('defaults a missing size to widescreen', () => {
    const result = parseSlideMarkdown(createSource(['```text', 'A', '```'], ['title: Default']));
    expect(result.slideDeck.size).toEqual({ columns: 100, rows: 27 });
  });

  it.each([
    ['missing header', ['```text', 'A', '```'].join('\n')],
    ['bad version', ['---', 'asciicanvas: slides/v2', '---', '```text', 'A', '```'].join('\n')],
    ['bad size', createSource(['```text', 'A', '```'], ['size: wide'])],
    ['no slides', createSource(['Nothing here'])],
    ['open fence', createSource(['```text', 'A'])],
  ])('rejects %s', (_label, source) => {
    expect(() => parseSlideMarkdown(source)).toThrow();
  });
});
