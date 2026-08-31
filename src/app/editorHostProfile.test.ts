import { describe, expect, it } from "vitest";
import {
  EDITOR_HOST_PROFILE,
  resolveEditorHostContract,
} from "./editorHostProfile";

describe("Editor Host contract", () => {
  it.each(["freeform", "structured", "slide"] as const)(
    "exposes editable %s behavior and surfaces",
    (mode) => {
      expect(resolveEditorHostContract(EDITOR_HOST_PROFILE, mode, true)).toEqual({
        capabilities: {
          navigate: true,
          select: true,
          copy: true,
          mutateContent: true,
          manageSessions: true,
          collaborate: mode !== "slide",
        },
        surfaces: { inspector: mode, sidebar: mode },
      });
    },
  );

  it("keeps inspection but removes insertion surfaces without write authority", () => {
    expect(resolveEditorHostContract(EDITOR_HOST_PROFILE, "freeform", false))
      .toEqual({
        capabilities: {
          ...EDITOR_HOST_PROFILE.capabilities,
          mutateContent: false,
        },
        surfaces: { inspector: "freeform", sidebar: null },
      });
  });

  it("makes Blackboard observation-only without editor surfaces", () => {
    expect(resolveEditorHostContract(EDITOR_HOST_PROFILE, "blackboard", true))
      .toEqual({
        capabilities: {
          ...EDITOR_HOST_PROFILE.capabilities,
          mutateContent: false,
          collaborate: false,
        },
        surfaces: { inspector: null, sidebar: null },
      });
  });
});
