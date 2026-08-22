import {
  getCharGraphText,
  renderCharGraph,
  serializeCharGraphAnsi,
} from "@chardesk/chargraph";
import {
  renderMarkdown,
  type MarkdownRenderOptions,
} from "@chardesk/chargraph/markdown";
import { mermaidRenderer } from "@chardesk/chargraph/mermaid";

export type CharGraphExampleLevel = "basic" | "intermediate" | "advanced";
export type CharGraphExampleRenderer = "markdown" | "mermaid";
export type CharGraphExampleKind =
  | "flowchart"
  | "state"
  | "sequence"
  | "class"
  | "er"
  | "xychart"
  | "markdown-basics"
  | "markdown-structure"
  | "markdown-code"
  | "markdown-alert"
  | "markdown-math";

export type CharGraphExampleOutput = {
  readonly source: string;
  readonly text: string;
  readonly syntax: "ansi" | "plain";
};

interface CharGraphExample {
  readonly id: string;
  readonly kind: CharGraphExampleKind;
  readonly level: CharGraphExampleLevel;
  readonly renderer: CharGraphExampleRenderer;
  readonly detail?: string;
  readonly source: string;
  readonly expectedText: string;
}

const markdownOptions = {
  styles: {
    strong: { attrs: { bold: true } },
    emphasis: { attrs: { italic: true } },
    strikethrough: { attrs: { strike: true } },
    link: { color: "#2563eb", attrs: { underline: true } },
    "heading-marker": { color: "#2563eb" },
    "heading-1": { attrs: { bold: true, underline: true } },
    "heading-2": { attrs: { bold: true } },
    "heading-3": { attrs: { bold: true } },
    "heading-4": { attrs: { bold: true } },
    "inline-code": { bgColor: "#e2e8f0" },
    "blockquote-marker": { color: "#16a34a" },
    "list-marker": { color: "#94a3b8" },
    "ordered-list-marker": { color: "#94a3b8" },
    "task-unchecked": { color: "#94a3b8" },
    "task-checked": { color: "#16a34a" },
    "thematic-break": { color: "#94a3b8" },
    "table-header": { bgColor: "#e2e8f0", attrs: { bold: true } },
    "table-separator": { color: "#94a3b8" },
  },
  extensionStyles: {
    "alert-note": { color: "#0891b2" },
    "alert-tip": { color: "#16a34a" },
    "alert-important": { color: "#2563eb" },
    "alert-warning": { color: "#ca8a04" },
    "alert-caution": { color: "#dc2626" },
    "diff-added": { color: "#16a34a", bgColor: "#e3f4e9" },
    "diff-deleted": { color: "#dc2626", bgColor: "#fbe5e5" },
    "diff-hunk": { color: "#2563eb" },
    "diff-metadata": { color: "#94a3b8" },
    "inline-math": { color: "#2563eb" },
    "block-math": { color: "#2563eb" },
  },
} satisfies MarkdownRenderOptions;

