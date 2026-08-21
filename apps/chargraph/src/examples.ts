import { getCharGraphText, renderCharGraph } from "@chardesk/chargraph";
import { mermaidRenderer } from "@chardesk/chargraph/mermaid";

export type CharGraphExampleLevel = "basic" | "advanced";
export type CharGraphExampleKind =
  | "flowchart"
  | "state"
  | "sequence"
  | "class"
  | "er"
  | "xychart";

interface CharGraphExample {
  readonly id: string;
  readonly kind: CharGraphExampleKind;
  readonly level: CharGraphExampleLevel;
  readonly detail?: string;
  readonly source: string;
  readonly expectedText: string;
}

export const CHARGRAPH_EXAMPLES: readonly CharGraphExample[] = [
  {
    id: "flowchart",
    kind: "flowchart",
    level: "basic",
    expectedText: "验证通过？",
    source: `flowchart LR
  A[用户输入] --> B{验证通过？}
  B -->|是| C[保存数据]
  B -->|否| D[显示错误]`,
  },
  {
    id: "state",
    kind: "state",
    level: "basic",
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
    id: "sequence",
    kind: "sequence",
    level: "basic",
    expectedText: "返回结果",
    source: `sequenceDiagram
  participant U as 用户
  participant S as 服务
  U->>S: 提交请求
  S-->>U: 返回结果`,
  },
  {
    id: "class",
    kind: "class",
    level: "basic",
    expectedText: "文档",
    source: `classDiagram
  class 文档 {
    +标题: string
    +保存()
  }
  文档 <|-- 画布`,
  },
  {
    id: "er",
    kind: "er",
    level: "basic",
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
    id: "xychart",
    kind: "xychart",
    level: "basic",
    expectedText: "月度趋势",
    source: `xychart-beta
  title "月度趋势"
  x-axis [一月, 二月, 三月]
  y-axis "数量" 0 --> 10
  bar [3, 7, 5]
  line [2, 5, 8]`,
  },
  {
    id: "flowchart-advanced",
    kind: "flowchart",
    level: "advanced",
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
    detail: "横向混合图",
    expectedText: "季度增长",
    source: `xychart-beta horizontal
  title "季度增长"
  x-axis [第一季, 第二季, 第三季, 第四季]
  y-axis "增长率" -5 --> 15
  bar [3, 8, 6, 12]
  line [1, 5, 9, 14]`,
  },
];

export const renderExample = async (example: CharGraphExample) =>
  getCharGraphText(await renderCharGraph(example.source, mermaidRenderer, {
    characterSet: "unicode",
  }));
