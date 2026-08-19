type EditorHostCapabilities = Readonly<{
  navigate: boolean;
  select: boolean;
  copy: boolean;
  mutateContent: boolean;
  manageSessions: boolean;
  collaborate: boolean;
}>;

export type EditorHostProfile = Readonly<{
  id: "editor" | "blackboard";
  capabilities: EditorHostCapabilities;
}>;

export const EDITOR_HOST_PROFILE: EditorHostProfile = {
  id: "editor",
  capabilities: {
    navigate: true,
    select: true,
    copy: true,
    mutateContent: true,
    manageSessions: true,
    collaborate: true,
  },
};

export const BLACKBOARD_HOST_PROFILE: EditorHostProfile = {
  id: "blackboard",
  capabilities: {
    navigate: true,
    select: true,
    copy: true,
    mutateContent: false,
    manageSessions: false,
    collaborate: false,
  },
};

export const intersectHostCapabilities = (
  host: EditorHostCapabilities,
  collaborationCanEdit: boolean
): EditorHostCapabilities => ({
  ...host,
  mutateContent: host.mutateContent && collaborationCanEdit,
});
