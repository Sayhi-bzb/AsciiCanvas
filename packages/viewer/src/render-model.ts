import {
  parseCharDeskText,
  type CharDeskTextAttributes,
  type CharDeskTextCell,
  type ParseCharDeskTextOptions,
  type ParsedCharDeskText,
} from "@chardesk/protocol";

export type CharDeskRenderRun = {
  text: string;
  color?: string;
  bgColor?: string;
  attrs?: CharDeskTextAttributes;
  href?: string;
};

export type CharDeskRenderRow = {
  runs: CharDeskRenderRun[];
};

export type CharDeskRenderModel = {
  document: ParsedCharDeskText;
  rows: CharDeskRenderRow[];
};

const attrsKey = (attrs?: CharDeskTextAttributes) =>
  attrs
    ? `${attrs.bold ? 1 : 0}${attrs.italic ? 1 : 0}${
        attrs.underline ? 1 : 0
      }${attrs.strike ? 1 : 0}${attrs.inverse ? 1 : 0}`
    : "00000";

const styleKey = (cell: CharDeskTextCell) =>
  `${cell.color ?? ""}\u0000${cell.bgColor ?? ""}\u0000${attrsKey(
    cell.attrs
  )}\u0000${cell.href ?? ""}`;

const toRun = (cell: CharDeskTextCell, text = cell.text): CharDeskRenderRun => ({
  text,
  ...(cell.color ? { color: cell.color } : {}),
  ...(cell.bgColor ? { bgColor: cell.bgColor } : {}),
  ...(cell.attrs ? { attrs: { ...cell.attrs } } : {}),
  ...(cell.href ? { href: cell.href } : {}),
});

export const createCharDeskRenderModel = (
  source: string,
  options?: ParseCharDeskTextOptions
): CharDeskRenderModel => {
  const document = parseCharDeskText(source, options);
  const rows: CharDeskRenderRow[] = Array.from(
    { length: document.height },
    () => ({ runs: [] })
  );
  const cursors = new Array<number>(document.height).fill(0);
  const keys = new Array<string | null>(document.height).fill(null);

  for (const cell of document.cells) {
    const row = rows[cell.y];
    if (!row) continue;
    const cursor = cursors[cell.y] ?? 0;
    if (cell.x > cursor) {
      row.runs.push({ text: " ".repeat(cell.x - cursor) });
      keys[cell.y] = null;
    }

    const key = styleKey(cell);
    const previous = row.runs.at(-1);
    if (previous && keys[cell.y] === key) {
      previous.text += cell.text;
    } else {
      row.runs.push(toRun(cell));
      keys[cell.y] = key;
    }
    cursors[cell.y] = cell.x + cell.width;
  }

  return { document, rows };
};
