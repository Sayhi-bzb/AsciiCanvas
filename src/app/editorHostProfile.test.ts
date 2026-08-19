import { describe, expect, it } from "vitest";
import {
  BLACKBOARD_HOST_PROFILE,
  EDITOR_HOST_PROFILE,
  intersectHostCapabilities,
} from "./editorHostProfile";

describe("Editor Host profiles", () => {
  it("keeps the editor fully capable and Blackboard observation-only", () => {
    expect(Object.values(EDITOR_HOST_PROFILE.capabilities).every(Boolean)).toBe(true);
    expect(BLACKBOARD_HOST_PROFILE.capabilities).toEqual({
      navigate: true,
      select: true,
      copy: true,
      mutateContent: false,
      manageSessions: false,
      collaborate: false,
    });
  });

  it("intersects collaboration edit permission without disabling observation", () => {
    expect(intersectHostCapabilities(EDITOR_HOST_PROFILE.capabilities, false)).toEqual({
      ...EDITOR_HOST_PROFILE.capabilities,
      mutateContent: false,
    });
  });
});
