export type CanvasEditorCapabilities = Readonly<{
  navigate: boolean;
  select: boolean;
  copy: boolean;
  mutateContent: boolean;
}>;

export const DEFAULT_CANVAS_EDITOR_CAPABILITIES: CanvasEditorCapabilities = {
  navigate: true,
  select: true,
  copy: true,
  mutateContent: true,
};
