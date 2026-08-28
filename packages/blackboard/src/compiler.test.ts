import { describe, expect, it } from "vitest";
import { compileBlackboard } from "./compiler.js";

const source = (panelPath = "panels/content.panel") => `
chardesk: blackboard/v1
panels:
  content: { source: ${panelPath} }
layout:
  areas: [[content]]
`;

describe("compileBlackboard", () => {
  it("uses an injected Panel reader and the directory fallback title", async () => {
    const readPanel = async () => "[1m界[0m\n|||\n👩‍💻";
    await expect(compileBlackboard({
      manifestSource: source(),
      fallbackTitle: "gpu",
      readPanel,
    })).resolves.toMatchObject({
      title: "gpu",
      source: expect.stringContaining("👩‍💻"),
    });
  });

  it.each([
    "../outside.panel",
    "/outside.panel",
    "panels\\outside.panel",
    "panels/./outside.panel",
  ])("rejects non-portable Panel path %s before reading", async (panelPath) => {
    const readPanel = async () => "unreachable";
    await expect(compileBlackboard({
      manifestSource: source(panelPath),
      fallbackTitle: "gpu",
      readPanel,
    })).rejects.toMatchObject({ code: "invalid-panel-path", panel: "content" });
  });
});
