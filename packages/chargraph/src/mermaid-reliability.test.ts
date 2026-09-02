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

  it("gives compact edges precedence over asymmetric node syntax", async () => {
    const { result, text } = await render(
      "flowchart LR\nA-->B[矩形]-->C(圆角)-->D{判断}",
    );

    expect(result.diagnostics).toEqual([]);
    expect(text).toMatch(/│ A ├.*>│ 矩形 ├.*>│ 圆角 ├.*>│ ◇ 判断 │/u);
    expect(text).not.toContain("▷ B[矩形");
  });

  it("keeps compact text-labeled connectors outside node identities", async () => {
    const { result, text } = await render(
      "flowchart LR\nA-. retry .->B\nB== strong ==>C",
    );

    expect(result.diagnostics).toEqual([]);
    expect(text).toContain("retry");
    expect(text).toContain("strong");
    expect(text).toMatch(/┄┄>/u);
    expect(text).toMatch(/══>/u);
  });

  it("parses a compact bidirectional connector", async () => {
    const { result, text } = await render("flowchart LR\nA<-->B");

    expect(result.diagnostics).toEqual([]);
    expect(text).toMatch(/<.*>/u);
  });

  it.each(["LR", "RL", "TD", "BT"] as const)(
    "keeps a labeled backbone straight with a shortcut in %s",
    async (direction) => {
      const { result, text } = await render(`flowchart ${direction}
Client<-->Gateway
Gateway==>|主链路|Service
Client-. retry .->Service`);
      const lines = text.split("\n");
      const rows = ["Client", "Gateway", "Service"].map((label) =>
        lines.findIndex((line) => line.includes(label))
      );

      expect(result.diagnostics).toEqual([]);
      expect(text).toContain("retry");
      expect(text).not.toMatch(/[╵╷╴╶]/u);
      if (direction === "LR" || direction === "RL") {
        expect(new Set(rows).size).toBe(1);
        expect(text).toMatch(/═+ 主链路 ═+/u);
      } else {
        expect(direction === "TD" ? rows : [...rows].reverse()).toEqual(
          [...rows].sort((left, right) => left - right),
        );
        expect(text).toMatch(/║ 主链路/u);
      }
    },
  );

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

  it("renders explicit activation commands like message shorthands", async () => {
    const explicit = await render(`sequenceDiagram
participant User
participant API
User->>API: Request
activate API
API->>API: Work
API-->>User: Completed
deactivate API`);
    const shorthand = await render(`sequenceDiagram
participant User
participant API
User->>+API: Request
API->>API: Work
API-->>-User: Completed`);

    expect(explicit.result.diagnostics).toEqual([]);
    expect(explicit.text).toBe(shorthand.text);
    expect(explicit.text).toContain("┃");
  });

  it("keeps explicit activation ordered around notes and block boundaries", async () => {
    const before = await render(`sequenceDiagram
participant A
participant B
A->>B: Request
activate B
Note right of B: active`);
    const after = await render(`sequenceDiagram
participant A
participant B
A->>B: Request
Note right of B: inactive
activate B`);
    const afterBlock = await render(`sequenceDiagram
participant A
participant B
loop Request
A->>B: Work
end
activate B`);

    expect(before.result.diagnostics).toEqual([]);
    expect(after.result.diagnostics).toEqual([]);
    expect(afterBlock.result.diagnostics).toEqual([]);
    const beforeLines = before.text.split("\n");
    const afterLines = after.text.split("\n");
    const afterBlockLines = afterBlock.text.split("\n");
    expect(beforeLines.findIndex((line) => line.includes("┃")))
      .toBeLessThan(beforeLines.findIndex((line) => line.includes("active")));
    expect(afterLines.findIndex((line) => line.includes("┃")))
      .toBeGreaterThan(afterLines.findIndex((line) => line.includes("inactive")));
    expect(afterBlockLines.findIndex((line) => line.includes("┃")))
      .toBeGreaterThan(afterBlockLines.findIndex((line) => line.startsWith("╰")));
  });

  it("preserves a sequence with an unmatched deactivation", async () => {
    const source = "sequenceDiagram\nAPI-->>-User: Completed";
    const { result, text } = await render(source);

    expect(text).toBe(source);
    expect(result.diagnostics[0]?.message)
      .toContain("Mermaid source preserved: Cannot deactivate inactive participant");
  });

  it("preserves an unmatched explicit sequence deactivation", async () => {
    const source = "sequenceDiagram\ndeactivate API";
    const { result, text } = await render(source);

    expect(text).toBe(source);
    expect(result.diagnostics[0]?.message)
      .toContain("Mermaid source preserved: Cannot deactivate inactive participant");
  });

  it("accepts type-first and colon-style class members", async () => {
    const { result, text } = await render(`classDiagram
class Document {
  +string owner
  +title: string
  +save(path): boolean
}`);

    expect(result.diagnostics).toEqual([]);
    expect(text).toContain("+owner: string");
    expect(text).toContain("+title: string");
    expect(text).toContain("+save(path): boolean");
    expect(text).not.toContain(": :");
  });

  it("accepts both zero-many cardinality orders on an ER source", async () => {
    const { result, text } = await render(`erDiagram
A }o--|| B : first
C o}--|| D : second`);

    expect(result.diagnostics).toEqual([]);
    expect(text).toContain("first");
    expect(text).toContain("second");
    expect(text.match(/╢○/gu)).toHaveLength(2);
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

  it.each(["LR", "RL", "TD", "BT"] as const)(
    "routes a complete bipartite Flow in %s without competing buses",
    async (direction) => {
      const { result, text } = await render(`flowchart ${direction}
A-->C
A-->D
B-->C
B-->D`);

      expect(result.diagnostics).toEqual([]);
      for (const label of ["A", "B", "C", "D"]) {
        expect(text).toContain(label);
      }
      expect(text.match(/[<>^v]/gu)?.length).toBeGreaterThanOrEqual(4);
    },
  );

  it.each(["LR", "RL", "TD", "BT"] as const)(
    "routes a complete bipartite State diagram in %s",
    async (direction) => {
      const { result, text } = await render(`stateDiagram-v2
direction ${direction}
A-->C
A-->D
B-->C
B-->D`);

      expect(result.diagnostics).toEqual([]);
      expect(text.match(/[<>^v]/gu)?.length).toBeGreaterThanOrEqual(4);
    },
  );

  it.each(["LR", "RL", "TD", "BT"] as const)(
    "routes a two-by-three complete bipartite Flow in %s",
    async (direction) => {
      const { result, text } = await render(`flowchart ${direction}
A-->C
A-->D
A-->E
B-->C
B-->D
B-->E`);

      expect(result.diagnostics).toEqual([]);
      expect(text.match(/[<>^v]/gu)?.length).toBeGreaterThanOrEqual(6);
    },
  );

  it("falls back from DAG priorities for a dense directed cycle", async () => {
    const { result, text } = await render(`flowchart LR
A-->B
B-->C
C-->D
D-->A
A-->C
B-->D`);

    expect(result.diagnostics).toEqual([]);
    expect(text.match(/[<>^v]/gu)?.length).toBeGreaterThanOrEqual(6);
    expect(text).not.toMatch(/[╵╷╴╶]/u);
  });

  it.each(["LR", "RL", "TD", "BT"] as const)(
    "renders a compact closed Flow self-loop in %s",
    async (direction) => {
      const { result, text } = await render(`flowchart ${direction}\nA-->A`);

      expect(result.diagnostics).toEqual([]);
      expect(text).toContain("│ A │");
      expect(text.match(/[<>^v]/gu)).toHaveLength(1);
      expect(text.split("\n").length).toBeLessThanOrEqual(5);
    },
  );

  it("compacts Class and multiple ER self relationships", async () => {
    const classResult = await render(`classDiagram
class Node
Node --> Node : next`);
    const erResult = await render(`erDiagram
D ||--|| D : first
D |o--o{ D : second`);

    expect(classResult.result.diagnostics).toEqual([]);
    expect(classResult.text).toContain("next");
    expect(classResult.text.split("\n").length).toBeLessThanOrEqual(4);
    expect(erResult.result.diagnostics).toEqual([]);
    expect(erResult.text).toContain("first");
    expect(erResult.text).toContain("second");
  });

  it("places labels on multiple Class self-loops", async () => {
    const { result, text } = await render(`classDiagram
class Node
Node --> Node : next
Node o-- Node : children`);

    expect(result.diagnostics).toEqual([]);
    expect(text).toContain("next");
    expect(text).toContain("children");
  });
});
