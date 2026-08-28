import { CHARDESK_FONT_PROFILE } from "@chardesk/fonts";

export type CanvasWorkerFontFace = {
  id: string;
  family: string;
  sourceUrl: string;
  weight: string;
  style: string;
  unicodeRange?: string;
};

type CanvasWorkerFontRange = { from: number; to: number };

const rangeCache = new Map<string, readonly CanvasWorkerFontRange[]>();

const FONT_FAMILIES = new Set<string>(
  CHARDESK_FONT_PROFILE.sources.map(({ family }) => family)
);

const unquote = (value: string) =>
  value.trim().replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/u, "$1$2");

const readSourceUrl = (source: string, baseUrl: string) => {
  const match = /url\((?:"([^"]+)"|'([^']+)'|([^)'"\s]+))\)/iu.exec(source);
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  if (!value) return null;
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return null;
  }
};

export const parseCanvasWorkerFontRanges = (
  unicodeRange: string | undefined
): readonly CanvasWorkerFontRange[] => {
  if (!unicodeRange) return [];
  const cached = rangeCache.get(unicodeRange);
  if (cached) return cached;
  const ranges = unicodeRange.split(",").flatMap((value) => {
    const match = /^\s*U\+([0-9A-F]+)(?:-([0-9A-F]+))?\s*$/iu.exec(value);
    if (!match) return [];
    const from = Number.parseInt(match[1]!, 16);
    const to = Number.parseInt(match[2] ?? match[1]!, 16);
    return Number.isSafeInteger(from) && Number.isSafeInteger(to)
      ? [{ from, to }]
      : [];
  });
  rangeCache.set(unicodeRange, ranges);
  return ranges;
};

export const canvasWorkerFontFaceCovers = (
  face: Pick<CanvasWorkerFontFace, "unicodeRange">,
  codePoints: readonly number[]
) => {
  const ranges = parseCanvasWorkerFontRanges(face.unicodeRange);
  return ranges.length === 0 || codePoints.some((point) =>
    ranges.some(({ from, to }) => point >= from && point <= to)
  );
};

export const selectCanvasWorkerFontFaces = (
  faces: readonly CanvasWorkerFontFace[],
  graphemes: Iterable<string>
) => {
  const codePoints = new Set<number>();
  for (const grapheme of graphemes) {
    for (const character of grapheme) codePoints.add(character.codePointAt(0)!);
  }
  if (codePoints.size === 0) return [];
  const points = [...codePoints];
  return faces.filter((face) => canvasWorkerFontFaceCovers(face, points));
};

export const collectCanvasWorkerFontFaces = (
  styleSheets: StyleSheetList = document.styleSheets,
  baseUrl = document.baseURI
): CanvasWorkerFontFace[] => {
  const faces: CanvasWorkerFontFace[] = [];
  for (const sheet of Array.from(styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = (sheet as CSSStyleSheet).cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (
        typeof CSSFontFaceRule === "undefined" ||
        !(rule instanceof CSSFontFaceRule)
      ) continue;
      const family = unquote(rule.style.getPropertyValue("font-family"));
      if (!FONT_FAMILIES.has(family)) continue;
      const sourceUrl = readSourceUrl(
        rule.style.getPropertyValue("src"),
        (sheet as CSSStyleSheet).href ?? baseUrl
      );
      if (!sourceUrl) continue;
      const weight = rule.style.getPropertyValue("font-weight") || "400";
      const style = rule.style.getPropertyValue("font-style") || "normal";
      const unicodeRange = rule.style.getPropertyValue("unicode-range") || undefined;
      faces.push({
        id: `${family}:${weight}:${style}:${unicodeRange ?? "*"}:${sourceUrl}`,
        family,
        sourceUrl,
        weight,
        style,
        ...(unicodeRange ? { unicodeRange } : {}),
      });
    }
  }
  return faces;
};

export const getCanvasWorkerFontRevision = (
  faces: readonly CanvasWorkerFontFace[]
) => {
  let hash = 2166136261;
  const source = `${CHARDESK_FONT_PROFILE.id}|${faces.map(({ id }) => id).join("|")}`;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${CHARDESK_FONT_PROFILE.id}:${(hash >>> 0).toString(16)}`;
};

/** @internal */
export const CANVAS_WORKER_FONT_CALIBRATION_TEXT = [
  "ASCII",
  "中文",
  "한글",
  "日本",
  "╭─╮",
  "♥️",
].join("");
