import { parseAsciiCanvasText, type AsciiCanvasTextSyntax } from '@ascii-canvas/protocol';
import { COLOR_PRIMARY_TEXT } from '@/shared/lib/constants';
import { GridManager } from '@/shared/utils/grid';
import { createSlideDeck, addSlide } from './deck';
import { DEFAULT_SLIDE_SIZE, type SlideDeck, type SlideSize } from './model';

export const SLIDE_MARKDOWN_SIGNATURE = 'slides/v1';

export type ParsedSlideMarkdown = {
  title?: string;
  slideDeck: SlideDeck;
};

const parseFrontMatter = (source: string) => {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  if (lines[0]?.trim() !== '---') {
    throw new Error('Invalid AsciiCanvas Slides Markdown header.');
  }

  const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (endIndex < 0) {
    throw new Error('Invalid AsciiCanvas Slides Markdown header.');
  }

  const metadata = new Map<string, string>();
  lines.slice(1, endIndex).forEach((line) => {
    const separator = line.indexOf(':');
    if (separator < 0) return;
    metadata.set(line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim());
  });

  if (metadata.get('asciicanvas') !== SLIDE_MARKDOWN_SIGNATURE) {
    throw new Error('Unsupported AsciiCanvas Slides Markdown version.');
  }

  const rawSize = metadata.get('size');
  let size: SlideSize = { ...DEFAULT_SLIDE_SIZE };
  if (rawSize) {
    const match = /^(\d+)x(\d+)$/i.exec(rawSize);
    if (!match) throw new Error('Slide size must use columnsxrows.');
    size = { columns: Number(match[1]), rows: Number(match[2]) };
    if (
      !Number.isSafeInteger(size.columns) ||
      !Number.isSafeInteger(size.rows) ||
      size.columns <= 0 ||
      size.rows <= 0
    ) {
      throw new Error('Slide size must use positive integer columns and rows.');
    }
  }

  const title = metadata.get('title')?.trim();
  return {
    bodyLines: lines.slice(endIndex + 1),
    size,
    ...(title ? { title } : {}),
  };
};

const toSyntax = (language: string): AsciiCanvasTextSyntax => {
  if (language === 'text') return 'plain';
  if (language === 'ansi') return 'ansi';
  return 'auto';
};

const toGridEntries = (source: string, syntax: AsciiCanvasTextSyntax) => {
  const parsed = parseAsciiCanvasText(source, {
    syntax,
    defaultStyle: { color: COLOR_PRIMARY_TEXT },
  });
  return parsed.cells
    .filter(
      (cell) =>
        cell.text !== ' ' ||
        !!cell.bgColor ||
        !!cell.href ||
        !!cell.attrs?.underline ||
        !!cell.attrs?.inverse ||
        !!cell.attrs?.strike
    )
    .map(
      (cell) =>
        [
          GridManager.toKey(cell.x, cell.y),
          {
            char: cell.text,
            color: cell.color ?? COLOR_PRIMARY_TEXT,
            ...(cell.bgColor ? { bgColor: cell.bgColor } : {}),
            ...(cell.attrs ? { attrs: { ...cell.attrs } } : {}),
            ...(cell.href ? { href: cell.href } : {}),
          },
        ] as const
    );
};

const parseSlideBlocks = (lines: string[]) => {
  const slides: Array<{
    name: string;
    source: string;
    syntax: AsciiCanvasTextSyntax;
  }> = [];
  let heading: string | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const headingMatch = /^##\s+(.+?)\s*$/.exec(lines[index]);
    if (headingMatch) {
      heading = headingMatch[1].trim();
      continue;
    }

    const fenceMatch = /^(?<fence>`{3,}|~{3,})\s*(?<language>[^\s]*)\s*$/.exec(lines[index]);
    if (!fenceMatch?.groups) continue;
    const fence = fenceMatch.groups.fence;
    const language = fenceMatch.groups.language.toLowerCase();
    const content: string[] = [];
    let closed = false;
    index += 1;
    for (; index < lines.length; index += 1) {
      if (new RegExp(`^${fence[0]}{${fence.length},}\\s*$`).test(lines[index])) {
        closed = true;
        break;
      }
      content.push(lines[index]);
    }
    if (!closed) throw new Error('Unclosed slide content fence.');
    if (!['asciicanvas', 'text', 'ansi'].includes(language)) continue;

    slides.push({
      name: heading || `Slide ${slides.length + 1}`,
      source: content.join('\n'),
      syntax: toSyntax(language),
    });
    heading = null;
  }

  if (slides.length === 0) {
    throw new Error('AsciiCanvas Slides Markdown requires at least one slide block.');
  }
  return slides;
};

export const parseSlideMarkdown = (source: string): ParsedSlideMarkdown => {
  const { bodyLines, size, title } = parseFrontMatter(source);
  const slides = parseSlideBlocks(bodyLines);
  let slideDeck = createSlideDeck({
    initialSlideId: 'slide-1',
    initialSlideName: slides[0].name,
    initialGrid: toGridEntries(slides[0].source, slides[0].syntax),
    size,
  });

  slides.slice(1).forEach((slide, index) => {
    slideDeck = addSlide(slideDeck, {
      id: `slide-${index + 2}`,
      name: slide.name,
      grid: toGridEntries(slide.source, slide.syntax),
      afterSlideId: slideDeck.slides.at(-1)?.id,
    });
  });

  slideDeck = { ...slideDeck, activeSlideId: slideDeck.slides[0].id };
  return { slideDeck, ...(title ? { title } : {}) };
};
