import { getTextCellWidth } from "@chardesk/protocol";
import { describe, expect, it } from "vitest";
import { getCharGraphText } from "./index.js";
import { renderMermaid, type MermaidRenderOptions } from "./mermaid.js";

const renderMermaidText = (
  source: string,
  options: MermaidRenderOptions = {}
) => renderMermaid(source, options).then(getCharGraphText);

const expectNoInternalCellTokens = (value: string) => {
  expect(value).not.toMatch(/[\uE000-\uF8FF]/u);
};

const trimLineEnds = (value: string) => value
  .split("\n")
  .map((line) => line.trimEnd())
  .join("\n");

describe("renderMermaidText", () => {
  it("produces deterministic layered output", async () => {
    const source = `flowchart LR
  A[入口] --> B{检查}
  B --> C[完成]
  B --> D[重试]
  D --> A`;

    const first = await renderMermaidText(source);
    const second = await renderMermaidText(source);

    expect(second).toBe(first);
  });

  it("uses balanced compact Flow and State defaults", async () => {
    const flowSource = "flowchart LR\n  A[用户] --> B[完成]";
    const stateSource = `stateDiagram-v2
  state "草稿" as draft
  [*] --> draft
  draft --> [*]`;

    const unicodeFlow = trimLineEnds(await renderMermaidText(flowSource));
    const asciiFlow = trimLineEnds(await renderMermaidText(flowSource, {
      characterSet: "ascii",
    }));
    const state = trimLineEnds(await renderMermaidText(stateSource));

    expect(unicodeFlow).toBe(`╭──────╮   ╭──────╮
│ 用户 ├──>│ 完成 │
╰──────╯   ╰──────╯`);
    expect(asciiFlow).toBe(`+------+   +------+
| 用户 |-->| 完成 |
+------+   +------+`);
    expect(state).toBe(`   ●
   │
   v
╭──────╮
│ 草稿 │
╰──┬───╯
   │
   v
   ◎`);
  });

  it("keeps a visible stroke cell beside vertical arrowheads", async () => {
    const source = "flowchart TD\n  A[上] --> B[下]";
    const vertical = trimLineEnds(await renderMermaidText(source));
    const clampedZero = trimLineEnds(await renderMermaidText(source, { paddingY: 0 }));
    const clampedOne = trimLineEnds(await renderMermaidText(source, { paddingY: 1 }));
    const bottomToTop = trimLineEnds(await renderMermaidText(
      "flowchart BT\n  A[下] --> B[上]",
    ));

    expect(vertical).toMatch(/╰─┬──╯\n  │\n  v/u);
    expect(clampedZero).toBe(vertical);
    expect(clampedOne).toBe(vertical);
    expect(bottomToTop).toMatch(/╰────╯\n  \^\n  │/u);
  });

  it("honors explicit Flow padding overrides", async () => {
    const output = trimLineEnds(await renderMermaidText(
      "flowchart LR\n  A[用户] --> B[完成]",
      { paddingX: 4, boxBorderPadding: 1 },
    ));

    expect(output).toContain("│ 用户 ├───>│ 完成 │");

    const unpadded = await renderMermaidText(
      "flowchart LR\n  A[用户] --> B[完成]",
      { boxBorderPadding: 0 },
    );
    expect(unpadded).toContain("│用户├");
  });

  it("lays out CJK flowchart labels in display cells", async () => {
    const output = await renderMermaidText(
      "flowchart LR\n  A[用户输入] --> B[处理完成]"
    );
    const widths = output.split("\n").map(getTextCellWidth);

    expect(output).toMatch(/│ 用户输入 ├─+>│ 处理完成 │/u);
    expect(new Set(widths).size).toBe(1);
    expectNoInternalCellTokens(output);
  });

  it("keeps labeled branch edges attached when another label widens the grid", async () => {
    const source = `flowchart LR
  A[用户输入] --> B{验证通过？}
  B -->|是| C[保存数据]
  B -->|否| D[显示错误]
  C --> E[处理完成]
  D --> A`;
    const output = await renderMermaidText(source);
    const asciiOutput = await renderMermaidText(source, { characterSet: "ascii" });
    const decisionLine = output
      .split("\n")
      .find((line) => line.includes("验证通过？"));

    expect(decisionLine).toMatch(/│ 验证通过？ ├.*是─+>│ 保存数据 /u);
    expect(decisionLine).not.toContain("│ 验证通过？ │├");
    expect(asciiOutput).toMatch(/\| 验证通过？ \|.*是[-=]+>\| 保存数据 /u);
    expectNoInternalCellTokens(output);
  });

  it("keeps fractional ELK arrow endpoints outside adjacent node borders", async () => {
    const output = await renderMermaidText(`flowchart LR
  A[用户输入] --> B{验证通过？}
  B -->|是| C[保存数据]
  B -->|否| D[显示错误]`);

    expect(output).toMatch(/是─+>│ 保存数据 │/u);
    expect(output).toContain("否");
    expect(output).toMatch(/>│ 显示错误 │/u);
    expect(output).toMatch(/┬─+╯/u);
    expect(output).toMatch(/╰─+否─+>│ 显示错误 │/u);
    expect(output).not.toMatch(/[─┄━]\^ +│/u);
    expectNoInternalCellTokens(output);
  });

  it("rounds dotted and thick ELK edge bends without changing segment styles", async () => {
    const output = await renderMermaidText(`flowchart LR
  A[入口] --> B{判断}
  B -.->|虚线| C[上路]
  B ==>|粗线| D[下路]`);

    expect(output).toMatch(/虚线┄*>│ 上路 │/u);
    expect(output).toMatch(/粗线━+>│ 下路 │/u);
    expect(output).toMatch(/┄/u);
    expect(output).toMatch(/━/u);
    expectNoInternalCellTokens(output);
  });

  it("anchors vertical branches and reverse edges to node borders", async () => {
    const output = await renderMermaidText(`flowchart TD
  A[开始] --> B{验证？}
  B -->|是| C[完成]
  B -->|否| D[重试]
  D --> A`);

    expect(output).toContain("^");
    expect(output).toMatch(/◇─+┬.*◇/u);
    expect(output).not.toMatch(/[◇│] +[├┤┬┴]/u);
  });

  it("keeps bidirectional arrowheads attached", async () => {
    const output = await renderMermaidText("flowchart LR\n  A[起点] <--> B[终点]");

    expect(output).toMatch(/│ 起点 │<─+>│ 终点 │/u);
  });

  it("renders CJK sequence diagrams", async () => {
    const output = await renderMermaidText(`sequenceDiagram
  participant U as 用户
  participant S as 服务
  U->>S: 提交请求
  S-->>U: 返回结果`);

    expect(output).toContain("用户");
    expect(output).toContain("提交请求");
    expect(output).toContain("返回结果");
    expect(output).toMatch(/─+>/u);
    expect(output).toMatch(/<╌+/u);
    expect(output).not.toMatch(/[▶▷◀◁]/u);
    expect(new Set(output.split("\n").map(getTextCellWidth)).size).toBe(1);
    expectNoInternalCellTokens(output);
  });

  it("keeps sequence lifelines, notes, and fragment borders semantically separate", async () => {
    const output = await renderMermaidText(`sequenceDiagram
  participant U as 用户
  participant A as API
  participant D as 数据库
  U->>A: 提交凭证
  Note over A,D: 校验身份与会话
  A->>D: 查询用户
  alt 验证通过
    D-->>A: 用户记录
    A-->>U: 登录成功
  else 验证失败
    A-->>U: 返回错误
  end
  loop 刷新会话
    U->>A: 刷新令牌
  end`);

    expect(output).toMatch(/├─+>│/u);
    expect(output).toContain("│ 校验身份与会话 │");
    expect(output).toContain("╭alt [验证通过]");
    expect(output).toContain("╭loop [刷新会话]");
    expect(output).not.toMatch(/校验身份与会话.*│.*│/u);
  });

  it("allocates independent class relationship ports and preserves member syntax", async () => {
    const output = await renderMermaidText(`classDiagram
  class 文档 {
    +标题 string
    +保存()
  }
  class 可保存 {
    <<interface>>
    +保存()
  }
  class 渲染器 {
    +渲染(文档)
  }
  class 协作者
  文档 ..|> 可保存
  文档 ..> 渲染器 : 使用
  文档 --> 协作者 : 授权`);

    expect(output).toContain("+string: 标题");
    expect(output).toContain("使用");
    expect(output).toContain("授权");
    expect(output).not.toContain("使用└─ 授权");
    expect(output.match(/[┬┴├┤]/gu)?.length).toBeGreaterThanOrEqual(2);
    expect(output).toContain("┼");
    expect(output.split("\n").length).toBeLessThanOrEqual(28);
  });

  it("renders Class namespaces, endpoint cardinalities, and multiline labels", async () => {
    const output = await renderMermaidText(`classDiagram
  namespace 内容域 {
    class 文档
    class 页面
  }
  文档 "1" --> "0..*" 页面 : 包含<br/>页面`);

    expect(output).toContain("内容域");
    expect(output).toContain("文档");
    expect(output).toContain("页面");
    expect(output).toContain("1");
    expect(output).toContain("0..*");
    expect(output).toContain("包含");
    expect(output.match(/页面/gu)?.length).toBeGreaterThanOrEqual(2);
    expect(output).toMatch(/[<>^v]/u);
  });

  it("renders all Class relationships with angle markers and dotted semantics", async () => {
    const unicode = await renderMermaidText(`classDiagram
  A <|-- B
  C *-- D
  E o-- F
  G --> H
  I ..> J
  K ..|> L`);
    const ascii = await renderMermaidText(`classDiagram
  A <|-- B
  C *-- D
  E o-- F
  G --> H
  I ..> J
  K ..|> L`, { characterSet: "ascii" });

    expect(unicode).not.toMatch(/[△▽◁▷]/u);
    expect(unicode).toContain("◆");
    expect(unicode).toContain("◇");
    expect(unicode).toMatch(/[<>^v]/u);
    expect(unicode).toMatch(/┆|┄/u);
    expect(ascii).toContain("*");
    expect(ascii).toContain("o");
    expect(ascii).toMatch(/[<>^v]/u);
  });

  it("lays out state pseudo-nodes from graph roots instead of declaration order", async () => {
    const output = await renderMermaidText(`stateDiagram-v2
  state "草稿" as draft
  state "审核" as review
  state "完成" as done
  [*] --> draft
  draft --> review : 提交
  review --> done : 通过
  done --> [*]`);
    const visibleLines = output.split("\n").filter((line) => line.trim().length > 0);

    expect(visibleLines[0]!.trim()).toBe("●");
    expect(visibleLines.at(-1)!.trim()).toBe("◎");
    expect(output.indexOf("●")).toBeLessThan(output.indexOf("草稿"));
    expect(output.indexOf("完成")).toBeLessThan(output.indexOf("◎"));
    expect(output).not.toMatch(/[╭┌].*●|●.*[╮┐]/u);
  });

  it("uses angle arrowheads for vertical, reversed, and bundled flow edges", async () => {
    const vertical = await renderMermaidText("flowchart TD\n  A[上] --> B[下]");
    const bottomToTop = await renderMermaidText("flowchart BT\n  A[下] --> B[上]");
    const bundled = await renderMermaidText(`flowchart LR
  A[一] --> C[三]
  B[二] --> C`);

    expect(vertical).toContain("v");
    expect(bottomToTop).toContain("^");
    expect(bundled).toContain(">");
    expect(`${vertical}\n${bottomToTop}\n${bundled}`).not.toMatch(/[▲▼◄►◥◤◢◣]/u);
  });

  it("composes an edge crossing a subgraph border as a four-way junction", async () => {
    const output = await renderMermaidText(`flowchart LR
  subgraph G[分组]
    A([开始]) --> B[处理]
  end
  X[外部] --> A`);

    expect(output).toMatch(/├─+┼─*>\( +开始 +\)/u);
    expectNoInternalCellTokens(output);
  });

  it("keeps semantic UML, ER, and node-shape markers", async () => {
    const classOutput = await renderMermaidText(`classDiagram
  父类 <|-- 子类
  文档 *-- 页面`);
    const erOutput = await renderMermaidText("erDiagram\n  用户 ||--o{ 订单 : 创建");
    const shapeOutput = await renderMermaidText("flowchart LR\n  A>告警]");

    expect(classOutput).toMatch(/[<>^v]/u);
    expect(classOutput).not.toMatch(/[△▽◁▷]/u);
    expect(classOutput).toContain("◆");
    expect(erOutput).toMatch(/││─+创建─+○╟│/u);
    expect(shapeOutput).toContain("▷──────┐");
  });

  it("keeps edge labels inside route corners in advanced flowcharts", async () => {
    const output = await renderMermaidText(`flowchart LR
  A([开始]) --> B[/读取配置\\]
  B -.-> C{{校验规则}}
  C ==>|通过| D[(缓存)]
  C -->|失败| E>记录告警]
  D <--> F[[同步服务]]`);

    expect(output).toContain("╭失败>│ 记录告警 │");
    expect(output).not.toMatch(/ {2,}失败>│ 记录告警 │/u);
    expectNoInternalCellTokens(output);
  });

  it("renders ER comments, parallel relationships, and self relationships", async () => {
    const output = await renderMermaidText(`erDiagram
  用户 ||--o{ 订单 : 创建
  用户 |o..|{ 订单 : 关注
  用户 ||--o{ 用户 : 推荐
  用户 {
    string email UK "联系<br/>邮箱"
  }`);

    expect(output).toContain('UK string email "联系"');
    expect(output).toContain('"邮箱"');
    expect(output).toContain("创建");
    expect(output).toContain("关注");
    expect(output).toContain("推荐");
    expect(output).toMatch(/┄|┆/u);
    expect(output).toContain("○");
    expect(new Set(output.split("\n").map(getTextCellWidth)).size).toBe(1);
    expectNoInternalCellTokens(output);
  });

  it("lays out ER cycles and disconnected entities", async () => {
    const output = await renderMermaidText(`erDiagram
  A ||--o{ B : AB
  B ||--o{ C : BC
  C ||--o{ A : CA
  ISOLATED {
    string id PK
  }`);

    expect(output).toContain("AB");
    expect(output).toContain("BC");
    expect(output).toContain("CA");
    expect(output).toContain("ISOLATED");
    expect(output).toContain("PK string id");
    expectNoInternalCellTokens(output);
  });

  it("uses angle arrowheads for sequence self-messages", async () => {
    const output = await renderMermaidText(`sequenceDiagram
  participant U as 用户
  U->>U: 重试`);

    expect(output).toMatch(/<─+┘/u);
    expect(output).not.toMatch(/[▶▷◀◁]/u);
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
  ])("renders the %s text pipeline", async (_kind, source, expected) => {
    const output = await renderMermaidText(source);

    expect(output).toContain(expected);
    expectNoInternalCellTokens(output);
  });

  it("round-trips emoji and combining graphemes without losing their cells", async () => {
    const output = await renderMermaidText(
      "flowchart LR\n  A[开发者 👩‍💻] --> B[é 完成]"
    );

    expect(output).toContain("开发者 👩‍💻");
    expect(output).toContain("é 完成");
    expectNoInternalCellTokens(output);
  });

  it("supports the ASCII character set without changing Unicode labels", async () => {
    const output = await renderMermaidText("flowchart LR\n  A[用户] --> B[完成]", {
      characterSet: "ascii",
    });

    expect(output).toContain("+------+");
    expect(output).toContain("| 用户 |-->| 完成 |");
    expect(output).toContain("用户");
    expect(output).not.toContain("┌");
  });

  it.each([
    ["flow", "flowchart LR\n  A[开始] --> B[完成]"],
    ["sequence", "sequenceDiagram\n  participant U as 用户\n  U->>U: 重试"],
    ["class", "classDiagram\n  class 文档 {\n    +保存()\n  }"],
    ["er", "erDiagram\n  用户 {\n    string id PK\n  }"],
    ["subgraph", "flowchart LR\n  subgraph G[分组]\n    A[开始]\n  end"],
  ])("uses rounded outer corners for default %s boxes", async (_kind, source) => {
    const output = await renderMermaidText(source);
    expect(output).toContain("╭");
    expect(output).toContain("╮");
    expect(output).toContain("╰");
    expect(output).toContain("╯");
  });
});
