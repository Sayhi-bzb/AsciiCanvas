export type CanvasMode = "freeform" | "structured" | "slide" | "blackboard";

type StaticGridCanvasMode = "freeform" | "slide" | "blackboard";

export type CanvasModeCapabilities = Readonly<{
  navigate: boolean;
  select: boolean;
  copy: boolean;
  mutateCells: boolean;
  mutateScene: boolean;
  managePages: boolean;
  collaborate: boolean;
}>;

export type CanvasModeDefinition = Readonly<{
  authority: "yjs-document" | "blackboard-workspace";
  surface: "cell-plane" | "structured-projection" | "slide-page";
  capabilities: CanvasModeCapabilities;
}>;

const NAVIGABLE = { navigate: true, select: true, copy: true } as const;

export const CANVAS_MODE_DEFINITIONS = {
  freeform: {
    authority: "yjs-document",
    surface: "cell-plane",
    capabilities: {
      ...NAVIGABLE,
      mutateCells: true,
      mutateScene: false,
      managePages: false,
      collaborate: true,
    },
  },
  structured: {
    authority: "yjs-document",
    surface: "structured-projection",
    capabilities: {
      ...NAVIGABLE,
      mutateCells: false,
      mutateScene: true,
      managePages: false,
      collaborate: true,
    },
  },
  slide: {
    authority: "yjs-document",
    surface: "slide-page",
    capabilities: {
      ...NAVIGABLE,
      mutateCells: true,
      mutateScene: false,
      managePages: true,
      collaborate: false,
    },
  },
  blackboard: {
    authority: "blackboard-workspace",
    surface: "cell-plane",
    capabilities: {
      ...NAVIGABLE,
      mutateCells: false,
      mutateScene: false,
      managePages: false,
      collaborate: false,
    },
  },
} as const satisfies Record<CanvasMode, CanvasModeDefinition>;

export const getCanvasModeDefinition = (mode: CanvasMode) =>
  CANVAS_MODE_DEFINITIONS[mode];

export const isStaticGridMode = (
  mode: CanvasMode
): mode is StaticGridCanvasMode =>
  mode === "freeform" || mode === "slide" || mode === "blackboard";
