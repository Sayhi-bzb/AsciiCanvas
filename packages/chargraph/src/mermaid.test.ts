import { getTextCellWidth } from "@chardesk/protocol";
import { describe, expect, it } from "vitest";
import { renderMermaidText } from "./mermaid.js";

const expectNoInternalCellTokens = (value: string) => {
  expect(value).not.toMatch(/[\uE000-\uF8FF]/u);
};

describe("renderMermaidText", () => {
  it("lays out CJK flowchart labels in display cells", () => {
    const output = renderMermaidText(
      "flowchart LR\n  A[用户输入] --> B[处理完成]"
    );
    const widths = output.split("\n").map(getTextCellWidth);

    expect(output).toContain("│ 用户输入 ├────►│ 处理完成 │");
    expect(new Set(widths).size).toBe(1);
    expectNoInternalCellTokens(output);
  });

  it("keeps labeled branch edges attached when another label widens the grid", () => {
    const source = `flowchart LR
  A[用户输入] --> B{验证通过？}
  B -->|是| C[保存数据]
  B -->|否| D[显示错误]
  C --> E[处理完成]
  D --> A`;
    const output = renderMermaidText(source);
    const asciiOutput = renderMermaidText(source, { characterSet: "ascii" });
    const decisionLine = output
      .split("\n")
      .find((line) => line.includes("验证通过？"));

    expect(decisionLine).toMatch(/│ 验证通过？ ├─+是─+►│ 保存数据 /u);
    expect(decisionLine).not.toContain("│ 验证通过？ │ ├");
    expect(asciiOutput).toMatch(/\| 验证通过？ \|-+是-+>\| 保存数据 /u);
    expectNoInternalCellTokens(output);
  });

  it("anchors vertical branches and reverse edges to node borders", () => {
    const output = renderMermaidText(`flowchart TD
  A[开始] --> B{验证？}
  B -->|是| C[完成]
  B -->|否| D[重试]
  D --> A`);

    expect(output).toContain("│  开始  │◄");
    expect(output).toContain("◇────┬───◇");
    expect(output).not.toMatch(/[◇│] +[├┤┬┴]/u);
  });

  it("keeps bidirectional arrowheads attached", () => {
    const output = renderMermaidText("flowchart LR\n  A[起点] <--> B[终点]");

    expect(output).toContain("│ 起点 ◄────►│ 终点 │");
  });

  it("renders CJK sequence diagrams", () => {
    const output = renderMermaidText(`sequenceDiagram
  participant U as 用户
  participant S as 服务
  U->>S: 提交请求
  S-->>U: 返回结果`);

    expect(output).toContain("用户");
    expect(output).toContain("提交请求");
    expect(output).toContain("返回结果");
    expect(new Set(output.split("\n").map(getTextCellWidth)).size).toBe(1);
    expectNoInternalCellTokens(output);
  });

  it.each([
    [
      "class",
      `classDiagram
  class User {
    +name: string
  }
  User : 用户资料`,
      "用户资料",
    ],
    ["er", "erDiagram\n  用户 ||--o{ 订单 : 创建", "创建"],
    [
      "xychart",
      `xychart-beta
  title "月度趋势"
  x-axis [一月, 二月, 三月]
  y-axis "数量" 0 --> 10
  bar [3, 7, 5]`,
      "月度趋势",
    ],
  ])("renders the %s text pipeline", (_kind, source, expected) => {
    const output = renderMermaidText(source);

    expect(output).toContain(expected);
    expectNoInternalCellTokens(output);
  });

  it("round-trips emoji and combining graphemes without losing their cells", () => {
    const output = renderMermaidText(
      "flowchart LR\n  A[开发者 👩‍💻] --> B[é 完成]"
    );

    expect(output).toContain("开发者 👩‍💻");
    expect(output).toContain("é 完成");
    expectNoInternalCellTokens(output);
  });

  it("supports the ASCII character set without changing Unicode labels", () => {
    const output = renderMermaidText("flowchart LR\n  A[用户] --> B[完成]", {
      characterSet: "ascii",
    });

    expect(output).toContain("+------+");
    expect(output).toContain("用户");
    expect(output).not.toContain("┌");
  });
});
