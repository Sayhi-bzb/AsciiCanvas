import { parseCharDeskText } from "@chardesk/protocol";
import type { CanvasImportSnapshot } from "@/domains/sessions/public";
import { COLOR_PRIMARY_TEXT } from "@/shared/lib/constants";

const isLegacyJsonDocument = (source: string) => {
  if (!source.startsWith("{")) return false;
  try {
    const parsed = JSON.parse(source) as { type?: unknown };
    return parsed?.type === "chardesk-document";
  } catch {
    return false;
  }
};

export const parseCharDeskCanvasSource = (
  source: string
): CanvasImportSnapshot => {
  const trimmed = source.trimStart();
  if (isLegacyJsonDocument(trimmed)) {
    throw new Error("Legacy JSON CharDesk documents are not supported.");
  }
  if (source.includes("\u001b")) {
    throw new Error("CharDesk files use visible ESC-less ANSI controls.");
  }

  const parsed = parseCharDeskText(source, {
    syntax: "ansi",
    defaultStyle: { color: COLOR_PRIMARY_TEXT },
  });
  if (parsed.diagnostics.length > 0) {
    throw new Error("CharDesk source contains malformed or unsupported controls.");
  }

  return {
    mode: "freeform",
    scene: [],
    components: [],
    grid: parsed.cells.map((cell) => [
      `${cell.x},${cell.y}`,
      {
        char: cell.text,
        color: cell.color ?? COLOR_PRIMARY_TEXT,
        ...(cell.bgColor ? { bgColor: cell.bgColor } : {}),
        ...(cell.attrs ? { attrs: { ...cell.attrs } } : {}),
        ...(cell.href ? { href: cell.href } : {}),
      },
    ]),
  };
};
