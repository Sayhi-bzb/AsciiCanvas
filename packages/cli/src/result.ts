import type {
  CharDeskTextCell,
  ParsedCharDeskText,
} from "@chardesk/protocol";

export type CharDeskResultRegion = {
  x: number;
  y: number;
  columns: number;
  rows: number;
};

export type CharDeskResultProjection = {
  text: string;
  styleText?: string;
  view: CharDeskResultRegion;
  omitted: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
};

const DEFAULT_COLUMNS = 96;
const DEFAULT_ROWS = 32;
const MAX_STYLE_REGIONS = 256;

type StyleRun = {
  x: number;
  y: number;
  width: number;
  key: string;
  tokens: string[];
};

type StyleRegion = StyleRun & {
  endY: number;
};

const styleTokens = (cell: CharDeskTextCell) => [
  ...(cell.color ? [`fg:${cell.color}`] : []),
  ...(cell.bgColor ? [`bg:${cell.bgColor}`] : []),
  ...(cell.attrs?.bold ? ["bold"] : []),
  ...(cell.attrs?.italic ? ["italic"] : []),
  ...(cell.attrs?.underline ? ["underline"] : []),
  ...(cell.attrs?.strike ? ["strike"] : []),
  ...(cell.attrs?.inverse ? ["inverse"] : []),
  ...(cell.href ? [`link:${JSON.stringify(cell.href)}`] : []),
];

const styleRuns = (cells: CharDeskTextCell[]) => {
  const runs: StyleRun[] = [];
  for (const cell of cells) {
    const tokens = styleTokens(cell);
    if (tokens.length === 0) continue;
    const key = tokens.join("\u0000");
    const previous = runs[runs.length - 1];
    if (
      previous
      && previous.y === cell.y
      && previous.x + previous.width === cell.x
      && previous.key === key
    ) {
      previous.width += cell.width;
      continue;
    }
    runs.push({ x: cell.x, y: cell.y, width: cell.width, key, tokens });
  }
  return runs;
};

const styleRegions = (runs: StyleRun[]) => {
  const grouped = new Map<string, StyleRegion[]>();
  for (const run of runs) {
    const geometryKey = `${run.key}\u0001${run.x}\u0001${run.width}`;
    const regions = grouped.get(geometryKey) ?? [];
    const previous = regions[regions.length - 1];
    if (previous && previous.endY + 1 === run.y) {
      previous.endY = run.y;
    } else {
      regions.push({ ...run, endY: run.y });
    }
    grouped.set(geometryKey, regions);
  }
  return [...grouped.values()]
    .flat()
    .sort((left, right) => (
      left.y - right.y
      || left.x - right.x
      || left.endY - right.endY
      || left.width - right.width
    ));
};

const regionSelector = (region: StyleRegion) => {
  const y = region.y === region.endY ? String(region.y) : `${region.y}-${region.endY}`;
  const endX = region.x + region.width - 1;
  const x = region.x === endX ? String(region.x) : `${region.x}-${endX}`;
  return `${y}:${x}`;
};

const projectStyles = (cells: CharDeskTextCell[]) => {
  const regions = styleRegions(styleRuns(cells));
  if (regions.length === 0) return "styles:none";

  const shown = regions.slice(0, MAX_STYLE_REGIONS);
  const rules = new Map<string, { tokens: string[]; selectors: string[] }>();
  for (const region of shown) {
    const rule = rules.get(region.key) ?? { tokens: region.tokens, selectors: [] };
    rule.selectors.push(regionSelector(region));
    rules.set(region.key, rule);
  }
  const header = regions.length > shown.length
    ? `styles:${shown.length}/${regions.length} regions · narrow --region`
    : "styles:";
  return [
    header,
    ...[...rules.values()].map(({ tokens, selectors }) =>
      `  ${selectors.join(",")}{${tokens.join(";")}}`
    ),
  ].join("\n");
};

