export type CharDeskViewerIcon =
  | "zoom-out"
  | "zoom-in"
  | "fit"
  | "copy-text"
  | "copy-source";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const iconPaths: Record<CharDeskViewerIcon, readonly string[]> = {
  "zoom-out": ["M5 12h14"],
  "zoom-in": ["M12 5v14", "M5 12h14"],
  fit: [
    "M8 3H5a2 2 0 0 0-2 2v3",
    "M16 3h3a2 2 0 0 1 2 2v3",
    "M8 21H5a2 2 0 0 1-2-2v-3",
    "M16 21h3a2 2 0 0 0 2-2v-3",
  ],
  "copy-text": [
    "M9 5h6",
    "M9 9h6",
    "M9 13h3",
    "M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
  ],
  "copy-source": [
    "M8 9 5 12l3 3",
    "m16 9 3 3-3 3",
    "m14 5-4 14",
    "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
  ],
};

export const createCharDeskViewerIcon = (name: CharDeskViewerIcon) => {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const definition of iconPaths[name]) {
    const path = document.createElementNS(SVG_NAMESPACE, "path");
    path.setAttribute("d", definition);
    svg.append(path);
  }
  return svg;
};
