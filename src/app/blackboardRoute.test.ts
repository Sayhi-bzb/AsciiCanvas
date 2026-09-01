import { describe, expect, it } from "vitest";
import { isBlackboardRoute, isLocalBlackboardReaderRoute } from "./blackboardRoute";

describe("Blackboard routes", () => {
  it.each([
    "/blackboard",
    "/session/0123456789abcdef/blackboard",
  ])("recognizes %s", (pathname) => {
    expect(isBlackboardRoute({ pathname })).toBe(true);
  });

  it.each([
    "/",
    "/blackboards",
    "/session/0123456789abcdef/blackboard/board",
  ])("rejects %s", (pathname) => {
    expect(isBlackboardRoute({ pathname })).toBe(false);
  });

  it("requires the explicit local reader query", () => {
    expect(isLocalBlackboardReaderRoute({
      pathname: "/session/0123456789abcdef/blackboard",
      search: "?reader=1",
    })).toBe(true);
    expect(isLocalBlackboardReaderRoute({
      pathname: "/session/0123456789abcdef/blackboard",
      search: "",
    })).toBe(false);
  });
});
