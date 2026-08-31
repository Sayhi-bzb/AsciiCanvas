import {
  getCanvasModeDefinition,
  type CanvasMode,
} from "@/domains/sessions/public";

type EditorHostCapabilities = Readonly<{
  navigate: boolean;
  select: boolean;
  copy: boolean;
  mutateContent: boolean;
  manageSessions: boolean;
  collaborate: boolean;
}>;

type HostSurfaceCanvasMode = Exclude<CanvasMode, "blackboard">;

type EditorHostSurfacePermissions = Readonly<{
  inspector: boolean;
  sidebar: boolean;
}>;

export type EditorHostProfile = Readonly<{
  id: "editor";
  capabilities: EditorHostCapabilities;
  surfaces: EditorHostSurfacePermissions;
}>;

type ResolvedEditorHostContract = Readonly<{
  capabilities: EditorHostCapabilities;
  surfaces: Readonly<{
    inspector: HostSurfaceCanvasMode | null;
    sidebar: HostSurfaceCanvasMode | null;
  }>;
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
  surfaces: {
    inspector: true,
    sidebar: true,
  },
};

export const resolveEditorHostContract = (
  profile: EditorHostProfile,
  mode: CanvasMode,
  collaborationCanEdit: boolean
): ResolvedEditorHostContract => {
  const modeCapabilities = getCanvasModeDefinition(mode).capabilities;
  const modeCanMutate =
    modeCapabilities.mutateCells ||
    modeCapabilities.mutateScene ||
    modeCapabilities.managePages;
  const mutateContent =
    profile.capabilities.mutateContent &&
    collaborationCanEdit &&
    modeCanMutate;
  const surfaceMode: HostSurfaceCanvasMode | null =
    mode === "blackboard" ? null : mode;

  return {
    capabilities: {
      ...profile.capabilities,
      navigate: profile.capabilities.navigate && modeCapabilities.navigate,
      select: profile.capabilities.select && modeCapabilities.select,
      copy: profile.capabilities.copy && modeCapabilities.copy,
      mutateContent,
      collaborate:
        profile.capabilities.collaborate && modeCapabilities.collaborate,
    },
    surfaces: {
      inspector: profile.surfaces.inspector ? surfaceMode : null,
      sidebar:
        profile.surfaces.sidebar && mutateContent ? surfaceMode : null,
    },
  };
};
