import { describe, expect, it } from "vitest";
import { getCharGraphText } from "./index.js";
import { renderMermaid } from "./mermaid.js";

const render = async (source: string) => {
  const result = await renderMermaid(source);
  return { result, text: getCharGraphText(result) };
};

describe("Mermaid reliable subset", () => {
  it("consumes no-space and semicolon-separated flow statements", async () => {
    const { result, text } = await render("flowchart LR\nA-->B; B-->C");

    expect(result.diagnostics).toEqual([]);
    expect(text).toContain("A");
    expect(text).toContain("B");
    expect(text).toContain("C");
    expect(text).not.toContain("A--");
  });

  it("supports CJK node identities without requiring ASCII aliases", async () => {
    const { result, text } = await render("flowchart LR\n开始-->完成");

    expect(result.diagnostics).toEqual([]);
    expect(text).toContain("开始");
    expect(text).toContain("完成");
  });

  it.each([
    ["unsupported click", "flowchart LR\nA-->B\nclick A https://example.com"],
    ["unsupported style", "flowchart LR\nA-->B\nstyle A fill:#f00"],
    ["unsupported class shorthand", "flowchart LR\nA:::highlight-->B"],
    ["invalid XY number", "xychart-beta\nline [1, nope, 3]"],
    ["unclosed subgraph", "flowchart LR\nsubgraph Group\nA-->B"],
    ["subgraph direction", "flowchart TD\nsubgraph Group\ndirection LR\nA-->B\nend"],
    ["frontmatter", "---\ntitle: Example\n---\nflowchart LR\nA-->B"],
    ["empty diagram", "flowchart LR"],
  ])("preserves source for %s", async (_name, source) => {
    const { result, text } = await render(source);

    expect(result.diagnostics).toHaveLength(1);
    expect(text).toBe(source);
    expect(result.diagnostics[0]?.message).toMatch(/^Mermaid source preserved:/u);
  });

  it("detects a sequence diagram after leading comments", async () => {
    const source = "%% comment\nsequenceDiagram\nA->>B: hello";
    const { result, text } = await render(source);

    expect(result.diagnostics).toEqual([]);
    expect(text).toContain("hello");
    expect(text).not.toContain("sequenceDiagram");
  });

  it("renders distinct sequence endpoint markers and activations", async () => {
    const { result, text } = await render(`sequenceDiagram
participant A
participant B
Note over A,B: before
A-)B: open
A-xB: rejected
A->>+B: begin
B-->>-A: finish`);

    expect(result.diagnostics).toEqual([]);
    expect(text).toContain("before");
    expect(text).toContain(")");
    expect(text).toContain("x");
    expect(text).toContain("┃");
  });

  it("keeps activation on its lifeline and deactivates the sender", async () => {
    const { result, text } = await render(`sequenceDiagram
participant User
participant API
User->>+API: Request
API-->>-User: Completed`);

    expect(result.diagnostics).toEqual([]);
    expect(text).toContain(">┃");
    expect(text).toMatch(/┃.*Completed|Completed.*┃/u);
    expect(text).not.toContain("│┃");
    expect(text).not.toContain("╫");
    const lines = text.split("\n");
    expect(lines[lines.length - 2]).not.toContain("┃");
  });

  it("keeps nested activations active until their outer response", async () => {
    const { result, text } = await render(`sequenceDiagram
participant User
participant API
User->>+API: First
User->>+API: Nested
API-->>-User: Nested done
API-->>-User: Done`);

    expect(result.diagnostics).toEqual([]);
    expect(text.match(/┃/gu)?.length).toBeGreaterThanOrEqual(4);
    expect(text).not.toContain("│┃");
  });

  it("preserves a sequence with an unmatched deactivation", async () => {
    const source = "sequenceDiagram\nAPI-->>-User: Completed";
    const { result, text } = await render(source);

    expect(text).toBe(source);
    expect(result.diagnostics[0]?.message)
      .toContain("Mermaid source preserved: Cannot deactivate inactive participant");
  });

  it("honors class labels and class/ER directions", async () => {
    const classTd = await render("classDiagram\ndirection TD\nclass A[\"Display Name\"]\nclass B\nA --> B");
    const classLr = await render("classDiagram\ndirection LR\nclass A[\"Display Name\"]\nclass B\nA --> B");
    const erTd = await render("erDiagram\ndirection TD\nA ||--|| B : owns");
    const erLr = await render("erDiagram\ndirection LR\nA ||--|| B : owns");

    expect(classTd.result.diagnostics).toEqual([]);
    expect(classTd.text).toContain("Display Name");
    expect(classTd.text).not.toBe(classLr.text);
    expect(erTd.text).not.toBe(erLr.text);
  });

  it("keeps comma-separated ER keys", async () => {
    const { result, text } = await render(`erDiagram
USER {
  string owner_id PK, FK
}`);

    expect(result.diagnostics).toEqual([]);
    expect(text).toContain("PK,FK");
  });

  it("renders long, circle, and cross flow endpoints", async () => {
    const { result, text } = await render("flowchart LR\nA ----> B\nB --o C\nC --x D");

    expect(result.diagnostics).toEqual([]);
    expect(text).toContain("○");
    expect(text).toContain("×");
  });

  it("reduces inline Mermaid formatting to cell text without leaking HTML", async () => {
    const { result, text } = await render("flowchart LR\nA[**bold**] --> B");

    expect(result.diagnostics).toEqual([]);
    expect(text).toContain("bold");
    expect(text).not.toMatch(/<\/?b>/u);
  });

  it("keeps CJK-only groups distinct", async () => {
    const diagram = await render(`flowchart TD
subgraph 第一组
A --> B
end
subgraph 第二组
C --> D
end`);

    expect(diagram.result.diagnostics).toEqual([]);
    expect(diagram.text).toContain("第一组");
    expect(diagram.text).toContain("第二组");
  });
});
