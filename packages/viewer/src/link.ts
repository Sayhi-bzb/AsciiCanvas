const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

const isRelativeHref = (href: string) =>
  href.startsWith("#") ||
  href.startsWith("/") ||
  href.startsWith("./") ||
  href.startsWith("../");

export const sanitizeCharDeskHref = (value: string): string | null => {
  const href = value.trim();
  if (!href) return null;
  if (isRelativeHref(href)) return href;
  try {
    const url = new URL(href);
    return SAFE_PROTOCOLS.has(url.protocol) ? href : null;
  } catch {
    return null;
  }
};
