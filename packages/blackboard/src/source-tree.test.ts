import { describe, expect, it } from "vitest";
import {
  compileBlackboardSourceTree,
  normalizeBlackboardPath,
} from "./source-tree.js";

const manifest = `chardesk: blackboard/v1
title: Example
panels:
  intro:
    source: panels/intro.panel
layout:
  areas:
    - [intro]
`;

describe("Blackboard source tree", () => {
  it("compiles virtual files through the package compiler", async () => {
    const compiled = await compileBlackboardSourceTree(new Map([
      ["blackboard.yaml", manifest],
      ["panels/intro.panel", "Hello"],
    ]));
    expect(compiled).toMatchObject({ title: "Example", source: "Hello" });
  });

  it.each(["../secret", "/root", "a\\b", "a//b"])(
    "rejects paths outside the virtual root: %s",
    (path) => expect(() => normalizeBlackboardPath(path)).toThrow(),
  );
});
