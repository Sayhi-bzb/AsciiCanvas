import { COLOR_PRIMARY_TEXT } from "@/shared/lib/constants";
import type { GridCell, TextAttributes } from "@/shared/types";
import {
  cloneTextAttributes,
  normalizeCellHref,
} from "@/shared/utils/ansi";

export const decodeGridEntries = (
  value: unknown,
  fallbackColor = COLOR_PRIMARY_TEXT
): [string, GridCell][] => {
  if (!Array.isArray(value)) return [];

  return value.reduce<[string, GridCell][]>((entries, item) => {
    if (!Array.isArray(item) || typeof item[0] !== "string") return entries;
    const [key, rawCell] = item;
    if (typeof rawCell === "string") {
      entries.push([key, { char: rawCell, color: fallbackColor }]);
      return entries;
    }
    if (!rawCell || typeof rawCell !== "object") return entries;
    const candidate = rawCell as Record<string, unknown>;
    if (typeof candidate.char !== "string") return entries;
    const rawAttrs = candidate.attrs;
    const attrs =
      rawAttrs && typeof rawAttrs === "object" && !Array.isArray(rawAttrs)
        ? cloneTextAttributes(
            Object.fromEntries(
              ["bold", "italic", "underline", "strike", "inverse"].flatMap(
                (key) =>
                  (rawAttrs as Record<string, unknown>)[key] === true
                    ? [[key, true]]
                    : []
              )
            ) as TextAttributes
          )
        : undefined;
    const href = normalizeCellHref(candidate.href);
    entries.push([
      key,
      {
        char: candidate.char,
        color:
          typeof candidate.color === "string"
            ? candidate.color
            : fallbackColor,
        ...(typeof candidate.bgColor === "string"
          ? { bgColor: candidate.bgColor }
          : {}),
        ...(attrs ? { attrs } : {}),
        ...(href ? { href } : {}),
      },
    ]);
    return entries;
  }, []);
};

export const createGridMap = (value: unknown) =>
  new Map<string, GridCell>(decodeGridEntries(value));
