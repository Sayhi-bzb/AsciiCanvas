export type CanvasMode = "freeform" | "structured" | "slide";

type StaticGridCanvasMode = "freeform" | "slide";

export const isStaticGridMode = (
  mode: CanvasMode
): mode is StaticGridCanvasMode => mode === "freeform" || mode === "slide";