const snapHorizontalBounds = (
  document: ParsedCharDeskText,
  start: number,
  end: number,
) => {
  let snappedStart = start;
  let snappedEnd = end;
  for (const cell of document.cells) {
    const cellEnd = cell.x + cell.width;
    if (cell.x < snappedStart && cellEnd > snappedStart) snappedStart = cell.x;
    if (cell.x < snappedEnd && cellEnd > snappedEnd) snappedEnd = cellEnd;
  }
  return {
    start: Math.max(0, snappedStart),
    end: Math.min(document.width, snappedEnd),
  };
};

const resolveView = (
  document: ParsedCharDeskText,
  requested?: CharDeskResultRegion,
): CharDeskResultRegion => {
  const base = requested ?? {
    x: 0,
    y: 0,
    columns: Math.min(document.width, DEFAULT_COLUMNS),
    rows: Math.min(document.height, DEFAULT_ROWS),
  };
  const endX = Math.min(document.width, base.x + base.columns);
  const endY = Math.min(document.height, base.y + base.rows);
  const horizontal = snapHorizontalBounds(document, base.x, endX);
  return {
    x: horizontal.start,
    y: base.y,
    columns: horizontal.end - horizontal.start,
    rows: endY - base.y,
  };
};

const ruler = (start: number, columns: number) => {
  const labels = Array.from({ length: columns }, () => " ");
  const firstTick = Math.ceil(start / 10) * 10;
  for (let coordinate = firstTick; coordinate < start + columns; coordinate += 10) {
    const offset = coordinate - start;
    for (const [index, character] of [...String(coordinate)].entries()) {
      if (offset + index < labels.length) labels[offset + index] = character;
    }
  }
  const digits = Array.from(
    { length: columns },
    (_, offset) => String((start + offset) % 10),
  ).join("");
  return { labels: labels.join("").trimEnd(), digits };
};

const projectRow = (
  document: ParsedCharDeskText,
  y: number,
  start: number,
  end: number,
) => {
  const cells = document.cells
    .filter((cell) => cell.y === y && cell.x >= start && cell.x + cell.width <= end)
    .sort((left, right) => left.x - right.x);
  let cursor = start;
  let output = "";
  for (const cell of cells) {
    if (cell.x > cursor) output += " ".repeat(cell.x - cursor);
    output += cell.text;
    cursor = cell.x + cell.width;
  }
  return output.trimEnd();
};

export const projectCharDeskResult = (
  document: ParsedCharDeskText,
  options: {
    region?: CharDeskResultRegion;
    ruler?: boolean;
    styles?: boolean;
  } = {},
): CharDeskResultProjection => {
  const view = resolveView(document, options.region);
  const endX = view.x + view.columns;
  const endY = view.y + view.rows;
  const rowLabelWidth = String(Math.max(view.y, endY - 1)).length;
  const lines: string[] = [];
  const visibleCells = document.cells
    .filter((cell) => (
      cell.y >= view.y
      && cell.y < endY
      && cell.x >= view.x
      && cell.x + cell.width <= endX
    ))
    .sort((left, right) => left.y - right.y || left.x - right.x);

  if (options.ruler !== false) {
    const horizontal = ruler(view.x, view.columns);
    const indent = " ".repeat(rowLabelWidth + 3);
    lines.push(`${indent}${horizontal.labels}`, `${indent}${horizontal.digits}`);
  }
  for (let y = view.y; y < endY; y += 1) {
    const content = projectRow(document, y, view.x, endX);
    lines.push(options.ruler === false
      ? content
      : `${String(y).padStart(rowLabelWidth)} │ ${content}`.trimEnd());
  }

  return {
    text: lines.join("\n"),
    ...(options.styles ? { styleText: projectStyles(visibleCells) } : {}),
    view,
    omitted: {
      left: view.x,
      right: document.width - endX,
      top: view.y,
      bottom: document.height - endY,
    },
  };
};
