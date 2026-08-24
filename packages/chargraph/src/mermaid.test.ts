import { getTextCellWidth } from "@chardesk/protocol";
import { describe, expect, it } from "vitest";
import { getCharGraphText } from "./index.js";
import {
  CHARDESK_MERMAID_COLOR_DEFAULTS,
  createCharDeskMermaidStyles,
  MERMAID_STYLE_ROLES,
  renderMermaid,
  type MermaidRenderOptions,
} from "./mermaid.js";

const renderMermaidText = (
  source: string,
  options: MermaidRenderOptions = {}
) => renderMermaid(source, options).then(getCharGraphText);

const expectNoInternalCellTokens = (value: string) => {
  expect(value).not.toMatch(/[\uE000-\uF8FF]/u);
};

const expectTerminalArrows = (value: string) => {
  expect(value).not.toMatch(/>[─━┄]|[─━┄]</u);
};

const trimLineEnds = (value: string) => value
  .split("\n")
  .map((line) => line.trimEnd())
  .join("\n");

describe("renderMermaidText", () => {
  it("publishes one unique set of semantic style roles", () => {
    expect(new Set(MERMAID_STYLE_ROLES).size).toBe(MERMAID_STYLE_ROLES.length);
    expect(MERMAID_STYLE_ROLES).toContain("node.background");
    expect(MERMAID_STYLE_ROLES).toContain("series.5");
  });

  it("owns one default and one resolved style for every semantic role", () => {
    const styles = createCharDeskMermaidStyles();

    expect(Object.keys(CHARDESK_MERMAID_COLOR_DEFAULTS))
      .toEqual([...MERMAID_STYLE_ROLES]);
    expect(Object.keys(styles))
      .toEqual([...MERMAID_STYLE_ROLES]);
    expect(CHARDESK_MERMAID_COLOR_DEFAULTS["edge.line"])
      .toEqual({ kind: "token", token: "accent" });
    expect(new Set([
      styles["node.border"].color,
      styles["edge.line"].color,
      styles["edge.arrow"].color,
    ])).toEqual(new Set(["#2563eb"]));
  });

  it("resolves Mermaid overrides without losing fixed attributes", () => {
    const styles = createCharDeskMermaidStyles({
      colors: {
        title: "#123456",
        "node.background": "#654321",
        "edge.line": "#fedcba",
        "edge.label": "#abcdef",
      },
    });

    expect(styles.title).toEqual({
      color: "#123456",
      attrs: { bold: true },
    });
    expect(styles["node.text"]?.bgColor).toBe("#654321");
    expect(styles["node.background"]?.bgColor).toBe("#654321");
    expect(styles["edge.line"]?.color).toBe("#fedcba");
    expect(styles["node.border"]?.color).toBe("#2563eb");
    expect(styles["edge.arrow"]?.color).toBe("#2563eb");
    expect(styles["edge.label"]).toEqual({
      color: "#abcdef",
      attrs: { italic: true },
    });
  });

  it.each([
    ["Flow", "flowchart LR\n  A[Start] -->|go| B[Done]"],
    ["State", "stateDiagram-v2\n  [*] --> draft\n  draft --> done : go\n  done --> [*]"],
  ])("emits monochrome structural %s fragments without changing text", async (_, source) => {
    const plain = await renderMermaidText(source);
    const styled = await renderMermaid(source, {
      styles: {
        "node.text": { color: "#111111" },
        "node.border": { color: "#222222" },
        "edge.line": { color: "#222222" },
        "edge.arrow": { color: "#222222" },
        "edge.label": { color: "#444444" },
      },
    });

    expect(getCharGraphText(styled)).toBe(plain);
    expect(new Set(styled.fragments.map((fragment) => fragment.color))).toEqual(
      new Set([undefined, "#111111", "#222222", "#444444"])
    );
  });

  it("keeps XY series identities available to the style layer", async () => {
    const result = await renderMermaid(`xychart-beta
  x-axis [A, B]
  y-axis 0 --> 10
  bar [2, 8]
  line [8, 2]`, {
      styles: {
        "series.1": { color: "#111111" },
        "series.2": { color: "#222222" },
      },
    });

    const colors = new Set(result.fragments.map((fragment) => fragment.color));
    expect(colors.has("#111111")).toBe(true);
    expect(colors.has("#222222")).toBe(true);
  });

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

  it("keeps repeated Flow forks and joins centered across layers", async () => {
    const output = await renderMermaidText(`flowchart TD
  A[A] --> B[B]
  B --> B1[B1]
  B --> B2[B2]
  B --> B3[B3]
  B --> B4[B4]
  B1 --> C[C]
  B2 --> C
  B3 --> C
  B4 --> C
  C --> D[D]
  D --> D1[D1]
  D --> D2[D2]
  D --> D3[D3]
  D --> D4[D4]
  D1 --> E[E]
  D2 --> E
  D3 --> E
  D4 --> E
  E --> F[F]
  F --> G[G]`);
    const lines = output.split("\n");
    const centers = ["A", "B", "C", "D", "E", "F", "G"].map((id) => {
      const token = `│ ${id} │`;
      const line = lines.find((candidate) => candidate.includes(token));
      expect(line).toBeDefined();
      const prefix = line!.slice(0, line!.indexOf(token));
      return getTextCellWidth(prefix) + getTextCellWidth(token) / 2;
    });

    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(2);
    expectNoInternalCellTokens(output);
  });

  it("keeps a visible stroke cell beside vertical arrowheads", async () => {
    const source = "flowchart TD\n  A[上] --> B[下]";
    const vertical = trimLineEnds(await renderMermaidText(source));
    const clampedZero = trimLineEnds(await renderMermaidText(source, { paddingY: 0 }));
    const clampedOne = trimLineEnds(await renderMermaidText(source, { paddingY: 1 }));
    const bottomToTop = trimLineEnds(await renderMermaidText(
      "flowchart BT\n  A[下] --> B[上]",
    ));

    expect(vertical).toMatch(/╰─┬──╯\n {2}│\n {2}│\n {2}v/u);
    expect(clampedZero).toBe(vertical);
    expect(clampedOne).toBe(vertical);
    expect(bottomToTop).toMatch(/╰────╯\n {2}\^\n {2}│/u);
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

    expect(decisionLine).toContain("│ 验证通过？ ├");
    expect(decisionLine).not.toContain("│ 验证通过？ │├");
    expect(output).toContain("是");
    expect(output).toContain("否");
    expect(output).toMatch(/>│ 保存数据 /u);
    expect(asciiOutput).toMatch(/>\| 保存数据 /u);
    expectTerminalArrows(output);
    expectNoInternalCellTokens(output);
  });

  it("keeps fractional ELK arrow endpoints outside adjacent node borders", async () => {
    const output = await renderMermaidText(`flowchart LR
  A[用户输入] --> B{验证通过？}
  B -->|是| C[保存数据]
  B -->|否| D[显示错误]`);

    expect(output).toContain("是");
    expect(output).toContain("否");
    expect(output).toMatch(/>│ 保存数据 │/u);
    expect(output).toMatch(/>│ 显示错误 │/u);
    expect(output).toMatch(/[┬┤├┴]/u);
    expect(output).not.toMatch(/[─┄━]\^ +│/u);
    expectTerminalArrows(output);
    expectNoInternalCellTokens(output);
  });

  it("routes long fan-out and fan-in flows through explicit buses", async () => {
    const source = `flowchart TD
  A[选择一个待核对模型] --> B[查看模型配置]
  B --> B1[记录模型名称]
  B --> B2[记录数据库表名]
  B --> B3[记录输入参数]
  B --> B4[记录输出字段]
  B1 --> C[查找对应数据表]
  B2 --> C
  B3 --> C
  B4 --> C
  C --> D{数据表是否存在？}
  D -- 不存在 --> X1[标记不可用]
  D -- 存在 --> E[查看 Columns]
  E --> F[对比模型字段与真实列]
  F --> G{模型使用的列是否存在？}
  G -- 不存在 --> X2[记录错误字段]
  G -- 存在 --> H[查询真实数据]
  X2 --> H
  H --> I[检查字段实际含义]
  I --> I1[代码代表什么？]
  I --> I2[日期代表什么？]
  I --> I3[数值单位是什么？]
  I --> I4[枚举值如何翻译？]
  I1 --> J[检查数据质量]
  I2 --> J
  I3 --> J
  I4 --> J
  J --> J1[检查最新数据日期]
  J --> J2[检查关键字段空值]
  J --> J3[检查重复数据]
  J --> J4[检查表是否停止维护]
  J1 --> K[选择真实测试样本]
  J2 --> K
  J3 --> K
  J4 --> K
  K --> L[填写模型验收表]`;
    const result = await renderMermaid(source);
    const output = getCharGraphText(result);

    expect(result.diagnostics).toEqual([]);
    expect(output).toContain("填写模型验收表");
    expect(output).not.toContain("flowchart TD");
    expect(output).toMatch(/[┬┴]/u);
    expect(output).not.toMatch(/[╭╮╰╯]{2}/u);
    expectTerminalArrows(output);
    expectNoInternalCellTokens(output);
  });

  it("rounds dotted and thick ELK edge bends without changing segment styles", async () => {
    const output = await renderMermaidText(`flowchart LR
  A[入口] --> B{判断}
  B -.->|虚线| C[上路]
  B ==>|粗线| D[下路]`);

    expect(output).toMatch(/虚线.*┄|┄.*虚线/u);
    expect(output).toMatch(/粗线.*┃|┃.*粗线/u);
    expect(output).toMatch(/>│ 上路 │/u);
    expect(output).toMatch(/>│ 下路 │/u);
    expect(output).toMatch(/┄/u);
    expect(output).toMatch(/━/u);
    expectTerminalArrows(output);
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

  it("assigns sequence styles from drawing semantics", async () => {
    const source = `sequenceDiagram
  participant U as 用户
  participant A as API
  U->>A: 提交
  Note over U,A: 校验
  alt 通过
    A-->>U: 完成
  end`;
    const result = await renderMermaid(source, {
      styles: {
        "node.text": { color: "#111111" },
        "node.border": { color: "#222222" },
        "node.background": { backgroundColor: "#333333" },
        "edge.line": { color: "#444444" },
        "edge.label": { color: "#555555" },
        "edge.arrow": { color: "#666666" },
        "container.border": { color: "#777777" },
        "container.title": { color: "#888888" },
      },
    });

    expect(getCharGraphText(result)).toBe(await renderMermaidText(source));
    const colors = new Set(result.fragments.map((fragment) => fragment.color));
    expect(colors).toEqual(new Set([
      undefined,
      "#111111",
      "#222222",
      "#444444",
      "#555555",
      "#666666",
      "#777777",
      "#888888",
    ]));
    expect(result.fragments.some(
      (fragment) => fragment.backgroundColor === "#333333"
    )).toBe(true);
  });

  it("allocates independent class relationship ports and preserves member syntax", async () => {
    const output = await renderMermaidText(`classDiagram
  class 文档 {
    +string 标题
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

    expect(output).toContain("+标题: string");
    expect(output).toContain("使用");
    expect(output).toContain("授权");
    expect(output).not.toContain("使用└─ 授权");
    expect(output.match(/[┬┴├┤]/gu)?.length).toBeGreaterThanOrEqual(2);
    expect(output).toContain("╭────────┴──────╮");
    expect(output).toContain("╰─────┬─────┬───╯");
    expect(output).not.toContain("┼");
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

  it("keeps Class endpoint cardinalities within a namespace border", async () => {
    const output = await renderMermaidText(`classDiagram
  namespace 内容域 {
    class 文档
    class 页面
  }
  文档 "1" --> "0..*" 页面 : 包含`);
    const lines = output.split("\n");
    const width = getTextCellWidth(lines[0]!);
    const targetCardinalityLine = lines.find((line) => line.includes("0..*"));

    expect(targetCardinalityLine).toBeDefined();
    expect(targetCardinalityLine).toMatch(/0\.\.\*\s+│$/u);
    expect(lines.every((line) => getTextCellWidth(line) === width)).toBe(true);
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

  it("keeps a state feedback cycle vertical, compact, and separately routed", async () => {
    const source = `stateDiagram-v2
  state "已发布" as published
  state "待审核" as review
  state "编辑中" as editing
  [*] --> editing
  editing --> review : 提交
  review --> editing : 退回修改
  review --> published : 审核通过
  published --> [*]`;
    const rendered = await renderMermaid(source);
    expect(rendered.diagnostics).toEqual([]);
    const output = getCharGraphText(rendered);
    const visibleLines = output.split("\n").filter((line) => line.trim().length > 0);
    const rowOf = (text: string) => visibleLines.findIndex((line) => line.includes(text));
    const lifecycleRows = ["●", "编辑中", "待审核", "已发布", "◎"].map(rowOf);

    expect(lifecycleRows.every((row) => row >= 0), output).toBe(true);
    expect(lifecycleRows).toEqual(
      [...lifecycleRows].sort((left, right) => left - right),
    );
    expect(visibleLines.length).toBeLessThanOrEqual(21);
    expect(output).toContain("提交");
    expect(output).toContain("退回修改");
    expect(output).toContain("审核通过");
    expect(output).toMatch(/\^ {2,}│提交/u);
    expect(output).toMatch(/退回修改│ {2,}v/u);
    expect(output).toMatch(/●\s*\n\s*│\s*\n\s*v/u);
    expect(output).not.toContain("╰╮");
    expect(output).not.toContain("╭╯");
    expect(output).not.toMatch(/[v^][─┄━]|[─┄━][v^]/u);
    expectNoInternalCellTokens(output);
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

    expect(output).toMatch(/[━┃]通过|通过[━┃]/u);
    expect(output).toContain("失败");
    expect(output).toMatch(/>│ 记录告警 │/u);
    expectTerminalArrows(output);
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

    expect(output).toMatch(/├─+╮/u);
    expect(output).toMatch(/<─+╯/u);
    expect(output).not.toMatch(/[┐┘]/u);
    expect(output).not.toMatch(/[▶▷◀◁]/u);
  });

  it("keeps solid, dashed, and multi-line sequence self-messages rounded", async () => {
    const solid = await renderMermaidText(`sequenceDiagram
  participant W as Worker
  W->>W: 第一行<br/>第二行`);
    const dashed = await renderMermaidText(`sequenceDiagram
  participant W as Worker
  W-->>W: 重试`);
    const ascii = await renderMermaidText(`sequenceDiagram
  participant W as Worker
  W->>W: Retry`, { characterSet: "ascii" });

    expect(solid).toMatch(/├─+╮/u);
    expect(solid).toMatch(/<─+╯/u);
    expect(solid).toContain("第一行");
    expect(solid).toContain("第二行");
    expect(solid).not.toMatch(/[┐┘]/u);
    expect(dashed).toMatch(/├╌+╮/u);
    expect(dashed).toMatch(/<╌+╯/u);
    expect(ascii).toMatch(/\+-+\+/u);
    expect(ascii).toMatch(/<-+\+/u);
  });

  it("rounds subroutine outer corners without losing its double border", async () => {
    const unicode = await renderMermaidText("flowchart LR\n  A[[同步服务]]");
    const ascii = await renderMermaidText("flowchart LR\n  A[[同步服务]]", {
      characterSet: "ascii",
    });

    expect(unicode).toMatch(/╭┬─+┬╮/u);
    expect(unicode).toMatch(/╰┴─+┴╯/u);
    expect(unicode).not.toMatch(/[┌┐└┘]/u);
    expect(ascii).toMatch(/\+\+-+\+\+/u);
  });

  it.each([
    [
      "class",
      `classDiagram
  class User {
    +string name
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
