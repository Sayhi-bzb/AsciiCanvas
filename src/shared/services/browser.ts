export const browser = {
  setBodyCursor(cursor: string) {
    if (typeof document === "undefined") return;
    document.body.style.cursor = cursor;
  },
  openExternal(url: string, target: "_blank" | "_self" = "_blank") {
    if (typeof window === "undefined") return null;
    return window.open(url, target, "noopener,noreferrer");
  },
};
