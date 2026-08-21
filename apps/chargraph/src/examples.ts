import { renderCharGraph } from "@chardesk/chargraph";
import { mermaidRenderer } from "@chardesk/chargraph/mermaid";

interface CharGraphExample {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly source: string;
  readonly expectedText: string;
}

export const CHARGRAPH_EXAMPLES: readonly CharGraphExample[] = [
  {
    id: "flowchart",
    name: "流程图",
    summary: "把判断、分支与循环转换为可复制的字符连线。",
    expectedText: "验证通过？",
    source: `flowchart LR
  A[用户输入] --> B{验证通过？}
  B -->|是| C[保存数据]
  B -->|否| D[显示错误]`,
  },
  {
    id: "state",
    name: "状态图",
    summary: "用 Unicode 节点保留状态之间的方向和转换条件。",
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
    name: "时序图",
    summary: "在纯文本中表达参与者、消息顺序与响应关系。",
    expectedText: "返回结果",
    source: `sequenceDiagram
  participant U as 用户
  participant S as 服务
  U->>S: 提交请求
  S-->>U: 返回结果`,
  },
  {
    id: "class",
    name: "类图",
    summary: "以字符表格呈现类型、字段、方法和继承关系。",
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
    name: "实体关系图",
    summary: "保留实体字段、基数和关系标签。",
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
    name: "XY 图表",
    summary: "用字符坐标与图形标记表达轻量数据趋势。",
    expectedText: "月度趋势",
    source: `xychart-beta
  title "月度趋势"
  x-axis [一月, 二月, 三月]
  y-axis "数量" 0 --> 10
  bar [3, 7, 5]
  line [2, 5, 8]`,
  },
];

export const renderExample = (example: CharGraphExample) =>
  renderCharGraph(example.source, mermaidRenderer, {
    characterSet: "unicode",
  });
