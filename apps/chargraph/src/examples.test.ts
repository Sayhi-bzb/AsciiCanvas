import { describe, expect, it } from "vitest";
import {
  CHARGRAPH_EXAMPLES,
  getExampleClipboardSource,
} from "./examples";

describe("CharGraph site examples adapter", () => {
  it("exposes the shared catalog and paste-ready sources", () => {
    const basicExamples = CHARGRAPH_EXAMPLES.filter(
      (example) => example.level === "basic"
    );
    const flowchart = basicExamples.find(
      (example) => example.kind === "flowchart"
    );

    expect(basicExamples).toHaveLength(11);
    expect(flowchart).toBeDefined();
    expect(getExampleClipboardSource(flowchart!)).toMatch(
      /^```mermaid\n[\s\S]+\n```$/
    );
  });
});