export const CHARGRAPH_EXAMPLES: readonly CharGraphExample[] = [
  {
    id: "flowchart",
    kind: "flowchart",
    level: "basic",
    renderer: "mermaid",
    expectedText: "验证通过？",
    source: `flowchart LR
  A[用户输入] --> B{验证通过？}
  B -->|是| C[保存数据]
  B -->|否| D[显示错误]`,
  },
  {
    id: "flowchart-intermediate",
    kind: "flowchart",
    level: "intermediate",
    renderer: "mermaid",
    detail: "部署流水线",
    expectedText: "生产环境",
    source: `flowchart LR
  U[代码提交] --> T
  subgraph CI[持续集成]
    T[运行测试] --> B[构建镜像]
  end
  B --> P[生产环境]`,
  },
  {
    id: "state",
    kind: "state",
    level: "basic",
    renderer: "mermaid",
    expectedText: "审核",
    source: `stateDiagram-v2
  state "草稿" as draft
  state "审核" as review
  state "完成" as done
  [*] --> draft
  draft --> review : 提交
  review --> done : 通过
  done --> [*]`,
  },
  {
    id: "state-intermediate",
    kind: "state",
    level: "intermediate",
    renderer: "mermaid",
    detail: "内容发布",
    expectedText: "退回修改",
    source: `stateDiagram-v2
  state "编辑中" as editing
  state "待审核" as review
  state "已发布" as published
  [*] --> editing
  editing --> review : 提交
  review --> editing : 退回修改
  review --> published : 审核通过
  published --> [*]`,
  },
  {
    id: "sequence",
    kind: "sequence",
    level: "basic",
    renderer: "mermaid",
    expectedText: "返回结果",
    source: `sequenceDiagram
  participant U as 用户
  participant S as 服务
  U->>S: 提交请求
  S-->>U: 返回结果`,
  },
  {
    id: "sequence-intermediate",
    kind: "sequence",
    level: "intermediate",
    renderer: "mermaid",
    detail: "后台任务重试",
    expectedText: "重试任务",
    source: `sequenceDiagram
  participant Q as 任务队列
  participant W as Worker
  participant A as API
  Q->>W: 分发任务
  W->>W: 重试任务
  W-->>A: 回传结果
  A-->>Q: 确认完成`,
  },
  {
    id: "class",
    kind: "class",
    level: "basic",
    renderer: "mermaid",
    expectedText: "文档",
    source: `classDiagram
  class 文档 {
    +标题: string
    +保存()
  }
  文档 <|-- 画布`,
  },
  {
    id: "class-intermediate",
    kind: "class",
    level: "intermediate",
    renderer: "mermaid",
    detail: "内容域模型",
    expectedText: "内容域",
    source: `classDiagram
  namespace 内容域 {
    class 文档
    class 页面
  }
  文档 "1" --> "0..*" 页面 : 包含`,
  },
  {
    id: "er",
    kind: "er",
    level: "basic",
    renderer: "mermaid",
    expectedText: "订单",
    source: `erDiagram
  用户 ||--o{ 订单 : 创建
  用户 {
    string id PK
    string 名称
  }
  订单 {
    string id PK
    number 金额
  }`,
  },
  {
    id: "er-intermediate",
    kind: "er",
    level: "intermediate",
    renderer: "mermaid",
    detail: "推荐与关注",
    expectedText: "推荐",
    source: `erDiagram
  用户 ||--o{ 订单 : 创建
  用户 |o..|{ 订单 : 关注
  用户 ||--o{ 用户 : 推荐
  用户 {
    string id PK
    string email UK
  }`,
  },
  {
    id: "xychart",
    kind: "xychart",
    level: "basic",
    renderer: "mermaid",
    expectedText: "月度趋势",
    source: `xychart-beta
  title "月度趋势"
  x-axis [一月, 二月, 三月]
  y-axis "数量" 0 --> 10
  bar [3, 7, 5]
  line [2, 5, 8]`,
  },
  {
    id: "xychart-intermediate",
    kind: "xychart",
    level: "intermediate",
    renderer: "mermaid",
    detail: "多环境容量",
    expectedText: "预发布环境",
    source: `xychart-beta
  title "环境容量对比"
  x-axis [开发环境, 预发布环境, 生产环境]
  y-axis "实例数" 0 --> 20
  bar [3, 6, 12]
  bar [2, 4, 8]`,
  },
  {
    id: "flowchart-advanced",
    kind: "flowchart",
    level: "advanced",
    renderer: "mermaid",
    detail: "形状与连线",
    expectedText: "校验规则",
    source: `flowchart LR
  A([开始]) --> B[/读取配置\\]
  B -.-> C{{校验规则}}
  C ==>|通过| D[(缓存)]
  C -->|失败| E>记录告警]
  D <--> F[[同步服务]]`,
  },
  {
    id: "state-advanced",
    kind: "state",
    level: "advanced",
    renderer: "mermaid",
    detail: "订单生命周期",
    expectedText: "已取消",
    source: `stateDiagram-v2
  direction LR
  state "待支付" as pending
  state "已支付" as paid
  state "配送中" as shipping
  state "已完成" as completed
  state "已取消" as canceled
  [*] --> pending
  pending --> paid : 支付
  pending --> canceled : 超时
  paid --> shipping : 发货
  shipping --> completed : 收货
  completed --> [*]
  canceled --> [*]`,
  },
  {
    id: "sequence-advanced",
    kind: "sequence",
    level: "advanced",
    renderer: "mermaid",
    detail: "分支与循环",
    expectedText: "刷新会话",
    source: `sequenceDiagram
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
  end`,
  },
  {
    id: "class-advanced",
    kind: "class",
    level: "advanced",
    renderer: "mermaid",
    detail: "接口与依赖",
    expectedText: "渲染器",
    source: `classDiagram
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
  文档 --> 协作者 : 授权`,
  },
  {
    id: "er-advanced",
    kind: "er",
    level: "advanced",
    renderer: "mermaid",
    detail: "订单模型",
    expectedText: "订单项",
    source: `erDiagram
  用户 ||--o{ 订单 : 创建
  订单 ||--|{ 订单项 : 包含
  商品 ||..o{ 订单项 : 被引用
  用户 {
    string id PK
    string 邮箱 UK
  }
  订单 {
    string id PK
    string 用户id FK
  }
  订单项 {
    string 订单id FK
    string 商品id FK
    number 数量
  }
  商品 {
    string id PK
    string 名称
  }`,
  },
  {
    id: "xychart-advanced",
    kind: "xychart",
    level: "advanced",
    renderer: "mermaid",
    detail: "横向混合图",
    expectedText: "季度增长",
    source: `xychart-beta horizontal
  title "季度增长"
  x-axis [第一季, 第二季, 第三季, 第四季]
  y-axis "增长率" -5 --> 15
  bar [3, 8, 6, 12]
  line [1, 5, 9, 14]`,
  },
  {
    id: "markdown-basics",
    kind: "markdown-basics",
    level: "basic",
    renderer: "markdown",
    expectedText: "Markdown 概览",
    source: `# Markdown 概览

**粗体**、*斜体*与~~删除线~~

访问 [CharDesk](https://github.com/Sayhi-bzb/CharDesk)，或运行 \`renderMarkdown\`。`,
  },
  {
    id: "markdown-basics-intermediate",
    kind: "markdown-basics",
    level: "intermediate",
    renderer: "markdown",
    detail: "版本发布说明",
    expectedText: "v0.2",
    source: [
      "### v0.2 发布说明",
      "",
      "**新增**：支持 Markdown 与 Mermaid。  ",
      "*修复*：CJK 表格宽度与链接复制。",
      "",
      "完整记录见 [CHANGELOG](https://github.com/Sayhi-bzb/CharDesk)。",
    ].join("\n"),
  },
  {
    id: "markdown-basics-advanced",
    kind: "markdown-basics",
    level: "advanced",
    renderer: "markdown",
    detail: "组合样式与引用",
    expectedText: "语义样式",
    source: `## 阅读提示

> 使用 **语义样式** 表达重点，同时保留 *可读的* 文本结构。

_Markdown 可以嵌套 **强调内容**。_

---`,
  },
  {
    id: "markdown-structure",
    kind: "markdown-structure",
    level: "basic",
    renderer: "markdown",
    expectedText: "完成渲染",
    source: `- 解析 Markdown
- 生成字符图

1. 保留语义
2. 映射到 Grid

- [x] 完成渲染
- [ ] 发布文档`,
  },
  {
    id: "markdown-structure-intermediate",
    kind: "markdown-structure",
    level: "intermediate",
    renderer: "markdown",
    detail: "嵌套发布清单",
    expectedText: "回归测试",
    source: `1. 准备发布
    - [x] 更新版本
    - [x] 生成产物
2. 验证质量
    - [x] 单元测试
    - [ ] 回归测试
3. 发布并观察指标`,
  },
  {
    id: "markdown-structure-advanced",
    kind: "markdown-structure",
    level: "advanced",
    renderer: "markdown",
    detail: "CJK 表格与对齐",
    expectedText: "字符图",
    source: `| 能力 | 状态 | 宽度 |
| :--- | :---: | ---: |
| 字符图 | Ready | 2 |
| Markdown | Beta | 8 |`,
  },
  {
    id: "markdown-code",
    kind: "markdown-code",
    level: "basic",
    renderer: "markdown",
    expectedText: "renderMarkdown",
    source: `\`\`\`ts
const output = await renderMarkdown(source);
console.log(output.fragments.length);
\`\`\``,
  },
  {
    id: "markdown-code-intermediate",
    kind: "markdown-code",
    level: "intermediate",
    renderer: "markdown",
    detail: "渲染配置",
    expectedText: "renderer",
    source: `\`\`\`json
{
  "renderer": "markdown",
  "features": ["alert", "diff", "math"],
  "theme": "github-light"
}
\`\`\``,
  },
  {
    id: "markdown-code-advanced",
    kind: "markdown-code",
    level: "advanced",
    renderer: "markdown",
    detail: "Unified Diff",
    expectedText: "return next",
    source: `\`\`\`diff
diff --git a/render.ts b/render.ts
index 1a2b3c4..5d6e7f8 100644
--- a/render.ts
+++ b/render.ts
@@ -8,4 +8,4 @@ export function render(value) {
-  return value;
+  return next(value);
 }
\`\`\``,
  },
  {
    id: "markdown-alert",
    kind: "markdown-alert",
    level: "basic",
    renderer: "markdown",
    expectedText: "NOTE",
    source: `> [!NOTE]
> CharGraph 会保留 **嵌套 Markdown**。

> [!TIP]
> 使用 \`Unicode\` 输出便于复制。`,
  },
  {
    id: "markdown-alert-intermediate",
    kind: "markdown-alert",
    level: "intermediate",
    renderer: "markdown",
    detail: "部署提醒",
    expectedText: "IMPORTANT",
    source: `> [!IMPORTANT]
> 发布生产环境前请完成：
> - 检查 **数据库迁移**
> - 验证监控告警
> - 阅读 [回滚手册](https://example.com/rollback)`,
  },
  {
    id: "markdown-alert-advanced",
    kind: "markdown-alert",
    level: "advanced",
    renderer: "markdown",
    detail: "语义告警",
    expectedText: "CAUTION",
    source: `> [!IMPORTANT]
> 渲染规则可以独立配置。

> [!WARNING]
> 修改协议前请检查兼容性。

> [!CAUTION]
> - 保留原始数据
> - 验证映射结果`,
  },
  {
    id: "markdown-math",
    kind: "markdown-math",
    level: "basic",
    renderer: "markdown",
    expectedText: "e^(iπ)",
    source: String.raw`Euler 恒等式：$e^{i\pi}+1=0$`,
  },
  {
    id: "markdown-math-intermediate",
    kind: "markdown-math",
    level: "intermediate",
    renderer: "markdown",
    detail: "统计汇总",
    expectedText: "∑",
    source: String.raw`累计请求量：

$$
\sum_{i=1}^{n} x_i
$$

标准差核心项：$\sqrt{x+1}$`,
  },
  {
    id: "markdown-math-advanced",
    kind: "markdown-math",
    level: "advanced",
    renderer: "markdown",
    detail: "分式与矩阵",
    expectedText: "a + b",
    source: String.raw`$$
\frac{a+b}{c+d}
$$

\[
\begin{matrix}1&2\\3&4\end{matrix}
\]`,
  },
];

export const renderExample = async (
  example: CharGraphExample
): Promise<CharGraphExampleOutput> => {
  if (example.renderer === "markdown") {
    const rendered = await renderMarkdown(example.source, markdownOptions);
    return {
      source: serializeCharGraphAnsi(rendered),
      text: getCharGraphText(rendered),
      syntax: "ansi",
    };
  }

  const rendered = await renderCharGraph(example.source, mermaidRenderer, {
    characterSet: "unicode",
  });
  const text = getCharGraphText(rendered);
  return { source: text, text, syntax: "plain" };
};
